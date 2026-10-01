# Directive 24: architecture changes (Phases 0–4)

Branch `security-foundation/directive-24`, starting from baseline `d9a95d7`. Nothing has been deployed: the live Firebase project still runs the baseline rules.

## Documents in this folder

| File | Purpose |
|---|---|
| `phase-0-baseline.json` | Machine-readable baseline, generated from commit `d9a95d7` |
| `phase-1-client-authority-classification.json` | Every client-controlled value that affects security, classed A/B/C/D, with remediation phase and status |
| `phase-0-4-report.json` | Machine-readable report for this stage |
| `evidence/rules-suite-vs-baseline-rules.json` | The same 433-test suite run against the baseline rules: 175 passed, 258 failed |
| `evidence/rules-suite-vs-directive24-rules.json` | The suite run against the new rules: 433 passed |

## 1. Identity and tenancy model (Phase 2)

Registration now establishes identity plus the account type the user asked for. Everything else is derived:

| Requested type | `users/{uid}` | Tenant | Company |
|---|---|---|---|
| individual | `role: employee`, `companyId: null`, `tenantId: ind_<uid>`, `accountType: individual` | `tenants/ind_<uid>` | none |
| company | `role: company_admin`, `companyId: co_<uid>`, `tenantId: co_<uid>`, `accountType: company` | `tenants/co_<uid>` | `companies/co_<uid>` on plan `company_free` |

- **Where the logic lives.** `src/services/registrationModel.ts` builds these documents and is shared by the client and the tests. `firestore.rules` re-checks every field independently.
- **One atomic batch.** All the documents are written together. A user can register exactly once, because the rules only allow tenant and company creation while the caller's own `users` document is being created.
- **Individuals keep `companyId: null`.** The entitlement layer treats any `companyId` as a company customer, so the individual tenant lives in a separate `tenants` registry instead.
- **Self-registered companies** carry `kind: 'company'` and `ownerUid`. Both are immutable for company admins.
- **Failure leaves nothing behind.** If the batch is rejected, `registerAccount` deletes the new Auth user.

## 2. App Owner authority (Phase 2)

- **Authority** is the custom claim `platformRole == 'app_owner'` together with `email_verified == true`.
- **How it's granted.** Only `scripts/admin/setAppOwner.ts` can set it, using Admin SDK credentials. Every grant or revocation is written to `securityAuditLogs`.
- **What it replaces.** The email allow-list in the rules and any trust in `users/{uid}.role` are both gone.
- **In the UI.** `AuthContext` derives the role with `lib/authority.deriveEffectiveRole`. A profile role of `app_owner` without the verified claim produces *no* role. UI visibility is still not a security boundary; the rules are.

## 3. Demo and test features (Phases 2–3)

- **Development only.** Demo personas, the persona switcher, the default Acme-admin persona, `setCustomUserProfile`, and the legacy in-browser security test runner exist only when `import.meta.env.DEV` is true (`lib/runtimeFlags.ts`). They are removed from the production build, not hidden: the bundle scan finds zero occurrences.
- **No seeding from the browser.** Seeding uses `npm run seed` (`scripts/admin/seedDemoData.ts`, Admin SDK), which targets the emulator by default and refuses production-like projects.
- **Legacy scripts are emulator-only.** `scripts/verifyRules.ts` and `scripts/seedDatabase.ts` refuse to run without `FIRESTORE_EMULATOR_HOST`.

## 4. Firestore rules (Phases 2–4)

- **No bootstrap paths.** No rule grants access because a document is absent; all 29 lines that referenced `company_acme` are removed.
- **Shared tenant helpers** require an active profile. Suspended companies can't be administered.
- **Commercial collections are read-only for every client:** plans, globalPolicies, entitlementOverrides, subscriptions, invoices, entitlementAuditLogs, commercialAuditLogs, securityAuditLogs. Company invoices are readable by company admins only.
- **Users** may change only `displayName`.
- **`connectionEvents`:** only a party to an existing connection, acting as themselves, may write.
- **Public contact exchange** must match the exact visitor payload sent to a real active employee of that company.

## 5. Test architecture

| Command | Scope | Result |
|---|---|---|
| `npm run test:unit` | pure logic | 21/21 |
| `npm run test:rules` | Firestore emulator, real authenticated identities | 433/433 |
| `npm run test:integration` | Auth + Firestore emulators, Admin SDK scripts | 6/6 |
| `npm test` | all three | exit 0 |

- **Emulator only.** Project IDs are `demo-*`, and `FIRESTORE_EMULATOR_HOST` is required.
- **Errors are not passes.** `assertFails` accepts only PERMISSION_DENIED, and a harness test proves that a network error or a successful write fails the test.
- **Controls.** Every group of denials has positive controls alongside it.
- **Mutation check.** Re-introducing an owner claim without email verification, a self status change, or a bootstrap clause on `plans` each makes the suite fail.
- **`npm run test:security`** now runs the emulator rules suite.

## 6. Behaviour changes users may notice

| Change | Why |
|---|---|
| Visitors in production are no longer auto-signed-in as the "Acme Company Admin" demo persona; they see the public marketing site | Demo personas are development-only |
| A failed sign-up shows an error instead of creating a local fake session | Fail closed |
| Unauthenticated visitors' contact-exchange requests no longer write a `CONNECTION_REQUESTED` timeline event | The write was already wrapped in try/catch and was never readable by the recipient; the request itself still succeeds |
| An existing account whose profile says `app_owner` but has no claim sees no role until `setAppOwner` is run for it | App Owner requires the claim |

## 7. Deployment notes (not done; needs a decision)

- **Grant the claim before deploying.** The real App Owner must receive it first (`npm run admin:set-app-owner -- --project <id> --confirm-project <id> --email <owner>`, with a verified email). Otherwise the owner loses access as soon as the rules go live.
- **The live app uses a named Firestore database** (`ai-studio-37d17c3e-…`). `firebase.json` currently deploys rules to `(default)` only. Deploying correctly needs the multi-database form of the `firestore` config.
- **Rules and client go together.** The new client is required for registration to work under the new rules, so both must be deployed at the same time.
