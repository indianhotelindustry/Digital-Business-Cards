// ============================================================================
// Directive 29: email verification and the App Owner boundary (emulator)
// ============================================================================
// The full lifecycle with real components: a legacy email/password account
// (Directive 34: the browser no longer writes profiles, so the documents are
// written with the Admin SDK exactly as the old registerAccount() did), the
// client verification service, Auth-emulator verification links (oobCodes), the
// Admin-SDK grant script, the deployed callables and firestore.rules.
//
//   REGISTER -> unverified -> no App Owner authority -> verify -> still no
//   authority (no automatic grant) -> server/admin grant -> authority.
import { beforeAll, describe, expect, it } from 'vitest';
import { applyActionCode, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { adminAuth, adminDb, call, PROJECT, resetEmulators, type TestUser } from './support/backendEnv';
import { buildRegistrationDocuments } from '../../shared/domain/registrationModel';
import { INITIAL_ACCOUNT_STATUS } from '../../shared/domain/accountStatus';
import { auth, db } from '../../src/lib/firebase';
import { describeVerificationError, refreshVerificationState, sendVerificationEmail } from '../../src/services/emailVerification';
import { hasVerifiedOwnerClaim } from '../../src/lib/authority';
import { setAppOwner, verifyAppOwner } from '../../scripts/admin/setAppOwner';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const EMAIL = 'verify-owner@dsbc.test';
const PASSWORD = 'emulator-only-password-29';

interface OobCode { email: string; oobCode: string; oobLink: string; requestType: string }
async function verificationLinks(email: string): Promise<OobCode[]> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const body = (await res.json()) as { oobCodes?: OobCode[] };
  return (body.oobCodes ?? []).filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL');
}

const asTestUser = async (u: User, forceRefresh = false): Promise<TestUser> => ({ uid: u.uid, email: u.email!, token: await u.getIdToken(forceRefresh) });
const ownerCallable = (who: TestUser) => call('adminGetPlatformHealth', {}, who);
const ownerOnlyRead = async () => {
  try {
    await getDocs(query(collection(db, 'securityAuditLogs'), limit(1)));
    return 'ALLOWED';
  } catch (err) {
    return (err as { code?: string }).code ?? String(err);
  }
};
const grantsFor = async (uid: string) =>
  (await adminDb.collection('securityAuditLogs').where('targetUid', '==', uid).get()).docs.map((d) => d.get('action'));

let user: User;
let tokenBeforeVerification: string;

/** A legacy password company account: Auth user from the client, profile docs from the Admin SDK, then the verification email. */
async function registerLegacyPasswordAccount(p: { email: string; password: string; displayName: string; companyName: string }) {
  const created = (await createUserWithEmailAndPassword(auth, p.email, p.password)).user;
  await updateProfile(created, { displayName: p.displayName });
  const docs = buildRegistrationDocuments({ uid: created.uid, email: created.email || p.email, displayName: p.displayName, accountType: 'company', companyName: p.companyName, status: INITIAL_ACCOUNT_STATUS });
  const batch = adminDb.batch();
  if (docs.company) batch.set(adminDb.collection('companies').doc(docs.company.id), docs.company);
  batch.set(adminDb.collection('tenants').doc(docs.tenant.id), docs.tenant);
  batch.set(adminDb.collection('users').doc(created.uid), docs.user);
  await batch.commit();
  try {
    await sendVerificationEmail(created);
    return { profile: docs.user, verificationEmailSent: true, verificationError: null };
  } catch (err) {
    return { profile: docs.user, verificationEmailSent: false, verificationError: describeVerificationError(err) };
  }
}

beforeAll(async () => {
  await resetEmulators();
});

describe('VERIFY: registration starts unverified and without authority', () => {
  it('VERIFY-001 registering creates an unverified account and sends exactly one verification email', async () => {
    const result = await registerLegacyPasswordAccount({ email: EMAIL, password: PASSWORD, displayName: 'Verify Owner Co', companyName: 'Verify Owner Co' });
    expect(result.verificationEmailSent).toBe(true);
    expect(result.verificationError).toBeNull();
    expect(result.profile.role).toBe('company_admin'); // never app_owner from registration
    user = auth.currentUser!;
    expect(user.email).toBe(EMAIL);
    expect(user.emailVerified).toBe(false);
    expect((await adminAuth.getUser(user.uid)).emailVerified).toBe(false);
    expect(await verificationLinks(EMAIL)).toHaveLength(1);
    tokenBeforeVerification = await user.getIdToken();
  });

  it('VERIFY-002 an unverified account has no App Owner authority anywhere, and the grant script refuses it', async () => {
    const claims = (await user.getIdTokenResult()).claims;
    expect(hasVerifiedOwnerClaim(claims, user.emailVerified)).toBe(false);
    expect((await ownerCallable(await asTestUser(user))).status).toBe('PERMISSION_DENIED');
    expect(await ownerOnlyRead()).toBe('permission-denied');
    await expect(setAppOwner({ auth: adminAuth, db: adminDb, email: EMAIL, actor: 'test@d29', projectId: PROJECT })).rejects.toThrow(/not verified/);
    expect((await adminAuth.getUser(user.uid)).customClaims?.platformRole).toBeUndefined();
    expect(await grantsFor(user.uid)).toEqual([]);
  });

  it('VERIFY-003 even a claim forced onto an unverified account (bypassing the script) is not authority', async () => {
    await adminAuth.setCustomUserClaims(user.uid, { platformRole: 'app_owner' });
    const state = await refreshVerificationState(user);
    expect(state.claims.platformRole).toBe('app_owner');
    expect(state.emailVerified).toBe(false);
    expect(hasVerifiedOwnerClaim(state.claims, state.emailVerified)).toBe(false);
    expect((await ownerCallable(await asTestUser(user))).status).toBe('PERMISSION_DENIED');
    expect(await ownerOnlyRead()).toBe('permission-denied');
    await adminAuth.setCustomUserClaims(user.uid, null);
    expect((await refreshVerificationState(user)).claims.platformRole).toBeUndefined();
  });
});

describe('VERIFY: links, resend and refresh', () => {
  it('VERIFY-004 an invalid or used-up link is rejected with a useful message and changes nothing', async () => {
    const err = await applyActionCode(auth, 'not-a-real-code').catch((e) => e);
    expect(err.code).toBe('auth/invalid-action-code');
    expect(describeVerificationError(err).kind).toBe('INVALID_LINK');
    expect((await refreshVerificationState(user)).emailVerified).toBe(false);
  });

  it('VERIFY-005 resend issues a new verification link to the same address', async () => {
    await expect(sendVerificationEmail(user)).resolves.toEqual({ sent: true });
    expect(await verificationLinks(EMAIL)).toHaveLength(2);
  });

  it('VERIFY-006 opening the link verifies the account, but an old ID token stays unverified until refreshed', async () => {
    const [link] = (await verificationLinks(EMAIL)).slice(-1);
    const res = await fetch(link.oobLink); // what the user's mail client does
    expect(res.ok).toBe(true);
    expect((await adminAuth.getUser(user.uid)).emailVerified).toBe(true);

    // The token minted before verification still says false: the backend would not see the change.
    const stale = await adminAuth.verifyIdToken(tokenBeforeVerification);
    expect(stale.email_verified).toBe(false);

    const state = await refreshVerificationState(user);
    expect(state.emailVerified).toBe(true);
    expect(user.emailVerified).toBe(true);
    expect((await adminAuth.verifyIdToken(await user.getIdToken())).email_verified).toBe(true);
  });

  it('VERIFY-007 resending to a verified account sends nothing', async () => {
    const before = (await verificationLinks(EMAIL)).length;
    await expect(sendVerificationEmail(user)).resolves.toEqual({ sent: false, alreadyVerified: true });
    expect(await verificationLinks(EMAIL)).toHaveLength(before);
  });
});

describe('VERIFY: verification never grants authority by itself', () => {
  it('VERIFY-008 a verified account without the server claim is still not the App Owner', async () => {
    const state = await refreshVerificationState(user);
    expect(state.emailVerified).toBe(true);
    expect(state.claims.platformRole).toBeUndefined();
    expect(hasVerifiedOwnerClaim(state.claims, state.emailVerified)).toBe(false);
    expect((await ownerCallable(await asTestUser(user))).status).toBe('PERMISSION_DENIED');
    expect(await ownerOnlyRead()).toBe('permission-denied');
    expect((await verifyAppOwner(adminAuth, adminDb, { uid: user.uid })).isAppOwner).toBe(false);
    expect(await grantsFor(user.uid)).toEqual([]);
  });

  it('VERIFY-009 only the server/admin grant confers authority, and only on a token minted after it', async () => {
    const preGrant = await asTestUser(user, true);
    const granted = await setAppOwner({ auth: adminAuth, db: adminDb, email: EMAIL, actor: 'test@d29', projectId: PROJECT });
    expect(granted.action).toBe('APP_OWNER_GRANTED');
    expect(await grantsFor(user.uid)).toEqual(['APP_OWNER_GRANTED']);

    // A token minted before the grant carries no claim.
    expect((await ownerCallable(preGrant)).status).toBe('PERMISSION_DENIED');

    const state = await refreshVerificationState(user);
    expect(state.claims.platformRole).toBe('app_owner');
    expect(hasVerifiedOwnerClaim(state.claims, state.emailVerified)).toBe(true);
    expect((await ownerCallable(await asTestUser(user))).ok).toBe(true);
    expect(await ownerOnlyRead()).toBe('ALLOWED');
    expect((await verifyAppOwner(adminAuth, adminDb, { uid: user.uid })).isAppOwner).toBe(true);
  });

  it('VERIFY-010 after signing out and in again the account is verified and holds the granted claim', async () => {
    await signOut(auth);
    expect(auth.currentUser).toBeNull();
    const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    user = cred.user;
    expect(user.emailVerified).toBe(true);
    const claims = (await user.getIdTokenResult()).claims;
    expect(claims.email_verified).toBe(true);
    expect(hasVerifiedOwnerClaim(claims, user.emailVerified)).toBe(true);
  });
});

describe('VERIFY: invalid sessions', () => {
  it('VERIFY-011 a disabled or deleted account cannot refresh; the user is told to sign in again', async () => {
    await adminAuth.updateUser(user.uid, { disabled: true });
    const disabled = await refreshVerificationState(user).catch((e) => e);
    expect(describeVerificationError(disabled).kind).toBe('SESSION_EXPIRED');

    await adminAuth.deleteUser(user.uid);
    const deleted = await refreshVerificationState(user).catch((e) => e);
    expect(describeVerificationError(deleted).kind).toBe('SESSION_EXPIRED');
    await signOut(auth).catch(() => undefined);
  });
});
