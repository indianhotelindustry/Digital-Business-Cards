# Customer Activation Gate — Design Specification

- **Date:** 2026-10-03
- **Author:** DSBC engineering (Devendra Singh Sehgal) with Claude
- **Status:** Draft for founder review (no implementation yet)
- **Branch:** `security-foundation/directive-27`
- **Production project:** `task360-ift` / database `dsbc-production` (asia-south1)
- **Related:** Directive 24 (registration model), Directive 25 (backend authority), Directive 29 (email verification)

## 1. Purpose and intended outcome

Production DSBC must operate with an explicit, App-Owner-gated customer lifecycle:

```
NEW USER → REGISTER → EMAIL VERIFICATION → PENDING_APPROVAL → APP OWNER APPROVES → ACTIVE → uses DSBC
```

Customer activation is **manual** (App Owner) initially. The architecture must allow a later switch to automatic activation **without redesigning** registration, the account model, entitlement, or authorization. Email verification alone must never activate a customer.

### Success criteria
A real customer can register and verify email, then remains `PENDING_APPROVAL` with **no** normal application access (enforced in backend callables **and** Firestore rules, not UI). The App Owner sees a real pending-customer queue and approves with a required reason; approval is audited and idempotent; the approved customer becomes `ACTIVE` and can use the product. No dummy/demo/test data is ever created in production. Payments remain disabled; Razorpay stays off; offline/manual entitlement remains App-Owner-only.

## 2. Absolute data-safety requirement (non-negotiable)

Production (`dsbc-production`) must contain **only**:
1. deliberately bootstrapped control-plane records (plans, feature catalogue, global policy, platform configuration), and
2. real authenticated customer accounts + the minimum real registration/profile records, and
3. audit records describing registration/approval.

**Never create** in production: dummy users, companies, tenants, demo cards, demo employees, dummy subscriptions, dummy leads, dummy transactions, fabricated analytics/content, or any emulator/test data promoted upward. An empty production database for a new customer is correct and must not be "populated" for appearance.

## 3. Current state (as inspected, read-only)

- **Registration** (`src/services/authService.ts:66` → `src/services/registrationModel.ts:55`): `createUserWithEmailAndPassword`, then one client `writeBatch` of `users/{uid}`, `tenants/{id}`, and (company) `companies/{co_uid}`, then `sendVerificationEmail`. No cards/employees/subscriptions/leads created. **All records are written with `status:'active'`** (`registrationModel.ts:76,82,97,103,114`).
- **Authoritative access gate already exists:** `requireActiveProfile` denies unless `users/{uid}.status === 'active'` (`functions/src/auth/identity.ts:57-61`); `resolveCommercialSubject` calls it (`identity.ts:95`); company access also checks `company.status === 'active'` (`identity.ts:103`).
- **App Owner** is claim-based: `requireAppOwner` checks `token.platformRole === 'app_owner'` AND `email_verified` (`identity.ts:48,53-55`) — independent of `status`.
- **Rules** gate customer content by tenant membership/ownership; `users` update already restricted to `['displayName','updatedAt']`. **Rules do not currently check account `status` on content writes** — the central gap this spec closes.
- **Firestore isolation:** all backend writes target `dsbc-production`; `(default)` (Task360) untouched.

## 4. Design decisions (approved by founder, 2026-10-03)

- **D1 — Workspace timing:** keep the shell. Registration still writes `users`+`tenants`+(`companies`) in one batch, but with `status:'pending_approval'`. Approval flips them to `active`. No record is "active-looking" before approval.
- **D2 — Free entitlement:** approval does **not** create a subscription. Free entitlement continues to resolve from the default Free plan (no `subscriptions/` doc), exactly as today.
- **D3 — Registration audit:** authored server-side by a new `onUserCreated` Firestore trigger (clients cannot write audit logs).
- **D4 — Scope:** remove nothing from the design below.

## 5. Account state machine

Authoritative state is `users/{uid}.status`, mirrored onto `tenants/{id}.status` and `companies/{id}.status`.

| State | Meaning | Set by |
|---|---|---|
| `pending_approval` | registered (email may or may not be verified), no app access | registration (create) |
| `active` | approved; normal access | `approveCustomer` (App Owner); existing reinstate paths |
| `suspended` | access revoked by App Owner | `adminSetCustomerSuspension` (existing) |
| `cancelled` | account closed | existing lifecycle |
| `expired` | lapsed | existing lifecycle / reconciler |

**Invariants:**
- Only backend code (Admin SDK / callables) transitions `status`. Clients can never write `status` (rules pin it on create and forbid it on update).
- `status` (account activation) is a **separate axis** from subscription status; neither implies the other.
- The authoritative access decision is server-side (`requireActiveProfile` + rules `isActiveAccount()`).
- Allowed transitions (enforced in `approveCustomer` and existing admin ops): `pending_approval → active`; `active → suspended/cancelled/expired`; reinstate `suspended → active`. `approveCustomer` only performs `pending_approval → active` (and is a no-op on already-`active`).
- **Email verification is a hard precondition for activation.** `approveCustomer` must refuse to activate an account whose owning Firebase Auth user does not have `email_verified === true`. Email verification alone never activates (that still requires the App Owner), **and** the App Owner can never activate an unverified account — both conditions are necessary. This mirrors the existing `setAppOwner` rule that refuses unverified accounts.

## 6. Registration changes

**File: `src/services/registrationModel.ts`**
- Introduce `AccountStatus` type and a constant `INITIAL_ACCOUNT_STATUS = 'pending_approval'`.
- `buildRegistrationDocuments` sets `status: 'pending_approval'` on the `user`, `tenant`, and `company` records (replacing the three/five `'active'` literals). The `TenantRecord.status` type widens from `'active'` to `AccountStatus`.

**File: `src/services/authService.ts`**
- `registerAccount` flow unchanged (Auth create → batch → `sendVerificationEmail`, rollback on batch failure). It now produces pending records. Return type unchanged.

**File: `src/types` (UserProfile / Company / Tenant)**
- Widen `status` field type to the `AccountStatus` union (currently `'active'` only where typed).

**No** cards, employees, subscriptions, leads, slugs, analytics, or published content are created — unchanged.

## 7. Enforcement (defense in depth)

### 7a. Firestore rules (`firestore.rules`)
- Add helper:
  ```
  function accountStatus(uid) {
    return get(/databases/$(database)/documents/users/$(uid)).data.status;
  }
  function isActiveAccount() {
    return isSignedIn() && accountStatus(request.auth.uid) == 'active';
  }
  ```
- **Pin create-status:** on `users`, `tenants`, `companies` create, require the written `status == 'pending_approval'` (a modified client cannot self-create `active`). Keep existing field/role/tenant validation.
- **Forbid client status change:** `users` update continues to allow only `['displayName','updatedAt']` (already true) — `status` remains server-only. Same principle for `tenants`/`companies` admin-editable fields (status excluded, as today for companies at `firestore.rules` update restrictions).
- **Gate content writes on active:** require `isActiveAccount()` (in addition to existing ownership/membership) on every customer content-write path: `cards`, `digitalIdentityProfiles`, company-content writes, publishing-state fields, `leadEvents`/`connectionEvents` creation by the owner, and any client-written upload metadata. Reads of the user's own account/status remain allowed while pending.
- Audit-log, subscription, entitlement, invoice, platformConfig collections remain `write: if false` (unchanged).
- Per-write `get()` on the user doc is accepted (bounded cost, correctness over micro-optimization).

### 7b. Backend callables (`functions/src/`)
- Confirm/ensure `requireActiveProfile` is enforced on every customer callable: `consumeQuota` (`usage/quota.ts`), `uploadAsset` (`usage/uploads.ts`), `setPublishingState` (`publishing/service.ts`), `setMyDeletionRequest` (`customers/service.ts`), `cancelMySubscription`, `checkEntitlement`, `getMyCommercialState` (via `resolveCommercialSubject`). Add the gate where any customer callable does not already route through it. (`requireActiveProfile` already denies non-`active`, so adding `pending_approval` requires no change to the gate itself — only to coverage.)
- App Owner callables unchanged (claim-based, exempt).

### 7c. Pending-safe read
- Add callable **`getMyAccountState`** (auth required, **no** active-gate): returns `{ status, emailVerified }` only. Lets a pending/unverified user see "Awaiting approval" / verification state and nothing else. No entitlements, no tenant data.

## 8. Approval operation

**New callable `approveCustomer`** (`functions/src/customers/service.ts` or a new `activation.ts`), exported in `functions/src/index.ts`:
- **Authorization:** `requireAppOwner(caller)` (claim + `email_verified`).
- **Input (validated):** `{ customerType: 'individual'|'company', customerId: string (ID_PATTERN), reason: string (required) }`.
- **Logic (single transaction):**
  1. Resolve the target (`users/{uid}` and, for company, `companies/{id}` + `tenants/{id}`) via server-side lookup; `fail('not-found')` if absent. Determine the account's owning Firebase Auth uid (the `users/{uid}` for individuals; `tenants/{id}.ownerUid` for companies).
  2. **Email-verified precondition:** read the owner via Admin SDK `getUser(ownerUid)`; if `emailVerified !== true` → `fail('failed-precondition', 'EMAIL_NOT_VERIFIED')`. The App Owner cannot activate an unverified account. (Also refuse a disabled Auth account.)
  3. Read current `status`. If already `active` → **idempotent no-op**: return `{ status:'active', alreadyActive:true }`, write **no** duplicate records.
  4. If `status !== 'pending_approval'` (e.g. suspended/cancelled) → `fail('failed-precondition')` (approval is only for pending; use existing reinstate paths otherwise).
  5. Set `status:'active'` on `users/{uid}` (and `tenants/{id}`, `companies/{id}` where present).
  6. **No** subscription/entitlement/content created (D2).
  7. Append immutable `ACCOUNT_ACTIVATED` audit (actor = App Owner, target, tenantId, previousValue `{status:'pending_approval'}`, newValue `{status:'active'}`, required `reason`, source `App Owner Activation`).
- **Idempotency:** repeated approval never duplicates companies/employees/subscriptions/cards/entitlements (step 2 guard + create-if-missing nowhere needed because no new records are created).

**New callable `adminListPendingCustomers`** (App Owner only): returns real registration info for `users` with `status == 'pending_approval'` — `{ uid, displayName, email, accountType, companyName?, createdAt, emailVerified, status }`. `emailVerified` is read from Firebase Auth (Admin SDK `getUser`) per uid, not from a client field. No fabricated metrics.

## 9. Registration audit trigger

**New Firestore trigger `onUserCreated`** (`onDocumentCreated users/{uid}`, database `dsbc-production`, region asia-south1), in `functions/src/` and exported in `index.ts`:
- On a new `users/{uid}` doc, append an immutable `ACCOUNT_REGISTERED` (a.k.a. `ACCOUNT_PENDING_APPROVAL`) audit record (actor = the registering user as subject, target = the account, newValue `{status}`, source `Registration`).
- Idempotent per doc (create event fires once; guard against duplicate audit if re-invoked).
- This becomes the **42nd** function. Deploy-time note: first-deploy Eventarc propagation may require a retry (observed in 12c); not part of this task (no deploy here).

## 10. Activation policy abstraction

- Add `customerActivationMode: 'manual_approval' | 'auto'` to `INITIAL_GLOBAL_POLICY` (`shared/domain/catalogue.ts`), default **`manual_approval`**.
- Centralize the activation mutation in one backend function (`activateAccount(...)`) that `approveCustomer` calls. A future `auto` mode can call the same function from the `onUserCreated` trigger (or registration path) **without** touching registration/entitlement/authorization. **AUTO is not implemented now**; the policy is read and enforced as `manual_approval`.
- `updateGlobalPolicy` gains `customerActivationMode` as an editable field (App Owner only, validated against the enum) so the mode can be changed later without a deploy.
- Bootstrap impact: `INITIAL_GLOBAL_POLICY` gains one field; the global-policy record still counts as one bootstrap record. Dry-run remains control-plane-only (≈40 records), **zero customer records**.

## 11. App Owner exemption

- `requireAppOwner` is claim + `email_verified`; the approval gate does not apply to it (Phase 8 satisfied by construction).
- `scripts/admin/setAppOwner.ts` additionally sets the owner's `users/{uid}.status = 'active'` (merge) for cleanliness, so the owner's own profile is not left `pending_approval`. No fake owner, no seed.
- Bootstrap/control-plane creation is unchanged and remains distinct from customer data.

## 12. UI

- **Keep** `EmailVerificationBanner` and the D29 verification flow unchanged.
- Add a post-sign-in **"Awaiting approval"** state (reads `getMyAccountState`): shown to verified, `pending_approval` customers — explains their account is awaiting App Owner approval; offers sign-out and (if supported) deletion request. No feature UI is reachable while pending.
- **App Owner dashboard:** add a **Pending Customers** queue (from `adminListPendingCustomers`): Name, Email, Registration date/time, Email-verified, Customer type, Company name (if any), Status, Approval history. **Approve** action requires a reason and calls `approveCustomer`. No fabricated metrics or content.

## 13. Error-leak fix

- `functions/src/usage/uploads.ts:70` — replace `fail('internal', \`Upload failed: ${err.message}\`)` with a generic client message (e.g. `fail('internal', 'Upload failed.')`) and log the detailed error server-side. Add/adjust a test asserting no raw error detail reaches the client.

## 14. Legacy production hazards (separate small change)

As an **independent** commit (not mixed with the feature):
- Delete `functions/.env.v-nexus-lite` and remove the `!functions/.env.v-nexus-lite` un-ignore at `.gitignore:17` (stale OLD-prod backend env; wrong-project deploy hazard; contains no secrets).
- Delete `firebase-applet-config.json` (orphan OLD-prod client config, not imported by runtime; only referenced by `scripts/directive27/secretsAudit.mjs:27` as a known-public file — update or drop that reference).
- Verify no active code path imports either file before deletion.

## 15. Migration

- **None in production:** `dsbc-production` has zero customers (bootstrap dry-run: existing 0). No existing accounts to migrate to `pending_approval`.
- Emulator/dev seeders and demo data continue to use `status:'active'` (dev/test only; never promoted). Any seeder that targets a non-demo project must remain blocked.

## 16. Tests (emulator/local only; none against production)

Add/maintain across unit (`vitest`), rules (`vitest.rules`), and backend emulator suites:

| ID | Assertion |
|---|---|
| REG-001 | Real registration creates `users/{uid}.status == 'pending_approval'`. |
| REG-002 | Registration creates no dummy/sample content (only user/tenant/[company]). |
| REG-003 | Registration does not publish a card / assign a public slug. |
| REG-004 | Registration creates no contacts/leads. |
| REG-005 | Email verification alone does NOT change status to active. |
| REG-006 | Pending customer cannot use normal features (callable denies). |
| REG-007 | Pending customer cannot `consumeQuota`. |
| REG-008 | Pending customer cannot `uploadAsset`. |
| REG-009 | Pending customer cannot publish (`setPublishingState`) nor write `cards`/`digitalIdentityProfiles` via rules. |
| REG-010 | Non-App-Owner cannot call `approveCustomer`. |
| REG-011 | Unverified App Owner cannot perform App Owner operations. |
| REG-012 | Verified App Owner can list pending customers. |
| REG-013 | Verified App Owner can approve a pending customer. |
| REG-014 | Approval requires a reason (missing reason → invalid). |
| REG-015 | Approval writes an immutable `ACCOUNT_ACTIVATED` audit record. |
| REG-016 | Approval is idempotent (second call → no-op success). |
| REG-017 | Repeated approval does not duplicate company/workspace. |
| REG-018 | Repeated approval does not create/duplicate a subscription (D2: none created at all). |
| REG-019 | Repeated approval does not duplicate entitlement/override. |
| REG-020 | Approved customer becomes `active`. |
| REG-021 | Active customer can use the application (callable + rules allow). |
| REG-022 | Pending customer cannot access another tenant. |
| REG-023 | Customer cannot self-change `accountStatus` (rules). |
| REG-024 | Customer cannot self-change subscription status (rules/backend). |
| REG-025 | Customer cannot self-grant entitlement (rules/backend). |
| REG-026 | Customer cannot self-grant `platformRole` (rules/claims). |
| REG-027 | Production bootstrap creates platform/control-plane records only. |
| REG-028 | Production bootstrap creates zero customer records. |
| REG-029 | No demo seed is permitted against a non-demo project. |
| REG-030 | Manual activation works with `PAYMENTS_ENABLED=false`. |
| REG-031 | Razorpay remains completely disabled (checkout/confirm fail-closed; webhook HMAC fail-closed). |
| REG-032 | Offline/manual entitlement remains App-Owner-controlled (unchanged admin paths). |
| REG-033 | `approveCustomer` refuses to activate an account whose email is not verified (`EMAIL_NOT_VERIFIED`); after the user verifies, approval succeeds. |

Plus:
- **Fix 3 stale env tests** in `tests/unit/environment.test.ts` (ENV-020, ENV-021, +1) to the dedicated-project reality (`dedicatedProject === true`; the proposal now equals production). Only expectation updates — no weakening, no snapshot mass-update.
- **uploads error-leak test** (§13).
- Re-run: `npm run test:unit`, `npm run test:rules`, `npm run test:integration`, `npm run test:backend`, and the production preflight. Record PASS/FAIL/BLOCKED faithfully.

## 17. Out of scope / explicitly NOT done in this task

- No production deployment, no bootstrap, no customer registration, no App Owner grant, no activation against production.
- No change to Razorpay secrets; `PAYMENTS_ENABLED` stays `false`; no DNS; no custom domain; no staging project.
- No auto-activation implementation (policy present, value `manual_approval`).
- No unrelated refactors; no demo/sample data anywhere near production.

## 18. Acceptance criteria (must all hold, verified on emulator)

Real customer can register; email verification works; newly registered customer is `pending_approval`; email verification alone does not activate; **`approveCustomer` refuses to activate an unverified account (email_verified required)**; App Owner can see and approve a pending (verified) customer; approval requires a reason, is audited, and is idempotent; approved customer becomes active and can use normal features; pending customer cannot use normal features (backend + rules); no dummy data of any kind is created; bootstrap creates platform records only and production stays customer-empty until real registration; `PAYMENTS_ENABLED` false; Razorpay disabled; offline/manual activation remains App-Owner-only; App Owner remains claim + `email_verified`; tenant isolation intact; full relevant tests pass; 3 stale env tests corrected; no unrelated files changed; no production deployment performed.

## 19. Files expected to change (for the implementation plan)

- `src/services/registrationModel.ts`, `src/services/authService.ts`, `src/types/*` (status type)
- `firestore.rules` (status helper + create-pin + content-write gates)
- `functions/src/customers/service.ts` or new `functions/src/customers/activation.ts` (`approveCustomer`, `adminListPendingCustomers`, `activateAccount`), `functions/src/index.ts` (exports + `onUserCreated` trigger + `getMyAccountState`)
- `functions/src/usage/uploads.ts` (error-leak), coverage checks in `quota.ts`/`publishing/service.ts`
- `shared/domain/catalogue.ts` (`customerActivationMode` in `INITIAL_GLOBAL_POLICY`), `functions/src/entitlements/admin.ts` (`updateGlobalPolicy` field)
- `scripts/admin/setAppOwner.ts` (owner status active)
- UI: awaiting-approval state + App Owner pending queue component(s)
- Tests: unit/rules/backend (REG-001..032), `tests/unit/environment.test.ts` (3 fixes), uploads error test
- Separate change: delete `functions/.env.v-nexus-lite`, `.gitignore:17`, `firebase-applet-config.json`

## 20. Risks

- **Rules `get()` cost** per customer content write (acceptable; correctness first).
- **Access-gate coverage:** must enumerate every customer write path (callable + rule) or a pending user slips through — the primary review focus.
- **42nd function** (`onUserCreated`) deploy may need an Eventarc first-deploy retry (as seen in 12c) — at deploy time, not now.
- **Global-policy field addition** must be reflected in bootstrap/drift detection so it doesn't read as drift.
