# Customer Activation Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every new customer behind an App-Owner approval step (`register → verify email → pending_approval → approve → active`), enforced in both backend callables and Firestore rules, with no dummy data ever created in production.

**Architecture:** Reuse the existing `users/{uid}.status` field (today always `'active'`) as the authoritative account state machine. Registration writes `pending_approval`; a new App-Owner-only `approveCustomer` callable flips it to `active` (idempotent, reason-required, audited, email-verified-gated). Access is denied for non-`active` accounts in the existing `requireActiveProfile` backend gate **and** in new Firestore rules checks. No subscription/content is created on approval; free entitlement keeps resolving from the default plan.

**Tech Stack:** TypeScript, Firebase Functions v2 (gen2, asia-south1), Firestore + security rules, Vite/React client, Vitest (unit/rules/integration/backend emulator suites), Firebase Emulator Suite (`demo-dsbc`).

**Spec:** `docs/superpowers/specs/2026-10-03-customer-activation-gate-design.md`

## Global Constraints

- Production project `task360-ift` / database `dsbc-production` / region `asia-south1`. **No live operation in this plan** — all work is local + emulator; no deploy, bootstrap, registration, or App Owner grant.
- `PAYMENTS_ENABLED=false` stays false; Razorpay stays disabled; no secret access.
- **No dummy/demo/test data in production**, ever. Test data lives only in the emulator (`demo-dsbc`) and is never promoted.
- Account state values: `'pending_approval' | 'active' | 'suspended' | 'cancelled' | 'expired'`. Initial on registration: `'pending_approval'`.
- Clients can never write `status`: rules pin it to `'pending_approval'` on create and forbid it on update.
- App Owner remains claim-based (`platformRole==='app_owner'` + `email_verified`), exempt from the status gate.
- `approveCustomer` must refuse an account whose owner's `email_verified !== true` (and a disabled account). No subscription/content created on approval.
- Commit after every green task. Branch `security-foundation/directive-27`. Attribution footer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Review Focus

- **A pending user writing content directly via the client SDK** (bypassing callables): rules must deny `cards`/`digitalIdentityProfiles`/publishing writes unless `users/{uid}.status=='active'`. Covered in Task 7.
- **A pending user calling a customer callable that doesn't route through `resolveCommercialSubject`** (`uploadAsset`, `consumeQuota`, `setPublishingState`, `setMyDeletionRequest`): each must call `requireActiveProfile`. Covered in Task 8.
- **Approving an already-active or non-pending account** (double-click, suspended account): must be idempotent for active, and refuse for suspended/cancelled, with zero duplicate writes. Covered in Task 5.
- **Approving an unverified account** (App Owner acts before the user clicks the link): must fail `EMAIL_NOT_VERIFIED`. Covered in Task 5.
- **A pending user reading their own status** to see "awaiting approval": `getMyAccountState` must work while pending (no active-gate) and leak no entitlement/tenant data. Covered in Task 5 + Task 10.

---

## File Structure

- `shared/domain/accountStatus.ts` *(new)* — `AccountStatus` union + `INITIAL_ACCOUNT_STATUS`/`ACTIVE_ACCOUNT_STATUS` constants, imported by client, functions, and rules tests.
- `src/services/registrationModel.ts` *(modify)* — write `pending_approval`.
- `src/types/*` *(modify)* — widen `status` types.
- `functions/src/customers/activation.ts` *(new)* — `activateAccount`, `approveCustomer`, `adminListPendingCustomers`, `getMyAccountState`.
- `functions/src/index.ts` *(modify)* — export the three callables + the `onUserCreated` trigger.
- `functions/src/usage/uploads.ts` *(modify)* — generic error message.
- `functions/src/usage/quota.ts`, `functions/src/publishing/service.ts`, `functions/src/customers/service.ts` *(modify)* — ensure `requireActiveProfile` coverage.
- `shared/domain/catalogue.ts` *(modify)* — `customerActivationMode` in `INITIAL_GLOBAL_POLICY`.
- `functions/src/entitlements/admin.ts` *(modify)* — `customerActivationMode` editable in `updateGlobalPolicy`.
- `scripts/admin/setAppOwner.ts` *(modify)* — set owner `status='active'`.
- `firestore.rules` *(modify)* — `isActiveAccount()`, create-pin, content-write gates.
- UI: `src/components/auth/AwaitingApprovalBanner.tsx` *(new)*, `src/App.tsx` *(modify)*, `src/context/AuthContext.tsx` *(modify)*, `src/components/views/AppOwnerDashboard.tsx` *(modify)* + `src/components/saas/PendingCustomersTab.tsx` *(new)*, `src/services/accountService.ts` *(new, client callable wrappers)*.
- Tests: `tests/unit/registrationModel.test.ts` *(modify)*, `tests/unit/environment.test.ts` *(modify, 3 fixes)*, `tests/backend/activation.test.ts` *(new)*, `tests/rules/activation-gate.test.ts` *(new)*, `tests/unit/uploadsError.test.ts` *(new)*.
- Separate cleanup: delete `functions/.env.v-nexus-lite`, `firebase-applet-config.json`; edit `.gitignore`.

---

## Task 1: Account status type + pending registration

**Files:**
- Create: `shared/domain/accountStatus.ts`
- Modify: `src/services/registrationModel.ts` (status literals at lines 76,82,97,103,114)
- Modify: `src/types/index.ts` (or wherever `UserProfile`/`Company` are typed — widen `status`)
- Test: `tests/unit/registrationModel.test.ts`

**Interfaces:**
- Produces: `type AccountStatus = 'pending_approval'|'active'|'suspended'|'cancelled'|'expired'`; `const INITIAL_ACCOUNT_STATUS='pending_approval'`; `const ACTIVE_ACCOUNT_STATUS='active'`.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/registrationModel.test.ts`)

```ts
import { buildRegistrationDocuments } from '../../src/services/registrationModel';

test('REG-001 individual registration is pending_approval', () => {
  const d = buildRegistrationDocuments({ uid: 'u1', email: 'a@b.com', displayName: 'A', accountType: 'individual' });
  expect(d.user.status).toBe('pending_approval');
  expect(d.tenant.status).toBe('pending_approval');
});

test('REG-001 company registration is pending_approval (user, tenant, company)', () => {
  const d = buildRegistrationDocuments({ uid: 'u2', email: 'c@co.com', displayName: 'C', accountType: 'company', companyName: 'Co' });
  expect(d.user.status).toBe('pending_approval');
  expect(d.tenant.status).toBe('pending_approval');
  expect(d.company?.status).toBe('pending_approval');
});

test('REG-002/003/004 registration creates no cards/employees/subscriptions/leads/slug', () => {
  const d = buildRegistrationDocuments({ uid: 'u3', email: 'c@co.com', displayName: 'C', accountType: 'company', companyName: 'Co' });
  expect(Object.keys(d)).toEqual(expect.arrayContaining(['user', 'tenant', 'company']));
  // builder returns only these three keys; it cannot create cards/leads/subscriptions
  expect(Object.keys(d).sort()).toEqual(['company', 'tenant', 'user']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/registrationModel.test.ts -t REG-001`
Expected: FAIL (`status` is `'active'`).

- [ ] **Step 3: Implement**

Create `shared/domain/accountStatus.ts`:
```ts
export type AccountStatus = 'pending_approval' | 'active' | 'suspended' | 'cancelled' | 'expired';
export const INITIAL_ACCOUNT_STATUS: AccountStatus = 'pending_approval';
export const ACTIVE_ACCOUNT_STATUS: AccountStatus = 'active';
```
In `src/services/registrationModel.ts`: `import { INITIAL_ACCOUNT_STATUS } from '../../shared/domain/accountStatus';`, change `TenantRecord.status` type to `AccountStatus`, and replace every `status: 'active'` in `buildRegistrationDocuments` (user, tenant, company) with `status: INITIAL_ACCOUNT_STATUS`.
In `src/types/*`: widen `UserProfile.status`, `Company.status` to `AccountStatus`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/registrationModel.test.ts` → Expected: PASS. Then `npm run typecheck` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/domain/accountStatus.ts src/services/registrationModel.ts src/types tests/unit/registrationModel.test.ts
git commit -m "feat(d30): registration writes pending_approval status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Fix the 3 stale environment tests

**Files:**
- Modify/Test: `tests/unit/environment.test.ts` (ENV-020 ~line 233, ENV-021 ~lines 248-252, +1)

**Interfaces:** none (test-only).

- [ ] **Step 1: Run the suite to see the 3 current failures**

Run: `npx vitest run tests/unit/environment.test.ts`
Expected: 3 FAIL (ENV-020 `dedicatedProject` expected false; ENV-021 proposal DB equals prod DB).

- [ ] **Step 2: Update the expectations to the dedicated-project reality**

In ENV-020 change the pre-condition assertion to the current truth:
```ts
// production is now the dedicated project task360-ift
expect(PROD.boundary?.dedicatedProject).toBe(true);
const report = runPreflight({ target: 'production' });
expect(report.checks.find((c) => c.id === 'PRODUCTION_BOUNDARY')?.status).toBe('PASS');
```
In ENV-021 (the proposal now equals production), assert equality instead of inequality:
```ts
// the proposal has been promoted to production; they now match
expect(t.firestoreDatabaseId).toBe('dsbc-production');
expect(t.hostingSite).toBe('task360-ift');
expect(t.firebase.projectId).toBe('task360-ift');
```
Fix the third failing assertion in the same block the same way (equality to the task360-ift values). Do **not** weaken unrelated assertions or mass-update snapshots.

- [ ] **Step 3: Run to verify green**

Run: `npx vitest run tests/unit/environment.test.ts` → Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/environment.test.ts
git commit -m "test(d30): update env boundary tests to dedicated task360-ift production

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: uploads.ts error-leak fix

**Files:**
- Modify: `functions/src/usage/uploads.ts:70`
- Test: `tests/unit/uploadsError.test.ts` (new)

**Interfaces:** unchanged public signature of `uploadAsset`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/uploadsError.test.ts
import { readFileSync } from 'node:fs';
test('REG-leak uploads.ts does not interpolate raw error into client message', () => {
  const src = readFileSync('functions/src/usage/uploads.ts', 'utf8');
  expect(src).not.toMatch(/Upload failed: \$\{/);
  expect(src).toMatch(/fail\('internal', 'Upload failed\.'\)/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/uploadsError.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implement** — in `functions/src/usage/uploads.ts` replace the catch at line 70:
```ts
} catch (err) {
  logger.error('uploadAsset failed', err); // detail stays server-side
  fail('internal', 'Upload failed.');
}
```
(Add `import { logger } from 'firebase-functions';` if not already imported.)

- [ ] **Step 4: Run to verify pass + build**

Run: `npx vitest run tests/unit/uploadsError.test.ts` → PASS. `npm --prefix functions run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/usage/uploads.ts tests/unit/uploadsError.test.ts
git commit -m "fix(d30): uploadAsset returns generic error, logs detail server-side

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Activation-mode policy field

**Files:**
- Modify: `shared/domain/catalogue.ts` (`INITIAL_GLOBAL_POLICY`)
- Modify: `functions/src/entitlements/admin.ts` (`POLICY_FIELDS` + validation in `updateGlobalPolicy`)
- Test: `tests/unit/registrationModel.test.ts` (append) or a small `tests/unit/policy.test.ts`

**Interfaces:**
- Produces: `INITIAL_GLOBAL_POLICY.customerActivationMode: 'manual_approval' | 'auto'` (default `'manual_approval'`).

- [ ] **Step 1: Write the failing test** (`tests/unit/policy.test.ts`)

```ts
import { INITIAL_GLOBAL_POLICY } from '../../shared/domain/catalogue';
test('REG-030 default customer activation mode is manual_approval', () => {
  expect(INITIAL_GLOBAL_POLICY.customerActivationMode).toBe('manual_approval');
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/unit/policy.test.ts` → FAIL.

- [ ] **Step 3: Implement**
  - In `shared/domain/catalogue.ts` add `customerActivationMode: 'manual_approval'` to `INITIAL_GLOBAL_POLICY` and its type.
  - In `functions/src/entitlements/admin.ts` add `'customerActivationMode'` to `POLICY_FIELDS` and, in `updateGlobalPolicy`, validate it: `if (u.customerActivationMode !== undefined) updates.customerActivationMode = oneOf(u, 'customerActivationMode', ['manual_approval','auto'] as const);`

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/unit/policy.test.ts` → PASS; `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/domain/catalogue.ts functions/src/entitlements/admin.ts tests/unit/policy.test.ts
git commit -m "feat(d30): customerActivationMode policy (manual_approval default)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Backend activation module (approveCustomer, list, getMyAccountState)

**Files:**
- Create: `functions/src/customers/activation.ts`
- Modify: `functions/src/index.ts` (exports)
- Test: `tests/backend/activation.test.ts` (new, emulator)

**Interfaces:**
- Consumes: `Caller`, `requireAppOwner`, `requireActiveProfile`, `actorOf` (`functions/src/auth/identity.ts`); `appendAudit` (`functions/src/audit/ledger.ts`); `serverNow` (`shared/time`); `obj`,`str`,`oneOf`,`reason`,`ID_PATTERN` (`shared/validate`); `db` (`shared/firebase`); `getAuth` (`firebase-admin/auth`); `ACTIVE_ACCOUNT_STATUS` (`shared/domain/accountStatus`).
- Produces:
  - `approveCustomer(caller, data): Promise<{ customerType:'individual'|'company'; customerId:string; status:'active'; alreadyActive:boolean }>`
  - `adminListPendingCustomers(caller, data): Promise<{ pending: Array<{ uid:string; displayName:string; email:string; accountType:string; companyName:string|null; createdAt:string|null; emailVerified:boolean; status:string }> }>`
  - `getMyAccountState(caller): Promise<{ status:string; emailVerified:boolean }>`
  - `activateAccount(tx, refs, actor, reason): void` (internal helper).

- [ ] **Step 1: Write failing backend tests** (`tests/backend/activation.test.ts`, run under the backend emulator harness). Representative cases — write all of REG-010..021, REG-033:

```ts
// Uses the backend test harness (admin SDK against emulator). Helpers assumed from tests/backend/support.
import { callAs, seedUser, setAppOwnerClaim, setEmailVerified, getDoc } from './support/harness';

test('REG-010 non-App-Owner cannot approve', async () => {
  await seedUser('cust1', { status: 'pending_approval', accountType: 'individual' });
  await expect(callAs('cust1', 'approveCustomer', { customerType:'individual', customerId:'cust1', reason:'x' }))
    .rejects.toMatchObject({ code: 'permission-denied' });
});

test('REG-011 unverified App Owner cannot approve', async () => {
  await setAppOwnerClaim('owner', { emailVerified: false });
  await seedUser('cust2', { status: 'pending_approval', accountType: 'individual' });
  await expect(callAs('owner', 'approveCustomer', { customerType:'individual', customerId:'cust2', reason:'x' }))
    .rejects.toMatchObject({ code: 'permission-denied' });
});

test('REG-033 approveCustomer refuses an unverified account', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('cust3', { status: 'pending_approval', accountType: 'individual' });
  await setEmailVerified('cust3', false);
  await expect(callAs('owner', 'approveCustomer', { customerType:'individual', customerId:'cust3', reason:'x' }))
    .rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('EMAIL_NOT_VERIFIED') });
});

test('REG-013/020 verified pending customer is activated', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('cust4', { status: 'pending_approval', accountType: 'individual' });
  await setEmailVerified('cust4', true);
  const res = await callAs('owner', 'approveCustomer', { customerType:'individual', customerId:'cust4', reason:'verified real customer' });
  expect(res).toMatchObject({ status: 'active', alreadyActive: false });
  expect((await getDoc('users/cust4')).status).toBe('active');
});

test('REG-014 approval requires a reason', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('cust5', { status: 'pending_approval', accountType: 'individual' });
  await setEmailVerified('cust5', true);
  await expect(callAs('owner', 'approveCustomer', { customerType:'individual', customerId:'cust5' }))
    .rejects.toMatchObject({ code: 'invalid-argument' });
});

test('REG-015 approval writes an immutable ACCOUNT_ACTIVATED audit', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('cust6', { status:'pending_approval', accountType:'individual' });
  await setEmailVerified('cust6', true);
  await callAs('owner','approveCustomer',{ customerType:'individual', customerId:'cust6', reason:'ok' });
  const logs = await getDoc.query('commercialAuditLogs', { action: 'ACCOUNT_ACTIVATED', targetId: 'cust6' });
  expect(logs.length).toBe(1);
  expect(logs[0]).toMatchObject({ reason:'ok', previousValue:{status:'pending_approval'}, newValue:{status:'active'} });
});

test('REG-016/017/018/019 approval is idempotent; no duplicate records', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('cust7', { status:'pending_approval', accountType:'company', companyId:'co_cust7' });
  await setEmailVerified('cust7', true);
  await callAs('owner','approveCustomer',{ customerType:'company', customerId:'co_cust7', reason:'ok' });
  const second = await callAs('owner','approveCustomer',{ customerType:'company', customerId:'co_cust7', reason:'again' });
  expect(second.alreadyActive).toBe(true);
  expect((await getDoc.count('subscriptions'))).toBe(0);           // REG-018: none created
  expect((await getDoc.count('companies', { id:'co_cust7' }))).toBe(1); // REG-017: not duplicated
});

test('REG-012 verified App Owner lists pending customers', async () => {
  await setAppOwnerClaim('owner', { emailVerified: true });
  await seedUser('p1', { status:'pending_approval', accountType:'individual' });
  const res = await callAs('owner','adminListPendingCustomers',{});
  expect(res.pending.map(p=>p.uid)).toContain('p1');
});

test('REG-021 getMyAccountState works for a pending user and leaks nothing', async () => {
  await seedUser('pend', { status:'pending_approval', accountType:'individual' });
  await setEmailVerified('pend', true);
  const res = await callAs('pend','getMyAccountState',{});
  expect(res).toEqual({ status:'pending_approval', emailVerified:true });
});
```

- [ ] **Step 2: Run to verify they fail** — `npm run test:backend` (or targeted emulator exec of `tests/backend/activation.test.ts`). Expected: FAIL (functions not defined).

- [ ] **Step 3: Implement `functions/src/customers/activation.ts`**

```ts
import type { Transaction } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../shared/firebase';
import { deny, fail } from '../shared/errors';
import { serverNow } from '../shared/time';
import { ID_PATTERN, obj, oneOf, reason, str } from '../shared/validate';
import { actorOf, requireAppOwner, type Caller } from '../auth/identity';
import { appendAudit, type AuditActor } from '../audit/ledger';
import { ACTIVE_ACCOUNT_STATUS } from '../../../shared/domain/accountStatus';

interface Target { uid: string; userRef: FirebaseFirestore.DocumentReference; tenantRef?: FirebaseFirestore.DocumentReference; companyRef?: FirebaseFirestore.DocumentReference; tenantId: string; }

async function resolveTarget(customerType: 'individual'|'company', customerId: string): Promise<Target> {
  if (customerType === 'company') {
    const companyRef = db().collection('companies').doc(customerId);
    const company = await companyRef.get();
    if (!company.exists) fail('not-found', `Company ${customerId} does not exist.`);
    const ownerUid = (company.get('ownerUid') as string) || customerId.replace(/^co_/, '');
    return { uid: ownerUid, userRef: db().collection('users').doc(ownerUid), tenantRef: db().collection('tenants').doc(customerId), companyRef, tenantId: customerId };
  }
  const userRef = db().collection('users').doc(customerId);
  const user = await userRef.get();
  if (!user.exists) fail('not-found', `Individual ${customerId} does not exist.`);
  const tenantId = (user.get('tenantId') as string) || `ind_${customerId}`;
  return { uid: customerId, userRef, tenantRef: db().collection('tenants').doc(tenantId), tenantId };
}

export function activateAccount(tx: Transaction, t: Target, actor: AuditActor, why: string, prevStatus: string): void {
  tx.update(t.userRef, { status: ACTIVE_ACCOUNT_STATUS, updatedAt: serverNow() });
  if (t.tenantRef) tx.set(t.tenantRef, { status: ACTIVE_ACCOUNT_STATUS }, { merge: true });
  if (t.companyRef) tx.set(t.companyRef, { status: ACTIVE_ACCOUNT_STATUS, updatedAt: serverNow() }, { merge: true });
  appendAudit(tx, 'commercialAuditLogs', {
    action: 'ACCOUNT_ACTIVATED', actor, targetType: t.companyRef ? 'company' : 'individual', targetId: t.companyRef ? t.tenantId : t.uid,
    tenantId: t.tenantId, previousValue: { status: prevStatus }, newValue: { status: ACTIVE_ACCOUNT_STATUS }, reason: why, source: 'App Owner Activation',
  });
}

export async function approveCustomer(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'reason']);
  const customerType = oneOf(p, 'customerType', ['individual', 'company'] as const);
  const customerId = str(p, 'customerId', { pattern: ID_PATTERN });
  const why = reason(p);
  const t = await resolveTarget(customerType, customerId);

  // Email-verified precondition (mirrors setAppOwner).
  const authUser = await getAuth().getUser(t.uid);
  if (authUser.disabled) fail('failed-precondition', 'ACCOUNT_DISABLED');
  if (authUser.emailVerified !== true) fail('failed-precondition', 'EMAIL_NOT_VERIFIED');

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(t.userRef);
    if (!snap.exists) fail('not-found', 'Account not found.');
    const status = snap.get('status') as string;
    if (status === ACTIVE_ACCOUNT_STATUS) return { customerType, customerId, status: ACTIVE_ACCOUNT_STATUS, alreadyActive: true };
    if (status !== 'pending_approval') fail('failed-precondition', `Account is ${status}; approval only activates pending accounts.`);
    activateAccount(tx, t, actorOf(caller), why, status);
    return { customerType, customerId, status: ACTIVE_ACCOUNT_STATUS, alreadyActive: false };
  });
}

export async function adminListPendingCustomers(caller: Caller, _data: unknown) {
  requireAppOwner(caller);
  const snap = await db().collection('users').where('status', '==', 'pending_approval').limit(200).get();
  const pending = await Promise.all(snap.docs.map(async (d) => {
    let emailVerified = false;
    try { emailVerified = (await getAuth().getUser(d.id)).emailVerified === true; } catch { emailVerified = false; }
    let companyName: string | null = null;
    if (d.get('companyId')) { const c = await db().collection('companies').doc(d.get('companyId')).get(); companyName = (c.get('name') as string) || null; }
    return { uid: d.id, displayName: (d.get('displayName') as string) || '', email: (d.get('email') as string) || '', accountType: (d.get('accountType') as string) || 'individual', companyName, createdAt: (d.get('createdAt') as string) || null, emailVerified, status: d.get('status') as string };
  }));
  return { pending };
}

export async function getMyAccountState(caller: Caller) {
  if (!caller.uid) deny('Sign in required.');
  const status = caller.profile?.status ?? 'pending_approval';
  return { status, emailVerified: caller.emailVerified };
}
```

Export in `functions/src/index.ts`:
```ts
import * as activation from './customers/activation';
export const approveCustomer = callable(activation.approveCustomer);
export const adminListPendingCustomers = callable(activation.adminListPendingCustomers);
export const getMyAccountState = callable((c) => activation.getMyAccountState(c));
```

- [ ] **Step 4: Run to verify pass** — `npm run test:backend` (activation suite) → PASS; `npm --prefix functions run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/customers/activation.ts functions/src/index.ts tests/backend/activation.test.ts
git commit -m "feat(d30): approveCustomer/getMyAccountState/adminListPendingCustomers (email-verified, idempotent, audited)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: onUserCreated registration-audit trigger

**Files:**
- Modify: `functions/src/index.ts` (new trigger export, near the other `onDocumentWritten` triggers)
- Test: `tests/backend/activation.test.ts` (append REG-015-registration)

**Interfaces:**
- Consumes: `onDocumentCreated` (`firebase-functions/v2/firestore`), `doc()` helper in index.ts (database `dsbc-production`/emulator `(default)`), `appendAudit`, `db`.

- [ ] **Step 1: Write failing test** (append)

```ts
test('REG-015b new user doc yields an ACCOUNT_REGISTERED audit', async () => {
  await seedUser('newreg', { status: 'pending_approval', accountType: 'individual' }); // seedUser writes users/{uid}
  await waitForTrigger();
  const logs = await getDoc.query('commercialAuditLogs', { action: 'ACCOUNT_REGISTERED', targetId: 'newreg' });
  expect(logs.length).toBe(1);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:backend` → FAIL.

- [ ] **Step 3: Implement** in `functions/src/index.ts`:
```ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { appendAudit } from './audit/ledger';
export const onUserCreated = onDocumentCreated(doc('users/{uid}'), async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await db().runTransaction(async (tx) => {
    const auditRef = db().collection('commercialAuditLogs').doc(`ACCOUNT_REGISTERED_${event.params.uid}`);
    if ((await tx.get(auditRef)).exists) return; // idempotent
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'ACCOUNT_REGISTERED', actor: { uid: event.params.uid, name: (data.displayName as string) || event.params.uid, role: (data.accountType as string) || 'customer' },
      targetType: (data.accountType as string) || 'individual', targetId: event.params.uid, tenantId: (data.tenantId as string) || event.params.uid,
      previousValue: null, newValue: { status: data.status || 'pending_approval' }, reason: 'Self-registration', source: 'Registration',
    }, auditRef);
  });
});
```
*(If `appendAudit` does not accept an explicit ref, extend it with an optional `ref` arg or write the audit doc with a deterministic id directly within the transaction; keep the idempotency guard.)*

- [ ] **Step 4: Run to verify pass** — `npm run test:backend` → PASS; `npm --prefix functions run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/index.ts functions/src/audit/ledger.ts tests/backend/activation.test.ts
git commit -m "feat(d30): onUserCreated writes ACCOUNT_REGISTERED audit (idempotent)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Firestore rules — status enforcement

**Files:**
- Modify: `firestore.rules`
- Test: `tests/rules/activation-gate.test.ts` (new, run via `npm run test:rules`)

**Interfaces:** rules helpers `accountStatus(uid)`, `isActiveAccount()`.

- [ ] **Step 1: Write failing rules tests**

```ts
// tests/rules/activation-gate.test.ts (uses the repo's rules-test harness)
import { withAuth, expectAllow, expectDeny } from './support';

test('REG-006/009 pending user cannot create a card', async () => {
  const ctx = await withAuth('pend', { seedUser: { status: 'pending_approval' } });
  await expectDeny(ctx.set('cards/pend_card', { ownerUid: 'pend', companyId: null, employeeId: 'pend' }));
});

test('REG-021 active user can create their card', async () => {
  const ctx = await withAuth('act', { seedUser: { status: 'active' } });
  await expectAllow(ctx.set('cards/act_card', { ownerUid: 'act', companyId: null, employeeId: 'act' }));
});

test('REG-001 create user doc must be pending_approval', async () => {
  const ctx = await withAuth('u');
  await expectDeny(ctx.set('users/u', { id:'u', email:'e', role:'employee', status:'active', accountType:'individual', tenantId:'ind_u' }));
  await expectAllow(ctx.set('users/u', { id:'u', email:'e', role:'employee', status:'pending_approval', accountType:'individual', tenantId:'ind_u' }));
});

test('REG-023 customer cannot self-change status', async () => {
  const ctx = await withAuth('u2', { seedUser: { status: 'pending_approval' } });
  await expectDeny(ctx.update('users/u2', { status: 'active' }));
});

test('REG-022 pending user cannot write another tenant', async () => {
  const ctx = await withAuth('pend', { seedUser: { status: 'pending_approval' } });
  await expectDeny(ctx.set('cards/other_card', { ownerUid: 'someoneelse' }));
});
```

- [ ] **Step 2: Run to verify fail** — `npm run test:rules` → FAIL.

- [ ] **Step 3: Implement in `firestore.rules`** — add near the top helpers:
```
function accountStatus(uid) {
  return get(/databases/$(database)/documents/users/$(uid)).data.status;
}
function isActiveAccount() {
  return isSignedIn() && accountStatus(request.auth.uid) == 'active';
}
```
  - On `users` create: require `request.resource.data.status == 'pending_approval'` (keep existing role/tenant/email checks).
  - On `tenants` and `companies` create: require `request.resource.data.status == 'pending_approval'`.
  - `users` update: keep the existing `['displayName','updatedAt']`-only restriction (status unchanged by client).
  - Add `&& isActiveAccount()` to the create/update conditions of customer content: `cards`, `digitalIdentityProfiles`, company content writes, publishing fields, `leadEvents`/`connectionEvents` owner-create, client upload metadata.
  - Leave audit/subscription/entitlement/invoice/platformConfig at `write: if false`.

- [ ] **Step 4: Run to verify pass** — `npm run test:rules` → PASS (new + existing 559).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/activation-gate.test.ts
git commit -m "feat(d30): firestore rules gate content writes on active account + pin pending create

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Callable active-gate coverage

**Files:**
- Modify (only where missing): `functions/src/usage/quota.ts`, `functions/src/usage/uploads.ts`, `functions/src/publishing/service.ts`, `functions/src/customers/service.ts` (`setMyDeletionRequest`)
- Test: `tests/backend/activation.test.ts` (append REG-007, REG-008)

**Interfaces:** each customer callable calls `requireActiveProfile(caller)` before acting (or routes through `resolveCommercialSubject`, which already does).

- [ ] **Step 1: Write failing tests**

```ts
test('REG-007 pending user cannot consumeQuota', async () => {
  await seedUser('q', { status:'pending_approval', accountType:'individual' });
  await expect(callAs('q','consumeQuota',{ featureId:'individual.business_card', operationId:'op1' }))
    .rejects.toMatchObject({ code: 'permission-denied' });
});
test('REG-008 pending user cannot uploadAsset', async () => {
  await seedUser('q2', { status:'pending_approval', accountType:'individual' });
  await expect(callAs('q2','uploadAsset',{ kind:'logo', contentType:'image/png', bytesBase64:'AAAA' }))
    .rejects.toMatchObject({ code: 'permission-denied' });
});
```

- [ ] **Step 2: Run to verify fail** — `npm run test:backend` → FAIL for any callable not yet gated.

- [ ] **Step 3: Implement** — in each handler that does not already call `resolveCommercialSubject`, add `requireActiveProfile(caller);` as the first line after any `requireAppOwner`-free entry (e.g. top of `consumeQuota`, `uploadAsset`, `setPublishingState`, `setMyDeletionRequest`). Import `requireActiveProfile` from `../auth/identity`. Do not change admin callables.

- [ ] **Step 4: Run to verify pass** — `npm run test:backend` → PASS; confirm active users still succeed (existing tests stay green).

- [ ] **Step 5: Commit**

```bash
git add functions/src/usage/quota.ts functions/src/usage/uploads.ts functions/src/publishing/service.ts functions/src/customers/service.ts tests/backend/activation.test.ts
git commit -m "feat(d30): require active account on all customer callables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: setAppOwner sets owner status active

**Files:**
- Modify: `scripts/admin/setAppOwner.ts` (profile write block ~lines 59-70)
- Test: `tests/backend/activation.test.ts` (append) or existing setAppOwner test

**Interfaces:** unchanged CLI.

- [ ] **Step 1: Write failing test**

```ts
test('REG-owner setAppOwner marks the owner users doc active', async () => {
  await setEmailVerified('own', true);
  await runSetAppOwner({ email: 'own@x.com', uid: 'own' }); // harness wrapper around setAppOwner
  expect((await getDoc('users/own')).status).toBe('active');
});
```

- [ ] **Step 2: Run to verify fail** — targeted backend run → FAIL.

- [ ] **Step 3: Implement** — in `scripts/admin/setAppOwner.ts`, extend both the `existing` merge and the new-profile branch to set `status: 'active'`:
```ts
await profileRef.set({ role: 'app_owner', status: 'active', updatedAt: now }, { merge: true });
// and in the create branch add: status: 'active',
```

- [ ] **Step 4: Run to verify pass** — targeted run → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/admin/setAppOwner.ts tests/backend/activation.test.ts
git commit -m "feat(d30): setAppOwner sets owner account status active

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Client — awaiting-approval state

**Files:**
- Create: `src/services/accountService.ts` (wraps `getMyAccountState` callable)
- Create: `src/components/auth/AwaitingApprovalBanner.tsx`
- Modify: `src/context/AuthContext.tsx` (expose `accountStatus`), `src/App.tsx` (mount banner; gate workspace)
- Test: `tests/unit/awaitingApproval.test.ts`

**Interfaces:**
- Produces: `getMyAccountState(): Promise<{status:string; emailVerified:boolean}>`; `AuthContext.accountStatus: string | null`.

- [ ] **Step 1: Write failing test**

```ts
import { render, screen } from '@testing-library/react';
import { AwaitingApprovalBanner } from '../../src/components/auth/AwaitingApprovalBanner';
test('REG-ui shows awaiting approval for pending verified user', () => {
  render(<AwaitingApprovalBanner status="pending_approval" emailVerified={true} />);
  expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
});
test('REG-ui renders nothing for active user', () => {
  const { container } = render(<AwaitingApprovalBanner status="active" emailVerified={true} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/unit/awaitingApproval.test.ts` → FAIL.

- [ ] **Step 3: Implement**
  - `src/services/accountService.ts`: `export const getMyAccountState = () => httpsCallable(functions,'getMyAccountState')().then(r=>r.data as {status:string;emailVerified:boolean});`
  - `AwaitingApprovalBanner.tsx`: returns `null` unless `status==='pending_approval'`; otherwise a banner: "Your account is awaiting approval by the DSBC team." + Sign-out. No feature links.
  - `AuthContext.tsx`: after sign-in (and after `refreshEmailVerification`), call `getMyAccountState` and store `accountStatus`.
  - `App.tsx`: when `accountStatus==='pending_approval'`, render the banner in place of the workspace (do not mount feature routes).

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/unit/awaitingApproval.test.ts` → PASS; `npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/accountService.ts src/components/auth/AwaitingApprovalBanner.tsx src/context/AuthContext.tsx src/App.tsx tests/unit/awaitingApproval.test.ts
git commit -m "feat(d30): awaiting-approval client state via getMyAccountState

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Client — App Owner pending-customers queue

**Files:**
- Create: `src/components/saas/PendingCustomersTab.tsx`
- Modify: `src/components/views/AppOwnerDashboard.tsx` (add the tab), `src/services/accountService.ts` (add `adminListPendingCustomers`, `approveCustomer` wrappers)
- Test: `tests/unit/pendingCustomersTab.test.ts`

**Interfaces:**
- Consumes: `adminListPendingCustomers(): Promise<{pending: PendingCustomer[]}>`, `approveCustomer(input): Promise<...>`.

- [ ] **Step 1: Write failing test**

```ts
import { render, screen } from '@testing-library/react';
import { PendingCustomersTab } from '../../src/components/saas/PendingCustomersTab';
test('REG-ui2 lists pending customers with real fields only', async () => {
  const pending = [{ uid:'p1', displayName:'Real Name', email:'r@x.com', accountType:'individual', companyName:null, createdAt:'2026-10-03T00:00:00Z', emailVerified:true, status:'pending_approval' }];
  render(<PendingCustomersTab pending={pending} onApprove={()=>{}} />);
  expect(screen.getByText('Real Name')).toBeInTheDocument();
  expect(screen.getByText(/approve/i)).toBeInTheDocument();
});
test('REG-ui2 approve requires a reason', async () => {
  const onApprove = vi.fn();
  render(<PendingCustomersTab pending={[{ uid:'p1', displayName:'N', email:'e', accountType:'individual', companyName:null, createdAt:null, emailVerified:true, status:'pending_approval' }]} onApprove={onApprove} />);
  screen.getByRole('button', { name: /approve/i }).click();
  expect(onApprove).not.toHaveBeenCalled(); // empty reason blocks
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/unit/pendingCustomersTab.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `PendingCustomersTab` renders a table of the real fields and an Approve control with a required reason input; disables Approve until a reason is entered; calls `onApprove(uid, customerType, reason)`. Wire it into `AppOwnerDashboard` behind the existing App Owner gate. Add `accountService.adminListPendingCustomers`/`approveCustomer` callable wrappers. No fabricated metrics.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/unit/pendingCustomersTab.test.ts` → PASS; `npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/saas/PendingCustomersTab.tsx src/components/views/AppOwnerDashboard.tsx src/services/accountService.ts tests/unit/pendingCustomersTab.test.ts
git commit -m "feat(d30): App Owner pending-customers queue + approve action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Bootstrap / data-safety + payment regression tests

**Files:**
- Test: `tests/backend/activation.test.ts` (append REG-027..032) — reuse existing bootstrap + payment-gate tests where present.

**Interfaces:** none new.

- [ ] **Step 1: Write tests**

```ts
test('REG-027/028 bootstrap creates control-plane only, zero customer records', async () => {
  await runBootstrap({ dryRun: false });            // emulator only
  for (const c of ['users','companies','employees','cards','digitalIdentityProfiles','subscriptions','invoices','leadEvents','slugs']) {
    expect(await getDoc.count(c)).toBe(0);
  }
  expect(await getDoc.count('plans')).toBeGreaterThan(0);
});
test('REG-029 demo seeder refuses a non-demo project', async () => {
  await expect(runSeeder({ projectId: 'task360-ift' })).rejects.toThrow();
});
test('REG-030 approveCustomer works with PAYMENTS_ENABLED=false', async () => {
  // covered by Task 5 happy path under the default emulator env (payments off)
  expect(process.env.PAYMENTS_ENABLED ?? 'false').toBe('false');
});
test('REG-031 createCheckoutOrder fails closed when payments disabled', async () => {
  await seedUser('b', { status:'active', accountType:'individual' });
  await expect(callAs('b','createCheckoutOrder',{ planId:'individual_pro' }))
    .rejects.toMatchObject({ message: expect.stringContaining('PAYMENTS_NOT_ENABLED') });
});
```

- [ ] **Step 2: Run to verify fail/确认** — `npm run test:backend` → the new ones FAIL until wired; REG-031 likely passes already (regression guard).

- [ ] **Step 3: Implement** — no product change expected; if REG-029 fails because the seeder lacks a non-demo guard, add a guard in the seeder that throws unless the target project id starts with `demo-`. (This is a safety hardening consistent with the spec.)

- [ ] **Step 4: Run to verify pass** — `npm run test:backend` → PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/backend/activation.test.ts scripts/admin/seedDemoData.ts
git commit -m "test(d30): data-safety + payment-gate regressions (bootstrap empty, seeder demo-only)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Legacy old-prod file cleanup (separate change)

**Files:**
- Delete: `functions/.env.v-nexus-lite`, `firebase-applet-config.json`
- Modify: `.gitignore` (remove `!functions/.env.v-nexus-lite` at line 17), `scripts/directive27/secretsAudit.mjs:27` (drop the reference to the deleted file)
- Test: `tests/unit/environment.test.ts` (add a guard that no committed env names v-nexus-lite as production)

- [ ] **Step 1: Write failing guard test**

```ts
import { readdirSync, existsSync } from 'node:fs';
test('REG-legacy no committed old-prod v-nexus-lite env/config remains', () => {
  expect(existsSync('functions/.env.v-nexus-lite')).toBe(false);
  expect(existsSync('firebase-applet-config.json')).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/unit/environment.test.ts -t REG-legacy` → FAIL.

- [ ] **Step 3: Implement** — `git rm functions/.env.v-nexus-lite firebase-applet-config.json`; remove the `.gitignore:17` un-ignore line; update `scripts/directive27/secretsAudit.mjs` to drop the removed path. Confirm no runtime import references either (grep) before deleting.

- [ ] **Step 4: Run to verify pass + full regression** — `npx vitest run tests/unit/environment.test.ts` → PASS; `npm --prefix functions run build` → PASS; `npm run test:security` (rules) → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(d30): remove stale v-nexus-lite old-prod env/config (wrong-project deploy hazard)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `npm run test:unit` → all PASS (incl. REG unit tests + the 3 env fixes).
- [ ] `npm run test:rules` → all PASS (incl. `activation-gate.test.ts`).
- [ ] `npm run test:integration` → PASS.
- [ ] `npm run test:backend` → PASS (activation suite).
- [ ] `npm run typecheck` && `npm --prefix functions run build` && `npm run build` → PASS.
- [ ] `npx tsx scripts/directive27/preflight.ts --target production` → 0 FAIL (staging BLOCKED acceptable).
- [ ] Confirm acceptance criteria §18 of the spec, item by item.
- [ ] **No deploy / no production mutation** performed. Report results; founder decides deployment separately.

## Self-review notes

- **Spec coverage:** state machine (T1,T7), registration pending (T1), rules enforcement (T7), callable coverage (T8), approveCustomer incl. email-verified + idempotent + audit (T5), list + pending-safe read (T5), onUserCreated audit (T6), policy mode (T4), App Owner exemption/owner-active (T9), UI (T10,T11), uploads leak (T3), legacy cleanup (T13), data-safety/payment regressions (T12), 3 env fixes (T2) — all mapped.
- **Types:** `AccountStatus` defined in T1 and reused; `approveCustomer` return shape consistent across T5 and T11; `getMyAccountState` shape consistent T5/T10.
- **Review Focus:** each of the five lines has an owning test (T7 direct-write, T8 callable coverage, T5 idempotent/unverified, T5/T10 pending read).
