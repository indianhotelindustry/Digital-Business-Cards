// ============================================================================
// Grant / revoke App Owner authority (Directive 24 Phase 2)
// ============================================================================
// App Owner is the custom claim platformRole == 'app_owner' on a Firebase Auth
// user with a VERIFIED email. It can only be set with Admin SDK credentials —
// never by registration, never by an email string, never from the browser.
//
//   npm run admin:set-app-owner -- --project <id> --confirm-project <id> --database <db> --email <email>
//   npm run admin:set-app-owner -- --project <id> --confirm-project <id> --database <db> --uid <uid> --revoke
//   npm run admin:set-app-owner -- --project <id> --confirm-project <id> --database <db> --email <email> --verify
// --database is mandatory for real projects (Directive 27): the production
// project hosts other apps' databases, so "(default)" is never assumed.
// --verify is read-only: it prints the account, its claims and its profile.
//
// Against the emulator, FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
// are honoured and --confirm-project is not needed for demo-* projects.
// Real projects use Application Default Credentials
// (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth application-default login`).

import { pathToFileURL } from 'node:url';
import { userInfo } from 'node:os';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { parseArgs, resolveAdminTarget } from './adminTarget';

export const APP_OWNER_CLAIM = 'platformRole';

export interface SetAppOwnerOptions {
  auth: Auth;
  db: Firestore;
  email?: string;
  uid?: string;
  revoke?: boolean;
  actor: string;
  projectId: string;
}

export async function setAppOwner(opts: SetAppOwnerOptions): Promise<{ uid: string; email: string | undefined; action: string }> {
  if (!opts.email && !opts.uid) throw new Error('Provide --email or --uid.');
  const user = opts.uid ? await opts.auth.getUser(opts.uid) : await opts.auth.getUserByEmail(opts.email!);

  const claims = { ...(user.customClaims || {}) } as Record<string, unknown>;
  const now = new Date().toISOString();

  if (opts.revoke) {
    delete claims[APP_OWNER_CLAIM];
    await opts.auth.setCustomUserClaims(user.uid, claims);
    // Stop new ID tokens being minted with the old claim.
    await opts.auth.revokeRefreshTokens(user.uid);
  } else {
    if (!user.emailVerified) {
      throw new Error(`Refusing to grant App Owner to ${user.email || user.uid}: email is not verified.`);
    }
    if (user.disabled) throw new Error(`Refusing to grant App Owner to disabled account ${user.uid}.`);
    claims[APP_OWNER_CLAIM] = 'app_owner';
    await opts.auth.setCustomUserClaims(user.uid, claims);

    const profileRef = opts.db.collection('users').doc(user.uid);
    const existing = await profileRef.get();
    if (existing.exists) {
      await profileRef.set({ role: 'app_owner', updatedAt: now }, { merge: true });
    } else {
      await profileRef.set({
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email || 'App Owner',
        role: 'app_owner',
        companyId: null,
        employeeId: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const action = opts.revoke ? 'APP_OWNER_REVOKED' : 'APP_OWNER_GRANTED';
  await opts.db.collection('securityAuditLogs').add({
    action,
    targetUid: user.uid,
    targetEmail: user.email || null,
    actor: opts.actor,
    source: 'scripts/admin/setAppOwner.ts',
    projectId: opts.projectId,
    timestamp: now,
  });

  return { uid: user.uid, email: user.email, action };
}

export interface AppOwnerVerification {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  disabled: boolean;
  claim: unknown;
  isAppOwner: boolean;
  tokensValidAfter: string | null;
  profileRole: string | null;
}

/** Read-only: does this account currently hold verified App Owner authority? */
export async function verifyAppOwner(auth: Auth, db: Firestore, who: { email?: string; uid?: string }): Promise<AppOwnerVerification> {
  if (!who.email && !who.uid) throw new Error('Provide --email or --uid.');
  const user = who.uid ? await auth.getUser(who.uid) : await auth.getUserByEmail(who.email!);
  const claim = user.customClaims?.[APP_OWNER_CLAIM];
  const profile = await db.collection('users').doc(user.uid).get();
  return {
    uid: user.uid,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    claim: claim ?? null,
    // Mirrors functions/src/auth/identity.ts: claim AND verified email (and not disabled).
    isAppOwner: claim === 'app_owner' && user.emailVerified && !user.disabled,
    tokensValidAfter: user.tokensValidAfterTime ?? null,
    profileRole: profile.exists ? ((profile.get('role') as string) ?? null) : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = resolveAdminTarget(args, 'grant-app-owner');
  const app = getApps()[0] || initializeApp({ projectId: target.projectId });
  if (args.verify === true) {
    const v = await verifyAppOwner(getAuth(app), getFirestore(app, target.databaseId), {
      email: typeof args.email === 'string' ? args.email : undefined,
      uid: typeof args.uid === 'string' ? args.uid : undefined,
    });
    console.log(JSON.stringify({ projectId: target.projectId, databaseId: target.databaseId, ...v }, null, 2));
    process.exit(v.isAppOwner ? 0 : 2);
  }
  const result = await setAppOwner({
    auth: getAuth(app),
    db: getFirestore(app, target.databaseId),
    email: typeof args.email === 'string' ? args.email : undefined,
    uid: typeof args.uid === 'string' ? args.uid : undefined,
    revoke: args.revoke === true,
    actor: `${userInfo().username}@admin-script`,
    projectId: target.projectId,
  });
  console.log(`${result.action}: ${result.email || ''} (${result.uid}) on ${target.projectId}${target.emulator ? ' [emulator]' : ''}`);
  if (result.action === 'APP_OWNER_REVOKED') {
    console.log('Note: ID tokens already issued stay valid until they expire (max 1 hour).');
  } else {
    console.log('The user must sign out and in again (or refresh their ID token) to receive the claim.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
