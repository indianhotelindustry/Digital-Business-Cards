# Directive 34 — Google-only authentication, onboarding & commercial activation

Audit date: 2026-10-04 (read-only; code at 91685bc, production task360-ift / dsbc-production).
This file is the directive's §26 "short implementation plan". The detailed,
test-first task list for each phase lives in `docs/superpowers/plans/`.

## 1. Audit findings (measured)

### Production
| Fact | Value |
|---|---|
| Firebase Auth providers (project-wide) | email/password **enabled**, google.com **enabled** |
| Authorized domains | localhost, task360-ift.firebaseapp.com, task360-ift.web.app |
| DSBC users (`dsbc-production/users`) | 2: App Owner `qwDf…` (gmail.com) and In Future Technologies owner `Xj7Q…` (infuturetechnologies.com). Both `active`, both **password-only**, both email-verified. |
| Companies | 2: `co_Xj7Q…` In Future Technologies (active, company_free, owner Xj7Q…) and `DP71jsze…` "SHSPL" (active, company_free, **no owner, no user can sign in to it**; created 2026-10-04 19:06 IST by the App Owner dashboard's client-side "onboard company" form) |
| Employees / cards | 1 / 1 (Moolchand, published) |
| Individuals / pending accounts | 0 / 0 → **no status migration is needed** |

Firebase Auth is per **project**, and task360-ift also hosts Task360. The project-level
password provider must therefore **never be disabled** for DSBC's sake. DSBC enforces
"Google only" in its own backend and rules (token `firebase.sign_in_provider == 'google.com'`).

### Code
1. **Auth is email/password only** (`src/services/authService.ts`); there is no Google sign-in,
   no password reset and no account linking. `AuthModal.tsx` is the only mounted auth UI;
   `CustomerRegistrationModal.tsx` is dead code.
2. **Registration is a client-side batch** (`registrationModel.ts`) pinned by rules to
   `status: 'pending_approval'` and `company_free` (`firestore.rules:161-224`). No duplicate check
   beyond "users/{uid} must not exist". `isValidSelfRegisteredCompany` has no `hasOnly`, so extra
   fields can be smuggled onto a self-registered company.
3. **D30 gate**: `pending_approval` is hard-wired in 15 places (see D30 audit); the
   `customerActivationMode` policy is stored but never read. `approveCustomer` requires a verified
   email and is App Owner only. Bypass: `adminSetCustomerSuspension` on a pending account then
   reinstate → `active` with no approval.
4. **No employee login exists.** Nothing in the product links a Firebase user to an `employees/{id}`;
   there is no invitation model.
5. **Individuals are broken**: they are stored as `role: 'employee'` with `employeeId: null`, land in
   the employee portal (which falls back to the demo id `emp_acme_rahul`), and the rules give them
   no way to create their own card.
6. **No capability layer.** Three hard-coded roles (`app_owner`, `company_admin`, `employee`) are
   checked separately in rules, functions, `App.tsx`/`Sidebar` and individual views. Entitlements
   are plan/override data resolved server-side, enforced only for publishing, the public profile,
   seats (locked after the fact), storage and metered quota; `lead_capture`, `contact_exchange`,
   analytics and AI features are not enforced anywhere.
7. **Payments**: online activation (`activatePaidOrder`) is HMAC-verified and idempotent per order but
   only flips the *subscription*, never account status. `adminRecordInvoicePayment` only marks the
   invoice PAID (no subscription, no account change). `adminChangeCustomerPlan` unlocks a paid plan
   with `paymentStatus: PENDING`. The webhook has no `PAYMENTS_ENABLED` check.
8. **App Owner browser writes** to `users`/`companies` are unrestricted and unaudited and are used by
   "onboard company" (`AppOwnerDashboard.tsx:112-149`), which also falls back to demoStore on error.

## 2. Target architecture

```
Google sign-in (Firebase Auth, provider google.com)
  → Firebase UID (authoritative)
  → resolveSession(intent)            [backend callable]
       users/{uid}  ─ membership: companyId + role + employeeId
       invitations  ─ explicit, matched to the Google-verified email, single-use, expiring
  → account lifecycle   users/tenants/companies.status: pending_activation | active | suspended | cancelled | expired
  → commercial state    tenants/{id}.commercial: { state, method, reference }  (backend-only)
       free | payment_pending | payment_received | offline_payment_pending | manually_activated | payment_failed | payment_expired
  → role + capabilities (materialised, backend-written)  ∩  plan entitlements
  → workspace
```

* **Registration moves to the backend** (`registerAccount` callable). The client can no longer
  create `users`/`tenants`/`companies`; rules close those creates. Duplicate protection is by UID.
* **Activation is derived from the commercial path**, never a universal approval:
  free → `active` immediately; paid online → `pending_activation` + `payment_pending` until the
  verified payment path (`activatePaidOrder`) also activates the account; offline → App Owner
  `confirmOfflinePayment` (App Owner only, reason, reference, idempotent, audited).
* `pending_approval` is retired as a *state*; reads treat any legacy `pending_approval` as
  `pending_activation` (production has none). `approveCustomer` becomes the internal
  implementation of `confirmOfflinePayment` / manual activation.
* **Invitations** (`invitations/{id}`, backend-only): App Owner offline onboarding creates an
  *owner* invitation; company admins create *employee* invitations. A Google sign-in whose verified
  email equals an open invitation's email may accept it — the email is matched, never typed by the
  person signing in.
* **Google-only enforcement** (after migration): backend `loadCaller` and the rules require
  `sign_in_provider == 'google.com'`. Until both production users have linked Google, password
  sign-in stays available only behind a "legacy sign-in → link Google" path.
* **Capabilities**: catalogue in `shared/domain/capabilities.ts`; role defaults + App Owner
  role/company/user overrides; the backend materialises each member's effective access
  (capability ∩ plan entitlement) onto a backend-only field that rules and callables both check,
  so client-side Firestore writes are covered too.

## 3. Phases (each independently testable and deployable)

| Phase | Delivers | Production effect |
|---|---|---|
| **1. Google identity + backend registration** | New sign-in screen (4 entries, one Google service, intents), `resolveSession`, `registerAccount` (free individual/company → active; duplicate prevention), rules close client registration creates, error/state screens, mobile 100dvh shell, "link Google" for signed-in password users | New sign-ups work with Google; existing users keep working and can link Google |
| **2. Migration + Google-only enforcement** | Link both production users (user-mediated), verify same UID via `accounts:lookup`, then enforce `google.com` in backend + rules; password UI removed | Google-only for DSBC; project provider left enabled (Task360) |
| **3. Invitations + offline onboarding** | `invitations`, owner invitation via App Owner `adminOnboardCompany` (replaces client-side create), employee invitations from Employee Management, `confirmOfflinePayment`, "payment confirmation pending" screen, fix suspend/reinstate bypass, attach an owner to SHSPL | App Owner can onboard a paid offline tenant end to end; employees can log in |
| **4. Individual workspace** | Individuals get their own card/profile (role `individual`, rules + UI), no demo fallbacks | "Create Free Card" acceptance |
| **5. Capabilities + effective access** | Capability catalogue, role/override model, materialised access, enforcement in rules + callables, App Owner Roles tab + effective-access inspector | RBAC ∩ entitlements enforced |
| **6. Paid online state machine** | `payment_pending` registration, `activatePaidOrder` activates account, webhook `PAYMENTS_ENABLED` guard, frontend-success-cannot-activate tests | Ready; stays off while `PAYMENTS_ENABLED=false` |

Every phase: TDD, AUTH-0xx tests from the directive mapped to the owning phase, full regression
(unit, rules, integration, backend, browser), preflight, explicit approval immediately before any
production deploy, no demo data, `(default)` database untouched.
