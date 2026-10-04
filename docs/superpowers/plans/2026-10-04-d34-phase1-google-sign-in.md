# D34 Phase 1 — Google Sign-In Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New DSBC sign-ins and registrations use Google (one service, four intents), free individuals and free companies become ACTIVE immediately through a backend registration callable, and existing password users keep working and can link Google to their same Firebase UID.

**Architecture:** A single client `googleAuthService` signs in with Firebase's Google provider (popup, redirect fallback). The client then asks the backend `resolveSession(intent)` where to go; the destination is computed by a pure, unit-tested `shared/domain/sessionRouting.ts`. Registration moves from a client Firestore batch to the backend `registerAccount` callable (Admin SDK, transaction, duplicate protection by UID and ownership, audited); Firestore rules close client-side creation of `users`, `tenants` and self-registered `companies`. The old password modal remains reachable as a login-only "existing account" path until Phase 3.

**Tech Stack:** React 19 + Vite, Firebase JS SDK (Auth, Firestore, Functions), Cloud Functions v2 (firebase-functions 7.4, esbuild bundle), Firestore rules, Vitest (unit / rules / backend emulator suites), Playwright (real Chrome against the Emulator Suite).

**Spec:** Directive 34 (founder, 2026-10-04) and `docs/directive-34/PLAN.md` (audit + locked phases).

## Global Constraints

- DSBC production is Firebase project `task360-ift`, Firestore `dsbc-production`, Functions region `asia-south1`. No other Firebase project is touched.
- Firebase Auth UID is the identity key; the Google email is an attribute. Access is never granted because an email matches.
- No production deploy without explicit founder approval immediately before it. `PAYMENTS_ENABLED=false` stays unchanged.
- No demo, dummy or fake users, companies, employees, cards, payments or Google accounts — in production or in committed fixtures that could reach it.
- Existing production identities (App Owner `qwDfeo2r7FXSoGMX11q3IiKKIRH2`, In Future Technologies owner `Xj7QfQem4LNxKtYILJslkmQ0SBG3`) must keep working throughout Phase 1; their password sign-in is not removed in Phase 1.
- Intents are exactly: `company_login`, `individual_login`, `register_company`, `create_free_card`. The intent is a routing hint only; authority comes from server records.
- New test ids use the `D34-AUTH-0xx` prefix (`AUTH-0xx` already exists from Directive 25).
- UI copy never shows raw Firebase or Cloud Function errors.
- Sign-in screen: `min-h-[100dvh]`, safe-area padding, touch targets ≥ 44px, works at 360px width and on desktop.
- Phase 1 offers the Free plan only at registration (paid plans are Phase 6; payments are off). Paid plans are shown as "available soon", not selectable.

## Review Focus

1. **A Google account whose email already belongs to a password DSBC account** (In Future Technologies owner on a Google Workspace domain): the user must get "sign in once with your existing account, then link Google" — never a second DSBC user, never an automatic merge by email. Pinned in Task 5 (`describeGoogleError` maps `auth/account-exists-with-different-credential`) and Task 3 (`registerAccount` refuses when a `users` doc already exists).
2. **Pop-up blocked or unavailable** (iOS Safari, in-app browsers): sign-in falls back to redirect and the chosen intent survives the round trip. Pinned in Task 5 (`signInWithGoogle` fallback test) and Task 6 (`completeGoogleRedirect` on load).
3. **Registering twice** (double-click, retry after a network error, second tab): exactly one user, one tenant, one company. Pinned in Task 3 (D34-AUTH-009 concurrent double call).
4. **An existing company owner pressing "Register as Company" or "Create Free Card"**: routed to the existing company, no new tenant. Pinned in Task 1 (`already_registered`) and Task 3.
5. **Signed-in Firebase user with no DSBC profile** (unknown Google account): sees "no DSBC account" / "not authorized as Company Owner or Admin" with the right next step — never the old "Awaiting approval" screen and never the marketing page loop. Pinned in Task 2 (`getMyAccountState` → `no_account`) and Task 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `shared/domain/sessionRouting.ts` (new) | Pure: intent + server facts → destination |
| `shared/domain/registrationModel.ts` (new, moved) | Pure: documents for a new account; status passed in |
| `src/services/registrationModel.ts` (modify) | Re-export the shared model (existing imports keep working) |
| `functions/src/auth/identity.ts` (modify) | `Caller.signInProvider` from the verified token |
| `functions/src/auth/session.ts` (new) | `resolveSession`, `registerAccount` |
| `functions/src/customers/activation.ts` (modify) | `getMyAccountState` → `no_account` for profile-less callers |
| `functions/src/index.ts` (modify) | export the two callables |
| `src/lib/backend.ts` (modify) | add the two callable names |
| `firestore.rules` (modify) | close client creates of `users`, `tenants`, self-registered `companies` |
| `src/services/googleAuthService.ts` (new) | sign in / link / redirect completion / error copy |
| `src/services/sessionService.ts` (new) | typed wrappers for `resolveSession`, `registerAccount` |
| `src/components/auth/SignInScreen.tsx` (new) | four entry points, Google button, destination states, registration forms |
| `src/components/auth/LinkGoogleBanner.tsx` (new) | password session → link Google |
| `src/components/views/IndividualHomeView.tsx` (new) | honest placeholder for individuals until Phase 4 (no demo fallback) |
| `src/components/auth/AuthModal.tsx` (modify) | login-only legacy path, register mode removed |
| `src/App.tsx`, `src/context/AuthContext.tsx`, `src/lib/accountGate.ts` (modify) | wiring, `no_account`, individual routing |
| tests (see each task) | unit, rules, backend, browser |

---

### Task 1: Pure session routing and shared registration model

**Files:**
- Create: `shared/domain/sessionRouting.ts`
- Create: `shared/domain/registrationModel.ts`
- Modify: `src/services/registrationModel.ts` (becomes a re-export)
- Test: `tests/unit/sessionRouting.test.ts`
- Test: `tests/unit/registrationModel.test.ts` (adjust to the `status` parameter)

**Interfaces:**
- Produces: `type SessionIntent = 'company_login' | 'individual_login' | 'register_company' | 'create_free_card'`; `SESSION_INTENTS: readonly SessionIntent[]`; `interface SessionFacts { isAppOwner: boolean; profile: null | { role: string | null; accountType: string | null; status: string | null; companyId: string | null }; companyStatus: string | null }`; `type Destination = { kind: 'app_owner_workspace' } | { kind: 'company_workspace' } | { kind: 'employee_workspace' } | { kind: 'individual_workspace' } | { kind: 'register_company' } | { kind: 'register_individual' } | { kind: 'already_registered'; existing: 'company' | 'individual' | 'employee' } | { kind: 'not_company_admin' } | { kind: 'no_account' } | { kind: 'account_inactive'; status: string }`; `resolveDestination(intent: SessionIntent, facts: SessionFacts): Destination`.
- Produces: `buildRegistrationDocuments(input: RegistrationInput & { status: AccountStatus }): RegistrationDocuments` in `shared/domain/registrationModel.ts` with the same ids as today (`ind_<uid>`, `co_<uid>`, plan `company_free`).

- [ ] **Step 1: Write the failing routing tests**

```ts
// tests/unit/sessionRouting.test.ts
import { describe, expect, it } from 'vitest';
import { resolveDestination, type SessionFacts } from '../../shared/domain/sessionRouting';

const none: SessionFacts = { isAppOwner: false, profile: null, companyStatus: null };
const admin = (status = 'active', companyStatus = 'active'): SessionFacts => ({
  isAppOwner: false, companyStatus,
  profile: { role: 'company_admin', accountType: 'company', status, companyId: 'co_x' },
});
const employee: SessionFacts = { isAppOwner: false, companyStatus: 'active', profile: { role: 'employee', accountType: 'company', status: 'active', companyId: 'co_x' } };
const individual: SessionFacts = { isAppOwner: false, companyStatus: null, profile: { role: 'employee', accountType: 'individual', status: 'active', companyId: null } };
const owner: SessionFacts = { isAppOwner: true, companyStatus: null, profile: { role: 'app_owner', accountType: null, status: 'active', companyId: null } };

describe('D34 session routing', () => {
  it('D34-AUTH-003 unknown Google user: company login is refused, individual login has no account', () => {
    expect(resolveDestination('company_login', none)).toEqual({ kind: 'not_company_admin' });
    expect(resolveDestination('individual_login', none)).toEqual({ kind: 'no_account' });
  });
  it('unknown Google user may register', () => {
    expect(resolveDestination('register_company', none)).toEqual({ kind: 'register_company' });
    expect(resolveDestination('create_free_card', none)).toEqual({ kind: 'register_individual' });
  });
  it('D34-AUTH-004 company owner/admin enters the company workspace', () => {
    expect(resolveDestination('company_login', admin())).toEqual({ kind: 'company_workspace' });
  });
  it('D34-AUTH-005 an employee is not a company admin', () => {
    expect(resolveDestination('company_login', employee)).toEqual({ kind: 'not_company_admin' });
    expect(resolveDestination('individual_login', employee)).toEqual({ kind: 'employee_workspace' });
  });
  it('individuals enter the individual workspace', () => {
    expect(resolveDestination('individual_login', individual)).toEqual({ kind: 'individual_workspace' });
  });
  it('a company admin using "Join / Login to Account" is sent to their real context', () => {
    expect(resolveDestination('individual_login', admin())).toEqual({ kind: 'company_workspace' });
  });
  it('D34-AUTH-009 existing accounts never register again', () => {
    expect(resolveDestination('register_company', admin())).toEqual({ kind: 'already_registered', existing: 'company' });
    expect(resolveDestination('create_free_card', admin())).toEqual({ kind: 'already_registered', existing: 'company' });
    expect(resolveDestination('register_company', individual)).toEqual({ kind: 'already_registered', existing: 'individual' });
    expect(resolveDestination('create_free_card', employee)).toEqual({ kind: 'already_registered', existing: 'employee' });
  });
  it('D34-AUTH-022 inactive accounts and suspended companies are restricted for every intent', () => {
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card'] as const) {
      expect(resolveDestination(intent, admin('suspended'))).toEqual({ kind: 'account_inactive', status: 'suspended' });
      expect(resolveDestination(intent, admin('active', 'suspended'))).toEqual({ kind: 'account_inactive', status: 'suspended' });
    }
  });
  it('legacy pending_approval is reported as pending_activation', () => {
    expect(resolveDestination('company_login', admin('pending_approval'))).toEqual({ kind: 'account_inactive', status: 'pending_activation' });
  });
  it('D34-AUTH-019 the App Owner always reaches the App Owner workspace', () => {
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card'] as const) {
      expect(resolveDestination(intent, owner)).toEqual({ kind: 'app_owner_workspace' });
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/sessionRouting.test.ts`
Expected: FAIL — `Cannot find module '../../shared/domain/sessionRouting'`.

- [ ] **Step 3: Implement `shared/domain/sessionRouting.ts`**

```ts
// Directive 34 Phase 1: where a signed-in Google identity goes. Pure; the
// backend feeds it server records (never browser state). The intent is only
// the entry point the person chose; it never grants anything.
export type SessionIntent = 'company_login' | 'individual_login' | 'register_company' | 'create_free_card';
export const SESSION_INTENTS: readonly SessionIntent[] = ['company_login', 'individual_login', 'register_company', 'create_free_card'];

export interface SessionFacts {
  isAppOwner: boolean;
  profile: null | { role: string | null; accountType: string | null; status: string | null; companyId: string | null };
  companyStatus: string | null;
}

export type Destination =
  | { kind: 'app_owner_workspace' }
  | { kind: 'company_workspace' }
  | { kind: 'employee_workspace' }
  | { kind: 'individual_workspace' }
  | { kind: 'register_company' }
  | { kind: 'register_individual' }
  | { kind: 'already_registered'; existing: 'company' | 'individual' | 'employee' }
  | { kind: 'not_company_admin' }
  | { kind: 'no_account' }
  | { kind: 'account_inactive'; status: string };

const normalised = (status: string | null) => (status === 'pending_approval' ? 'pending_activation' : status || 'pending_activation');

export function resolveDestination(intent: SessionIntent, facts: SessionFacts): Destination {
  if (facts.isAppOwner) return { kind: 'app_owner_workspace' };
  const p = facts.profile;
  if (!p) {
    if (intent === 'register_company') return { kind: 'register_company' };
    if (intent === 'create_free_card') return { kind: 'register_individual' };
    return intent === 'company_login' ? { kind: 'not_company_admin' } : { kind: 'no_account' };
  }
  if (p.status !== 'active') return { kind: 'account_inactive', status: normalised(p.status) };
  if (p.companyId && facts.companyStatus !== 'active') return { kind: 'account_inactive', status: normalised(facts.companyStatus) };

  const existing: 'company' | 'individual' | 'employee' =
    p.role === 'company_admin' ? 'company' : p.accountType === 'individual' && !p.companyId ? 'individual' : 'employee';
  if (intent === 'register_company' || intent === 'create_free_card') return { kind: 'already_registered', existing };
  if (existing === 'company') return { kind: 'company_workspace' };
  if (intent === 'company_login') return { kind: 'not_company_admin' };
  return existing === 'individual' ? { kind: 'individual_workspace' } : { kind: 'employee_workspace' };
}
```

- [ ] **Step 4: Move the registration model to `shared/domain/registrationModel.ts`**

Copy the body of today's `src/services/registrationModel.ts` into `shared/domain/registrationModel.ts` with these changes: declare local types instead of importing from `src/types` (`AccountType = 'individual' | 'company'`, a `RegistrationUser` interface with exactly the 11 fields the rules list today: `id, email, displayName, role, companyId, employeeId, status, accountType, tenantId, createdAt, updatedAt`, and a `RegistrationCompany` interface with the fields `buildRegistrationDocuments` writes today); add `status: AccountStatus` to `RegistrationInput` and use `input.status` everywhere `INITIAL_ACCOUNT_STATUS` was used. Then replace `src/services/registrationModel.ts` with:

```ts
// Moved to shared/domain (Directive 34): the backend registerAccount callable builds the same documents.
export * from '../../shared/domain/registrationModel';
```

In `tests/unit/registrationModel.test.ts`, pass `status: 'pending_approval'` wherever the existing tests call `buildRegistrationDocuments`, and add:

```ts
it('D34-AUTH-010/011 the status is chosen by the caller (free registration is active)', () => {
  const docs = buildRegistrationDocuments({ uid: 'u1', email: 'a@b.c', displayName: 'A', accountType: 'company', companyName: 'Acme', status: 'active' });
  expect([docs.user.status, docs.tenant.status, docs.company!.status]).toEqual(['active', 'active', 'active']);
});
```

- [ ] **Step 5: Run the unit suite**

Run: `npm run test:unit`
Expected: all pass (previous total + the new tests); `npm run typecheck` and `npm --prefix functions run typecheck` clean.

- [ ] **Step 6: Commit**

```bash
git add shared/domain/sessionRouting.ts shared/domain/registrationModel.ts src/services/registrationModel.ts tests/unit/sessionRouting.test.ts tests/unit/registrationModel.test.ts
git commit -m "feat(d34): pure session routing and shared registration model"
```

---

### Task 2: Caller provider and `no_account` account state

**Files:**
- Modify: `functions/src/auth/identity.ts` (`Caller`, `loadCaller`)
- Modify: `functions/src/customers/activation.ts` (`getMyAccountState`)
- Modify: `src/lib/accountGate.ts` (unchanged logic; add a comment that `no_account` is not "awaiting")
- Test: `tests/backend/d34-session.test.ts` (new file; first tests here)
- Test: `tests/backend/support/backendEnv.ts` (add `createGoogleUser`)

**Interfaces:**
- Produces: `Caller.signInProvider: string | null` (from `token.firebase.sign_in_provider`).
- Produces: `getMyAccountState` returns `{ status: 'no_account' | <profile status>, emailVerified }`.
- Produces (test harness): `createGoogleUser(sub: string, email: string): Promise<TestUser>` — signs in through the Auth emulator's `signInWithIdp` with an unsigned test Google credential, so the ID token carries `sign_in_provider: 'google.com'`.

- [ ] **Step 1: Add the Google identity helper to the harness**

```ts
// tests/backend/support/backendEnv.ts — after idToken()
/** A real Auth-emulator Google identity (sign_in_provider = google.com). Emulator only. */
export async function createGoogleUser(sub: string, email: string): Promise<TestUser> {
  const idTokenJson = JSON.stringify({ sub, email, email_verified: true, name: sub });
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=emulator-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(idTokenJson)}&providerId=google.com`,
      requestUri: 'http://localhost',
      returnSecureToken: true,
      returnIdpCredential: true,
    }),
  });
  const body = (await res.json()) as { idToken?: string; localId?: string; error?: unknown };
  if (!body.idToken || !body.localId) throw new Error(`Google emulator sign-in failed for ${email}: ${JSON.stringify(body.error)}`);
  return { uid: body.localId, email, token: body.idToken };
}
```

- [ ] **Step 2: Write the failing backend tests**

```ts
// tests/backend/d34-session.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { call, createGoogleUser, createUser, ok, resetEmulators } from './support/backendEnv';

beforeAll(async () => {
  await resetEmulators();
});

describe('D34 account state', () => {
  it('a signed-in identity without a DSBC profile is no_account, not pending approval', async () => {
    const g = await createGoogleUser('g-no-profile', 'nobody@example.test');
    expect(await ok('getMyAccountState', {}, g)).toEqual({ status: 'no_account', emailVerified: true });
  });
  it('getMyAccountState still requires sign-in', async () => {
    expect((await call('getMyAccountState', {}, null)).status).toBe('UNAUTHENTICATED');
  });
  it('a password identity is still accepted in Phase 1', async () => {
    const u = await createUser('u-pw');
    expect((await ok('getMyAccountState', {}, u)).status).toBe('no_account');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node scripts/directive25/runBackendTests.mjs tests/backend/d34-session.test.ts`
Expected: FAIL — `status` is `'pending_approval'`.

- [ ] **Step 4: Implement**

In `functions/src/auth/identity.ts` add `signInProvider: string | null;` to `Caller`, and in `loadCaller`:

```ts
  const firebaseClaims = (token.firebase as { sign_in_provider?: string } | undefined) || undefined;
  return {
    uid: auth!.uid,
    email: (token.email as string) || null,
    emailVerified,
    signInProvider: firebaseClaims?.sign_in_provider || null,
    isAppOwner: token[APP_OWNER_CLAIM] === 'app_owner' && emailVerified,
    profile: snap.exists ? ({ id: snap.id, ...snap.data() } as ProfileDoc) : null,
  };
```

In `functions/src/customers/activation.ts`:

```ts
/** Auth required; deliberately NOT gated on active status. A signed-in identity with no DSBC profile is `no_account`. */
export async function getMyAccountState(caller: Caller) {
  if (!caller.uid) deny('Sign in required.');
  return { status: caller.profile?.status ?? 'no_account', emailVerified: caller.emailVerified };
}
```

Search for other `Caller` object literals (`grep -rn "isAppOwner:" functions/src tests/backend`) and add `signInProvider: null` where a `Caller` is built by hand.

- [ ] **Step 5: Update the D30 tests that asserted the old default**

Run `grep -n "REG-021" tests/backend/activation.test.ts` and keep their assertions for users that HAVE a pending profile (unchanged behaviour); no existing test asserts the profile-less default (D30 audit), so none should need a new expectation. Run the file to confirm.

- [ ] **Step 6: Run and commit**

Run: `node scripts/directive25/runBackendTests.mjs tests/backend/d34-session.test.ts tests/backend/activation.test.ts`
Expected: PASS.

```bash
git add functions/src/auth/identity.ts functions/src/customers/activation.ts tests/backend/support/backendEnv.ts tests/backend/d34-session.test.ts
git commit -m "feat(d34): caller sign-in provider; profile-less identities are no_account"
```

---

### Task 3: Backend `resolveSession` and `registerAccount`

**Files:**
- Create: `functions/src/auth/session.ts`
- Modify: `functions/src/index.ts` (export callables)
- Modify: `src/lib/backend.ts` (`BACKEND_CALLABLES` += `resolveSession`, `registerAccount`)
- Test: `tests/backend/d34-session.test.ts` (extend)

**Interfaces:**
- Consumes: `resolveDestination`, `SESSION_INTENTS` (Task 1); `buildRegistrationDocuments` (Task 1); `Caller.signInProvider` (Task 2).
- Produces: callable `resolveSession({ intent })` → `{ destination: Destination; displayName: string | null; companyName: string | null }`.
- Produces: callable `registerAccount({ intent: 'register_company' | 'create_free_card', displayName: string, companyName?: string })` → `{ created: boolean; destination: Destination }`.

- [ ] **Step 1: Write the failing tests (append to `tests/backend/d34-session.test.ts`)**

```ts
import { adminDb } from './support/backendEnv';

describe('D34 registerAccount / resolveSession', () => {
  it('D34-AUTH-011 free company: one user, tenant and company, all ACTIVE, owned by the Google UID', async () => {
    const g = await createGoogleUser('g-co', 'owner@acme.test');
    const r = await ok('registerAccount', { intent: 'register_company', displayName: 'Asha Owner', companyName: 'Acme Ltd' }, g);
    expect(r).toEqual({ created: true, destination: { kind: 'company_workspace' } });
    const user = (await adminDb.doc(`users/${g.uid}`).get()).data()!;
    expect(user).toMatchObject({ id: g.uid, role: 'company_admin', companyId: `co_${g.uid}`, status: 'active', email: 'owner@acme.test' });
    expect((await adminDb.doc(`tenants/co_${g.uid}`).get()).get('status')).toBe('active');
    expect((await adminDb.doc(`companies/co_${g.uid}`).get()).data()).toMatchObject({ ownerUid: g.uid, status: 'active', planId: 'company_free', name: 'Acme Ltd' });
    const audits = await adminDb.collection('commercialAuditLogs').where('targetId', '==', g.uid).where('action', '==', 'ACCOUNT_ACTIVATED').get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0].get('reason')).toContain('Free plan');
  });

  it('D34-AUTH-010 free individual is ACTIVE immediately, no approval queue entry', async () => {
    const g = await createGoogleUser('g-ind', 'me@person.test');
    const r = await ok('registerAccount', { intent: 'create_free_card', displayName: 'Ravi' }, g);
    expect(r.destination).toEqual({ kind: 'individual_workspace' });
    expect((await adminDb.doc(`users/${g.uid}`).get()).data()).toMatchObject({ accountType: 'individual', companyId: null, status: 'active' });
    expect((await adminDb.collection('users').where('status', '==', 'pending_approval').get()).size).toBe(0);
  });

  it('D34-AUTH-009 / 030 registering twice (also concurrently) creates nothing new', async () => {
    const g = await createGoogleUser('g-dup', 'dup@acme.test');
    const [a, b] = await Promise.all([
      call('registerAccount', { intent: 'register_company', displayName: 'D', companyName: 'Dup Co' }, g),
      call('registerAccount', { intent: 'register_company', displayName: 'D', companyName: 'Dup Co 2' }, g),
    ]);
    const created = [a, b].filter((r) => r.ok && r.data.created).length;
    expect(created).toBe(1);
    const again = await ok('registerAccount', { intent: 'create_free_card', displayName: 'D' }, g);
    expect(again).toEqual({ created: false, destination: { kind: 'already_registered', existing: 'company' } });
    expect((await adminDb.collection('companies').where('ownerUid', '==', g.uid).get()).size).toBe(1);
    expect((await adminDb.collection('tenants').where('ownerUid', '==', g.uid).get()).size).toBe(1);
  });

  it('D34-AUTH-031 (Phase 1 scope) registration requires a Google sign-in', async () => {
    const pw = await createUser('u-pw-reg');
    const r = await call('registerAccount', { intent: 'create_free_card', displayName: 'P' }, pw);
    expect(r.status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc(`users/${pw.uid}`).get()).exists).toBe(false);
  });

  it('D34-AUTH-023 the payload cannot choose role, company, plan or status', async () => {
    const g = await createGoogleUser('g-forge', 'forge@acme.test');
    for (const extra of [{ role: 'app_owner' }, { companyId: 'co_other' }, { planId: 'company_pro' }, { status: 'active' }]) {
      const r = await call('registerAccount', { intent: 'register_company', displayName: 'F', companyName: 'F', ...extra }, g);
      expect(r.status).toBe('INVALID_ARGUMENT');
    }
    expect((await adminDb.doc(`users/${g.uid}`).get()).exists).toBe(false);
  });

  it('validates names', async () => {
    const g = await createGoogleUser('g-names', 'names@acme.test');
    expect((await call('registerAccount', { intent: 'register_company', displayName: 'N', companyName: '' }, g)).status).toBe('INVALID_ARGUMENT');
    expect((await call('registerAccount', { intent: 'register_company', displayName: 'N', companyName: 'x'.repeat(121) }, g)).status).toBe('INVALID_ARGUMENT');
    expect((await call('registerAccount', { intent: 'company_login', displayName: 'N' }, g)).status).toBe('INVALID_ARGUMENT');
  });

  it('D34-AUTH-001/002/004 resolveSession reads server records for the token UID', async () => {
    const g = await createGoogleUser('g-co', 'owner@acme.test'); // same sub as the first test → same UID
    const s = await ok('resolveSession', { intent: 'company_login' }, g);
    expect(s).toEqual({ destination: { kind: 'company_workspace' }, displayName: 'Asha Owner', companyName: 'Acme Ltd' });
  });

  it('D34-AUTH-003/005 an unknown Google identity is not a company admin and reads nothing', async () => {
    const g = await createGoogleUser('g-stranger', 'stranger@else.test');
    expect(await ok('resolveSession', { intent: 'company_login' }, g)).toEqual({ destination: { kind: 'not_company_admin' }, displayName: null, companyName: null });
  });

  it('D34-AUTH-019/020 existing password accounts (App Owner, company owner) still resolve', async () => {
    const owner = await createUser('u-app-owner', { claims: { platformRole: 'app_owner' } });
    await adminDb.doc('users/u-app-owner').set({ id: 'u-app-owner', role: 'app_owner', status: 'active', companyId: null, employeeId: null, displayName: 'Owner', email: owner.email });
    expect((await ok('resolveSession', { intent: 'company_login' }, owner)).destination).toEqual({ kind: 'app_owner_workspace' });

    const admin = await createUser('u-ift');
    await adminDb.doc('companies/co_u-ift').set({ id: 'co_u-ift', name: 'Existing Co', status: 'active', ownerUid: 'u-ift', planId: 'company_free', kind: 'company' });
    await adminDb.doc('users/u-ift').set({ id: 'u-ift', role: 'company_admin', status: 'active', companyId: 'co_u-ift', employeeId: null, displayName: 'IFT', email: admin.email, accountType: 'company' });
    expect((await ok('resolveSession', { intent: 'company_login' }, admin)).destination).toEqual({ kind: 'company_workspace' });
  });

  it('D34-AUTH-022 a suspended company is restricted', async () => {
    const g = await createGoogleUser('g-susp', 'susp@acme.test');
    await ok('registerAccount', { intent: 'register_company', displayName: 'S', companyName: 'Susp Co' }, g);
    await adminDb.doc(`companies/co_${g.uid}`).update({ status: 'suspended' });
    expect((await ok('resolveSession', { intent: 'company_login' }, g)).destination).toEqual({ kind: 'account_inactive', status: 'suspended' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/directive25/runBackendTests.mjs tests/backend/d34-session.test.ts`
Expected: FAIL — `registerAccount` / `resolveSession` not found (NOT_FOUND / non-JSON 404).

- [ ] **Step 3: Implement `functions/src/auth/session.ts`**

```ts
// ============================================================================
// Google sign-in sessions and backend registration (Directive 34 Phase 1)
// ============================================================================
// resolveSession: where a signed-in identity goes, from server records only.
// registerAccount: creates a FREE individual or company for the caller's
// Firebase UID — ACTIVE immediately (free accounts need no approval). The
// payload carries names and the entry intent only; role, ids, plan and status
// are derived here. Idempotent by UID: a second call creates nothing.
import { db } from '../shared/firebase';
import { deny, invalid } from '../shared/errors';
import { obj, oneOf, str } from '../shared/validate';
import { serverNow } from '../shared/time';
import { appendAudit } from '../audit/ledger';
import { actorOf, type Caller } from './identity';
import { resolveDestination, SESSION_INTENTS, type SessionFacts } from '../../../shared/domain/sessionRouting';
import { buildRegistrationDocuments, MAX_NAME_LENGTH } from '../../../shared/domain/registrationModel';

async function factsFor(caller: Caller): Promise<{ facts: SessionFacts; companyName: string | null }> {
  const p = caller.profile;
  let companyStatus: string | null = null;
  let companyName: string | null = null;
  if (p?.companyId) {
    const company = await db().collection('companies').doc(p.companyId).get();
    companyStatus = company.exists ? (company.get('status') as string) : null;
    companyName = company.exists ? ((company.get('name') as string) || null) : null;
  }
  return {
    companyName,
    facts: {
      isAppOwner: caller.isAppOwner,
      profile: p ? { role: p.role ?? null, accountType: p.accountType ?? null, status: p.status ?? null, companyId: p.companyId ?? null } : null,
      companyStatus,
    },
  };
}

export async function resolveSession(caller: Caller, data: unknown) {
  const intent = oneOf(obj(data, ['intent']), 'intent', SESSION_INTENTS);
  const { facts, companyName } = await factsFor(caller);
  return { destination: resolveDestination(intent, facts), displayName: caller.profile?.displayName ?? null, companyName };
}

export async function registerAccount(caller: Caller, data: unknown) {
  const p = obj(data, ['intent', 'displayName', 'companyName']);
  const intent = oneOf(p, 'intent', ['register_company', 'create_free_card'] as const);
  const displayName = str(p, 'displayName', { max: MAX_NAME_LENGTH }).trim();
  const companyName = intent === 'register_company' ? str(p, 'companyName', { max: MAX_NAME_LENGTH }).trim() : undefined;
  if (!displayName) invalid('displayName is required.');
  if (intent === 'register_company' && !companyName) invalid('companyName is required.');
  if (caller.signInProvider !== 'google.com') deny('Register with Google.');
  if (!caller.email || !caller.emailVerified) deny('A verified Google email is required.');

  const accountType = intent === 'register_company' ? 'company' : 'individual';
  const docs = buildRegistrationDocuments({ uid: caller.uid, email: caller.email!, displayName, accountType, companyName, status: 'active' });
  const userRef = db().collection('users').doc(caller.uid);

  const created = await db().runTransaction(async (tx) => {
    const [user, owned] = await Promise.all([tx.get(userRef), tx.get(db().collection('companies').where('ownerUid', '==', caller.uid).limit(1))]);
    if (user.exists || !owned.empty) return false; // duplicate protection: never a second account for this UID
    if (docs.company) tx.create(db().collection('companies').doc(docs.company.id), { ...docs.company, createdAt: serverNow(), updatedAt: serverNow() });
    tx.create(db().collection('tenants').doc(docs.tenant.id), { ...docs.tenant, commercial: { state: 'free', method: 'free' } });
    tx.create(userRef, docs.user);
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'ACCOUNT_ACTIVATED', actor: actorOf(caller), targetType: accountType, targetId: caller.uid, tenantId: docs.tenant.id,
      previousValue: null, newValue: { status: 'active', commercialState: 'free' },
      reason: 'Free plan: immediate activation (Google registration)', source: 'Registration',
    });
    return true;
  });

  // Destination from the records as they are now: a new account goes to its
  // workspace; an existing one is reported as already registered.
  const fresh = await userRef.get();
  const { facts } = await factsFor({ ...caller, profile: fresh.exists ? ({ id: fresh.id, ...fresh.data() } as Caller['profile']) : null });
  const destination = created
    ? resolveDestination(intent === 'register_company' ? 'company_login' : 'individual_login', facts)
    : resolveDestination(intent, facts);
  return { created, destination };
}
```

`deny` and `invalid` come from `functions/src/shared/errors.ts` (both exist).


- [ ] **Step 4: Export and register the callables**

In `functions/src/index.ts`, next to the activation callables:

```ts
import * as session from './auth/session';
// ---- Sessions & registration (Directive 34) --------------------------------
export const resolveSession = callable(session.resolveSession);
export const registerAccount = callable(session.registerAccount);
```

In `src/lib/backend.ts` add `'resolveSession', 'registerAccount',` to `BACKEND_CALLABLES` under "Customer-facing".

- [ ] **Step 5: Run backend + contract tests**

Run: `node scripts/directive25/runBackendTests.mjs tests/backend/d34-session.test.ts` then `npx vitest run tests/unit/backendContract.test.ts tests/unit/functionsRegion.test.ts`
Expected: PASS (REGION-001 confirms both new callables land in the configured region).

- [ ] **Step 6: Commit**

```bash
git add functions/src/auth/session.ts functions/src/index.ts src/lib/backend.ts tests/backend/d34-session.test.ts
git commit -m "feat(d34): resolveSession and registerAccount (free accounts active immediately, idempotent by UID)"
```

---

### Task 4: Firestore rules close client-side registration

**Files:**
- Modify: `firestore.rules` (users create, tenants create, companies create)
- Modify: `tests/rules/activation-gate.test.ts` (REG-001 positive controls become denials)
- Modify: `tests/rules/phase2-identity.test.ts` (registration-attack tests keep asserting denial; any positive "valid registration succeeds" control flips to denied)
- Test: `tests/rules/d34-registration-closed.test.ts` (new)

**Interfaces:**
- Consumes: Task 3 (registration now exists server-side).
- Produces: rules where `users` and `tenants` have `allow create: if false;` and `companies` has `allow create: if isAppOwner();`.

- [ ] **Step 1: Write the failing rules test**

Use the existing rules harness (`tests/rules/support/` — mirror the imports at the top of `tests/rules/activation-gate.test.ts`):

```ts
// tests/rules/d34-registration-closed.test.ts
// D34-AUTH-023: a browser can no longer create its own account, tenant or company.
it('D34-AUTH-023 a signed-in browser cannot create users/tenants/companies for itself', async () => {
  const db = authed('newbie', { email: 'newbie@x.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } });
  const now = new Date().toISOString();
  await assertFails(setDoc(doc(db, 'users/newbie'), { id: 'newbie', email: 'newbie@x.test', displayName: 'N', role: 'company_admin', companyId: 'co_newbie', employeeId: null, status: 'active', accountType: 'company', tenantId: 'co_newbie', createdAt: now, updatedAt: now }));
  await assertFails(setDoc(doc(db, 'tenants/co_newbie'), { id: 'co_newbie', kind: 'company', ownerUid: 'newbie', companyId: 'co_newbie', status: 'active', createdAt: now }));
  await assertFails(setDoc(doc(db, 'companies/co_newbie'), { id: 'co_newbie', name: 'N', ownerUid: 'newbie', kind: 'company', status: 'pending_approval', planId: 'company_free' }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:rules -- tests/rules/d34-registration-closed.test.ts`
Expected: FAIL on the `companies` create (today a pending self-registration batch is allowed). If the npm script does not forward file filters, run `node_modules/.bin/firebase emulators:exec --only firestore --project demo-dsbc "npx vitest run --config vitest.rules.config.ts tests/rules/d34-registration-closed.test.ts"`.

- [ ] **Step 3: Change the rules**

In `firestore.rules`: `match /users/{userId}` → `allow create: if false;` with the comment `// Directive 34: accounts are created by the backend (registerAccount), never by a browser.`; `match /tenants/{tenantId}` → `allow create: if false;`; `match /companies/{companyId}` → `allow create: if isAppOwner();` (the App Owner's client-side create stays until Phase 2 replaces it). Delete the now-unused helpers `isRegistrationInProgress`, `isValidRegistrationProfile`, `isValidTenantRecord`, `isValidSelfRegisteredCompany`.

- [ ] **Step 4: Update the existing rules tests**

`grep -n "REG-001\|registration batch\|isValidRegistration\|pending registration" tests/rules/*.ts`. For each positive control that expected a self-registration batch to succeed, change `assertSucceeds` to `assertFails` and rename the case to say registration is backend-only (D34). Leave every existing attack test asserting denial as is.

- [ ] **Step 5: Run the whole rules suite**

Run: `npm run test:rules`
Expected: PASS: N/N (record N in the phase report).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/
git commit -m "feat(d34): firestore.rules close browser-side account, tenant and company creation"
```

---

### Task 5: Client Google auth service and session service

**Files:**
- Create: `src/services/googleAuthService.ts`
- Create: `src/services/sessionService.ts`
- Test: `tests/unit/googleAuthService.test.ts`

**Interfaces:**
- Produces: `signInWithGoogle(intent: SessionIntent): Promise<User | 'redirecting'>`; `completeGoogleRedirect(): Promise<{ user: User; intent: SessionIntent | null } | null>`; `linkGoogleToCurrentUser(): Promise<'linked' | 'already_linked'>`; `hasGoogleProvider(user: User | null): boolean`; `describeGoogleError(err: unknown): { code: string; message: string; cancelled: boolean }`.
- Produces: `sessionService.resolve(intent): Promise<{ destination: Destination; displayName: string | null; companyName: string | null }>`; `sessionService.register(input: { intent: 'register_company' | 'create_free_card'; displayName: string; companyName?: string }): Promise<{ created: boolean; destination: Destination }>`.

- [ ] **Step 1: Write the failing unit tests (pure parts)**

```ts
// tests/unit/googleAuthService.test.ts
import { describe, expect, it } from 'vitest';
import { describeGoogleError, hasGoogleProvider } from '../../src/services/googleAuthService';

describe('google auth service', () => {
  it('cancellation is quiet', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      expect(describeGoogleError({ code })).toMatchObject({ cancelled: true });
    }
  });
  it('an email that already has a DSBC account is told to sign in once and link, never merged', () => {
    const e = describeGoogleError({ code: 'auth/account-exists-with-different-credential' });
    expect(e.cancelled).toBe(false);
    expect(e.message).toMatch(/existing account/i);
    expect(e.message).toMatch(/link/i);
  });
  it('a Google account already used by another sign-in is never merged', () => {
    expect(describeGoogleError({ code: 'auth/credential-already-in-use' }).message).toMatch(/different Google account/i);
  });
  it('raw Firebase text never reaches the user', () => {
    const e = describeGoogleError({ code: 'auth/internal-error', message: 'Firebase: INTERNAL ASSERTION FAILED (auth/internal-error).' });
    expect(e.message).not.toMatch(/Firebase|auth\//);
  });
  it('detects a linked Google provider', () => {
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }] } as never)).toBe(false);
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] } as never)).toBe(true);
    expect(hasGoogleProvider(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/googleAuthService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/services/googleAuthService.ts`**

```ts
// ============================================================================
// Google authentication (Directive 34 Phase 1)
// ============================================================================
// The ONE place DSBC talks to the Firebase Google provider. Every entry point
// (company login, join/login, register company, create free card) uses it;
// the intent only tells the app which screen to show next — the backend
// decides what the identity may do (resolveSession).
import { getRedirectResult, GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithRedirect, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { SessionIntent } from '../../shared/domain/sessionRouting';
import { SESSION_INTENTS } from '../../shared/domain/sessionRouting';

const INTENT_KEY = 'dsbc_google_intent'; // UI hint across a redirect only; never authority

function provider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

const REDIRECT_FALLBACK = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported']);

export async function signInWithGoogle(intent: SessionIntent): Promise<User | 'redirecting'> {
  try {
    return (await signInWithPopup(auth, provider())).user;
  } catch (err) {
    if (!REDIRECT_FALLBACK.has((err as { code?: string }).code || '')) throw err;
    try {
      sessionStorage.setItem(INTENT_KEY, intent);
    } catch {
      /* storage unavailable: the user re-chooses the entry point after returning */
    }
    await signInWithRedirect(auth, provider());
    return 'redirecting';
  }
}

export async function completeGoogleRedirect(): Promise<{ user: User; intent: SessionIntent | null } | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  let intent: SessionIntent | null = null;
  try {
    const stored = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    intent = SESSION_INTENTS.includes(stored as SessionIntent) ? (stored as SessionIntent) : null;
  } catch {
    intent = null;
  }
  return { user: result.user, intent };
}

/** Link Google to the signed-in (password) account: same Firebase UID, user-mediated, never by email matching. */
export async function linkGoogleToCurrentUser(): Promise<'linked' | 'already_linked'> {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' });
  if (hasGoogleProvider(user)) return 'already_linked';
  await linkWithPopup(user, provider());
  await user.getIdToken(true);
  return 'linked';
}

export function hasGoogleProvider(user: Pick<User, 'providerData'> | null): boolean {
  return !!user?.providerData?.some((p) => p?.providerId === 'google.com');
}

const MESSAGES: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'This email already has a DSBC account. Use "Existing account? Sign in with email" once, then choose "Link Google" — your account and data stay the same.',
  'auth/credential-already-in-use': 'That Google account is already used by a different DSBC sign-in. Choose a different Google account.',
  'auth/provider-already-linked': 'Google is already linked to this account.',
  'auth/unauthorized-domain': 'Google sign-in is not available on this address. Please use the official DSBC link.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact DSBC support.',
};
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

export function describeGoogleError(err: unknown): { code: string; message: string; cancelled: boolean } {
  const code = (err as { code?: string })?.code || 'unknown';
  if (CANCELLED.has(code)) return { code, message: 'Google sign-in was cancelled.', cancelled: true };
  return { code, message: MESSAGES[code] || 'Google sign-in did not complete. Please try again.', cancelled: false };
}
```

- [ ] **Step 4: Implement `src/services/sessionService.ts`**

```ts
import { callBackend } from '../lib/backend';
import type { Destination, SessionIntent } from '../../shared/domain/sessionRouting';

export interface SessionInfo { destination: Destination; displayName: string | null; companyName: string | null }

export const sessionService = {
  resolve: (intent: SessionIntent) => callBackend<SessionInfo>('resolveSession', { intent }),
  register: (input: { intent: 'register_company' | 'create_free_card'; displayName: string; companyName?: string }) =>
    callBackend<{ created: boolean; destination: Destination }>('registerAccount', input),
};
```

- [ ] **Step 5: Run and commit**

Run: `npx vitest run tests/unit/googleAuthService.test.ts && npm run typecheck`
Expected: PASS, typecheck clean.

```bash
git add src/services/googleAuthService.ts src/services/sessionService.ts tests/unit/googleAuthService.test.ts
git commit -m "feat(d34): one Google auth service (popup, redirect fallback, linking, error copy) + session service"
```

---

### Task 6: Sign-in screen, registration forms and app wiring

**Files:**
- Create: `src/components/auth/SignInScreen.tsx`
- Create: `src/components/views/IndividualHomeView.tsx`
- Modify: `src/components/auth/AuthModal.tsx` (login only: delete the register branch, Individual/Company toggle and registration error copy; title "Sign in with your existing email account")
- Modify: `src/App.tsx` (entry handlers open `SignInScreen` with an intent; signed-in identity with `accountStatus === 'no_account'` shows `SignInScreen` in its post-sign-in state; individuals route to `IndividualHomeView`)
- Modify: `src/context/AuthContext.tsx` (call `completeGoogleRedirect()` once on mount; expose `pendingIntent`)
- Delete: `src/components/auth/CustomerRegistrationModal.tsx` (dead code, password registration)
- Test: `tests/e2e/d34-google-sign-in.spec.ts` (Task 8 drives it)

**Interfaces:**
- Consumes: `signInWithGoogle`, `completeGoogleRedirect`, `describeGoogleError` (Task 5); `sessionService` (Task 5); `Destination` (Task 1); `refreshUserData`, `refreshAccountStatus`, `logoutUser` (existing AuthContext).
- Produces: `<SignInScreen initialIntent?: SessionIntent | null; onClose(): void; onEnterWorkspace(): void; onOpenLegacyLogin(): void />`.

- [ ] **Step 1: Build `SignInScreen` with these states and exact copy**

State machine: `choose` → (Google) → `resolving` → one of:
- `company_workspace` / `employee_workspace` / `individual_workspace` / `app_owner_workspace` → `await refreshUserData(); await refreshAccountStatus(); onEnterWorkspace()`.
- `register_company` → form: Company name (required, ≤120), Your name (prefilled from `auth.currentUser.displayName`, required), Plan: one selected radio "Free — start now" plus disabled "Paid plans — available soon"; button "Create company workspace" → `sessionService.register({ intent: 'register_company', displayName, companyName })`.
- `register_individual` → confirm: Your name (prefilled) → "Create my free card account" → `sessionService.register({ intent: 'create_free_card', displayName })`.
- `already_registered` → "This Google account already has a DSBC {company workspace | free card account | company membership}." + button "Go to my workspace".
- `not_company_admin` → "This Google account is not authorized as a Company Owner or Admin." + buttons "Register as Company", "Use a different Google account" (sign out, back to `choose`).
- `no_account` → "No DSBC account uses this Google account yet." + "Create Free Card", "Register as Company", and the hint "Joining your company? Ask your company admin to invite this Google account." + "Use a different Google account".
- `account_inactive` → status-specific copy: `suspended` "This account is suspended. Contact DSBC support."; `cancelled` "This account has been cancelled."; `expired` "This account has expired."; `pending_activation` "Your account is not active yet." (Phase 2 adds payment-specific copy).
- Errors: `describeGoogleError` message in a `role="alert"` box; cancelled shows nothing.

Layout (choose state):

```tsx
<div className="min-h-[100dvh] bg-slate-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" data-testid="sign-in-screen">
  <header className="px-4 py-3 flex items-center justify-between">
    <span className="font-bold text-slate-900">DSBC</span>
    <button onClick={onClose} aria-label="Close sign in" className="min-h-[44px] min-w-[44px]">…</button>
  </header>
  <main className="flex-1 w-full max-w-md mx-auto px-4 pb-6 flex flex-col gap-4">
    <h1 className="text-xl font-bold">Sign in to DSBC</h1>
    <p className="text-sm text-slate-600">Secure Google authentication &amp; multi-tenant workspace</p>
    {/* Entry card 1: Login as Company — "For Company Owners & Admins" — GoogleButton intent=company_login */}
    {/* Entry card 2: Join a Company / Login to Account — "For Employees & Individuals" — GoogleButton intent=individual_login */}
    <div className="border-t pt-4"><p className="text-sm font-semibold">New to DSBC?</p>
      {/* Register as Company → GoogleButton intent=register_company ; Create Free Card → GoogleButton intent=create_free_card */}
    </div>
    <button onClick={onOpenLegacyLogin} className="text-xs text-slate-500 underline self-center min-h-[44px]">Existing account? Sign in with email</button>
  </main>
</div>
```

Each Google button: `data-testid={\`google-${intent}\`}`, label "Continue with Google", min height 48px, disabled while busy.

- [ ] **Step 2: `IndividualHomeView`**

```tsx
// Directive 34 Phase 1: individuals have an ACTIVE free account; their card workspace is Phase 4.
// No demo fallbacks (the employee portal used 'emp_acme_rahul' when employeeId was null).
export const IndividualHomeView: React.FC = () => {
  const { userProfile } = useAuth();
  return (
    <div className="max-w-xl mx-auto p-6 space-y-3" data-testid="individual-home">
      <h1 className="text-xl font-bold text-slate-900">Welcome, {userProfile?.displayName}</h1>
      <p className="text-sm text-slate-600">Your free DSBC account is active. Creating your own card from here is coming next.</p>
    </div>
  );
};
```

- [ ] **Step 3: Wire `App.tsx`**

Replace `handleStartIndividualRegistration` / `handleStartCompanyRegistration` / `handleOpenLogin` so they set `signInIntent` to `'create_free_card'` / `'register_company'` / `null` and open `SignInScreen` (full screen, not a modal). Keep `AuthModal` mounted only for `onOpenLegacyLogin`, with `initialMode="login"`. In the default-view effect, before `role === 'employee'`, add: `else if (userProfile?.accountType === 'individual' && !userProfile?.companyId) setActiveView('individual-home');` and render `<IndividualHomeView />` for that view. Directly after the loading gate add: `if (currentUser && accountStatus === 'no_account') return <SignInScreen initialIntent={pendingIntent} postSignIn … />;` so a profile-less Google identity lands on its destination screen instead of the marketing page.

- [ ] **Step 4: `AuthContext` redirect completion**

In the mount effect, before `onAuthStateChanged`, call `completeGoogleRedirect().then((r) => r && setPendingIntent(r.intent)).catch((err) => console.error('Google redirect sign-in failed:', err));` and expose `pendingIntent` / `clearPendingIntent` on the context type.

- [ ] **Step 5: Make the legacy modal login-only and delete the dead registration modal**

Delete the register-mode JSX and handlers from `AuthModal.tsx` (keep `loginWithEmail`, the existing error mapping for `auth/invalid-credential`); delete `src/components/auth/CustomerRegistrationModal.tsx`; remove `registerAccount` from `src/services/authService.ts` (the backend owns registration). `grep -rn "registerAccount\|CustomerRegistrationModal" src` must show only `sessionService` usage afterwards.

- [ ] **Step 6: Typecheck, build, commit**

Run: `npm run typecheck && npx vite build`
Expected: clean; build succeeds.

```bash
git add -A src/
git commit -m "feat(d34): Google sign-in screen with four entry points, backend registration, individual home"
```

---

### Task 7: "Link Google" for signed-in password users

**Files:**
- Create: `src/components/auth/LinkGoogleBanner.tsx`
- Modify: `src/App.tsx` (render inside the workspace, next to `EmailVerificationBanner`)
- Test: `tests/backend/d34-session.test.ts` (D34-AUTH-002/030 linking keeps the UID)

**Interfaces:**
- Consumes: `linkGoogleToCurrentUser`, `hasGoogleProvider`, `describeGoogleError` (Task 5).

- [ ] **Step 1: Write the failing identity-linking test**

```ts
// tests/backend/d34-session.test.ts
import { GoogleAuthProvider, linkWithCredential, signInWithEmailAndPassword, signInWithCredential, getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';

it('D34-AUTH-002/030 linking Google to a password account keeps the same UID and creates no second user', async () => {
  const pw = await createUser('u-link');
  const app = initializeApp({ apiKey: 'emulator-key', projectId: process.env.GCLOUD_PROJECT || 'demo-dsbc' }, 'link-test');
  const a = getAuth(app);
  connectAuthEmulator(a, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  try {
    const cred = await signInWithEmailAndPassword(a, pw.email, 'emulator-only-password-1');
    const google = GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-link-sub', email: pw.email, email_verified: true }));
    const linked = await linkWithCredential(cred.user, google);
    expect(linked.user.uid).toBe(pw.uid);
    await a.signOut();
    const viaGoogle = await signInWithCredential(a, GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-link-sub', email: pw.email, email_verified: true })));
    expect(viaGoogle.user.uid).toBe(pw.uid);
    const providers = (await adminAuth.getUser(pw.uid)).providerData.map((p) => p.providerId).sort();
    expect(providers).toEqual(['google.com', 'password']);
    expect((await adminAuth.listUsers()).users.filter((u) => u.email === pw.email)).toHaveLength(1);
  } finally {
    await deleteApp(app);
  }
});
```

(Import `adminAuth` from `./support/backendEnv`.)

- [ ] **Step 2: Run to verify it passes against Firebase itself (no product code needed)**

Run: `node scripts/directive25/runBackendTests.mjs tests/backend/d34-session.test.ts`
Expected: PASS — this pins the migration mechanism's guarantee (same UID) that Phase 3 relies on. If it FAILS, STOP: the linking strategy is unsafe and the founder must be told before any production linking.

- [ ] **Step 3: Implement the banner**

```tsx
// Shown to a signed-in account that has no Google sign-in yet (Directive 34 migration).
export const LinkGoogleBanner: React.FC = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!currentUser || hasGoogleProvider(currentUser) || state === 'done') return null;
  const link = async () => {
    setState('busy');
    setError(null);
    try {
      await linkGoogleToCurrentUser();
      setState('done');
    } catch (err) {
      const e = describeGoogleError(err);
      setState('idle');
      if (!e.cancelled) setError(e.message);
    }
  };
  return (
    <div role="region" aria-label="Link Google" data-testid="link-google-banner" className="mx-4 mt-3 p-3 rounded-xl border border-teal-200 bg-teal-50 text-sm flex flex-wrap items-center gap-3">
      <span className="flex-1 min-w-[200px]">DSBC is moving to Google sign-in. Link the Google account you will use, so you keep this same account and data.</span>
      <button onClick={link} disabled={state === 'busy'} className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white font-semibold">Link Google</button>
      {error && <span role="alert" className="w-full text-rose-700">{error}</span>}
    </div>
  );
};
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add src/components/auth/LinkGoogleBanner.tsx src/App.tsx tests/backend/d34-session.test.ts
git commit -m "feat(d34): user-mediated Link Google for existing password accounts (same UID)"
```

---

### Task 8: Browser journeys with the emulator's Google provider

**Files:**
- Create: `tests/e2e/d34-google-sign-in.spec.ts`
- Modify: `tests/e2e/support/journey.ts` (`registerCompany` uses Google + backend registration; `signIn` keeps the legacy path for password fixtures)

**Interfaces:**
- Produces: `googleSignIn(page, intent, identity: { email: string; name: string }): Promise<void>` in `journey.ts`, which clicks `google-${intent}`, handles the Auth emulator's sign-in popup ("Add new account" → email + display name → sign in), and waits for the popup to close.

- [ ] **Step 1: Inspect the emulator popup once**

Run the browser runner with a throwaway spec that clicks `google-create_free_card` and calls `popup.content()`; record the exact button/field labels of the emulator's widget in the helper. (Labels differ between firebase-tools versions; pin to what this repo's `firebase-tools` renders.)

- [ ] **Step 2: Write the journeys**

Cases (each in a fresh context): `D34-E2E-1` Create Free Card → Google → name → "Create my free card account" → `individual-home` visible, `users/{uid}.status === 'active'` (adminDb); `D34-E2E-2` Register as Company → Google → company form → workspace "Employees & Cards" visible, company `active`; `D34-E2E-3` the same Google identity → Register as Company again → "already has a DSBC company workspace", still one company; `D34-E2E-4` an unknown Google identity → Login as Company → "not authorized as a Company Owner or Admin"; `D34-E2E-5` cancel the popup → no error, still on the sign-in screen; `D34-E2E-6` the sign-in screen at 360×740 has no horizontal scroll and every Google button is ≥ 44px tall; `D34-E2E-7` legacy path: a password fixture signs in through "Existing account? Sign in with email", sees `link-google-banner`, links Google in the emulator popup, signs out, signs in with Google → same workspace (D34-AUTH-002).

- [ ] **Step 3: Move existing journeys to Google registration**

`registerCompany(page, c)` becomes: `googleSignIn(page, 'register_company', { email: c.email, name: c.company })` → fill the company form → submit → expect "Profile & Branding". Remove the D30 `activate` hook from callers (free companies are active immediately) — keep the parameter's call sites compiling by deleting it from `card-creation.spec.ts` and `production-rehearsal.spec.ts`.

- [ ] **Step 4: Run all browser suites**

Run: `node scripts/directive26/runBrowserTests.mjs`
Expected: PASS: N/N (d34 journeys, card creation 8, rehearsal 11, demo-journey, email-verification — update the latter two for Google registration the same way).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "test(d34): Google sign-in journeys in real Chrome; customer journeys register with Google"
```

---

### Task 9: Full regression, preflight, phase report (no deploy)

**Files:**
- Modify: `docs/directive-34/PLAN.md` (Phase 1 status)
- Create: `docs/directive-34/PHASE-1-REPORT.md`

- [ ] **Step 1: Run every suite and record exact totals**

```bash
npm run typecheck && npm --prefix functions run typecheck
npm run test:unit
npm run test:rules
npm run test:integration
npm run test:backend
node scripts/directive26/runBrowserTests.mjs
npx vite build
```

Record `PASS: X/X` per suite in the report. Any failure blocks the phase.

- [ ] **Step 2: Production preflight (read-only)**

Re-run the read-only checks used in the audit: Auth config (`google.com` enabled; authorized domains include `task360-ift.web.app`; `allowDuplicateEmails: false`), and `accounts:lookup` for the two production UIDs (providers unchanged). Print only provider ids and booleans.

- [ ] **Step 3: Write `PHASE-1-REPORT.md`**

Sections: what changed (files, callables, rules), tests with totals, production impact of a deploy (functions: 2 new callables + `getMyAccountState`/`loadCaller` change; rules: browser registration closed; hosting: new sign-in screen), deploy order (functions → rules → hosting), rollback (re-deploy the previous `firestore.rules` from git and the previous hosting release; the new callables are additive), and the production verification script for after the founder approves the deploy: founder signs in with Google ("Create Free Card" must NOT be used with a real account unless intended), App Owner links Google from the banner, In Future Technologies owner links Google, `accounts:lookup` shows `google.com` on both UIDs.

- [ ] **Step 4: Commit and stop for approval**

```bash
git add docs/directive-34/
git commit -m "docs(d34): Phase 1 report — tests, deploy order, rollback, production verification"
```

Do not deploy. Ask the founder for explicit approval of the Phase 1 deploy.
