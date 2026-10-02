# Directive 25 — Backend authority and persistent SaaS control plane

Status of this document: describes branch `security-foundation/directive-25`.
Nothing here is deployed. Every result quoted below comes from the Firebase
Emulator Suite (project `demo-dsbc`).

## 1. What changed in one paragraph

Before Directive 25, plans, prices, feature matrices, overrides, subscriptions,
invoices, payment status, usage counters, publishing state, pilot records and
their audit logs lived in the browser (`localStorage` + React state). Any user
could edit them with DevTools, and `upgradeSubscription()` turned the caller
into ACTIVE/PAID with no payment. Now all of it lives in Firestore, it is
written only by Cloud Functions (Admin SDK), and `firestore.rules` deny every
client write to it. The browser displays a server-resolved snapshot and asks
the backend for changes; it never decides.

```
Browser (React)
  │  ID token (Firebase Auth)                         reads (rules-scoped)
  │  httpsCallable(name, payload)  ───────────┐      ┌──────────────────────┐
  ▼                                           ▼      │ plans, featureCatalogue│
src/lib/backend.ts ──► Cloud Functions (functions/) ─┤ globalPolicies (public)│
                         │ loadCaller(): uid, verified email, platformRole    │
                         │   claim + users/{uid} (never the payload)          │
                         ├─ entitlements/  resolver + App Owner control plane │
                         ├─ subscriptions/ lifecycle authority + reconciler   │
                         ├─ billing/       PaymentProvider (Razorpay, HMAC)   │
                         ├─ usage/         quota (atomic), seats, uploads     │
                         ├─ publishing/    publishing state, slugs            │
                         ├─ customers/     suspension, pilot, deletion review │
                         └─ audit/         append-only hashed ledger          │
                                  │ Admin SDK (bypasses rules)                │
                                  ▼                                           │
                         Firestore (authoritative) ◄──────────────────────────┘
Razorpay ──HMAC-signed webhook──► razorpayWebhook (HTTP, raw-body verified)
```

## 2. Code layout

| Path | Role |
|---|---|
| `shared/domain/` | One implementation of the commercial rules, imported by both sides: catalogue baseline (5 standard plans), Directive 18 resolver, subscription lifecycle, commercial metrics, usage keys, slug rules. Pure, no I/O. |
| `functions/src/auth/identity.ts` | Caller identity from the verified token + server records; App Owner = `platformRole == 'app_owner'` claim **and** verified email; commercial subject (company / individual / employee with personal subscription). |
| `functions/src/entitlements/` | Firestore control plane loader, server resolver (`getEffectiveEntitlement`, `can`, `getLimit`, `getUsage`, `checkLimit`, `isFeatureLocked`), App Owner mutations (plans, pricing, feature matrix, duplicate/archive, overrides, global policy / safety, bootstrap). |
| `functions/src/subscriptions/service.ts` | Lifecycle authority (TRIAL, ACTIVE, PAST_DUE, GRACE, CANCELLED, EXPIRED, SUSPENDED, COMPLIMENTARY), App Owner commercial controls, customer cancellation, scheduled reconciler. |
| `functions/src/billing/` | `PaymentProvider` (`createOrder`, `verifyPayment`, `verifyWebhookSignature`, `parseWebhookEvent` / `processWebhookEvent`, `reconcilePayment`), checkout, verified activation, webhook ledger, invoices. |
| `functions/src/usage/` | `consumeQuota` (metered, transactional, idempotent), seat enforcement trigger, content counts trigger, backend-only uploads with storage reservation. |
| `functions/src/publishing/`, `functions/src/customers/` | Publishing state + slug ownership; customer suspension, pilot classification, deletion requests. |
| `functions/src/audit/ledger.ts` | `appendAudit()` — `create()` only, in the same transaction as the mutation, SHA-256 content hash. |
| `src/lib/backend.ts` | The browser's only mutation path (callables). |
| `src/services/commercialStore.ts` | Read-only browser cache: public control plane, the caller's server snapshot, App Owner views. Purges legacy localStorage keys. |
| `src/services/{entitlement,subscription,publishing,slug,pilot}Service.ts` | Facades with the Directive 18–23 APIs, now display + request only. |

## 3. Firestore schema (all written by the backend only)

| Collection / document | Content | Client read |
|---|---|---|
| `plans/{planId}` | plan policy, price, currency, billing cycle, features, `archived`, `version`, `updatedBy`, server timestamps | public |
| `featureCatalogue/{featureId}` | feature definition + `dependsOn` | public |
| `globalPolicies/platform` | global policy and platform safety controls (`maintenanceMode`, `allowSelfRegistration`, `enforceLimitsStrictly`, defaults, `paymentGraceDays`) | public |
| `entitlementOverrides/{type}_{id}__{featureId}` | rule, `grantType` (permanent / until_date / trial / complimentary), `validFrom`, `expiresAt`, explicit `tenantId` | App Owner; the targeted customer |
| `subscriptions/{type}_{id}` | lifecycle status, plan, period, payment status, `tenantId`, `statusBeforeSuspension` | App Owner; the customer |
| `invoices/INV-YYYY-NNNNNN` | issued by the backend only; `counters/invoices` sequence | App Owner; billing contact |
| `paymentOrders/{id}` | server-priced checkout orders | App Owner; billing contact |
| `webhookEvents/razorpay_{eventId}` | webhook idempotency ledger | App Owner |
| `usageCounters/{type}_{id}__{featureId}__{period}` | measured (COUNT, EMPLOYEES, STORAGE_MB: `current`) and metered (REQUESTS, AI_USAGE: `YYYY-MM`) usage | App Owner; own tenant |
| `usageLedger/{uid}_{operationId}` | idempotency ledger for `consumeQuota` | App Owner |
| `publishingRecords/{entityId}`, `slugs/{slug}` | publishing state; global slug ownership | PUBLISHED records + slugs public; members see their own |
| `customerClassifications/{type}_{id}` | pilot flag/stage, account lifecycle (deletion requested / retention review / purge approved) | App Owner; the customer |
| `entitlementAuditLogs`, `commercialAuditLogs`, `platformAuditLogs` | append-only ledger (`schema dsbc.audit/v1`, actor, previous/new value, reason, source, `contentHash`, server `timestamp`) | App Owner |

Backend-owned fields mirrored onto tenant content (clients can neither set
nor clear them): `employees.seatState/seatLockedAt` (seat beyond the plan
limit — hidden publicly, retained), `platformSuspended` (App Owner
suspension), `publicationHidden` (owner set DRAFT/UNPUBLISHED), and
`companies.planId` (display mirror of the subscription).

All timestamps are `FieldValue.serverTimestamp()`; business dates (period end,
trial end, grace end, override expiry) are computed from the server clock.

## 4. Security rule changes (tightening only)

- New server-only collections: `featureCatalogue`, `usageCounters`,
  `usageLedger`, `paymentOrders`, `webhookEvents`, `counters`,
  `publishingRecords`, `slugs`, `customerClassifications`, `platformAuditLogs`.
- `seatState`, `seatLockedAt`, `platformSuspended`, `publicationHidden` cannot be
  written by clients (create or update) and hide employees, cards, profiles and
  companies from the public.
- `storage.rules`: no client writes; files go through `uploadAsset`.
- Directive 24 rules are otherwise unchanged; the 433-test suite still passes.

## 5. Authorization model

- Identity: `request.auth` (verified ID token) + `users/{uid}`. The payload is
  validated against an allow-list of fields; anything else (`role`,
  `companyId`, `customerId`, `planId`, `price`, `status`, `entitlement`) is
  rejected with `invalid-argument` or simply has no effect.
- App Owner: `platformRole == 'app_owner'` custom claim on a verified email.
  A profile document saying `app_owner` grants nothing.
- Customers may only: read their snapshot, ask `checkEntitlement`, consume
  metered quota, start a checkout, confirm a payment (verified), cancel,
  publish/unpublish what they own, upload within quota, request deletion.
- Every privileged mutation requires a reason and writes its audit record in the
  same transaction.

## 6. Entitlement resolution (Directive 18 preserved)

Individual override > Company override > Plan policy > Global policy >
Catalogue baseline. Overrides outside `[validFrom, expiresAt)` are ignored, so
temporary grants fall back automatically. Dependencies disable a child whose
prerequisite is not granted. A suspended account is fully locked. The plan
used is the one the subscription grants **at read time**: an expired trial,
complimentary grant or grace period falls back to the free plan immediately,
and the daily reconciler persists the transition. Content is never deleted
(DATA != DELETED, FEATURE = LOCKED).

## 7. Quota

- Metered (REQUESTS, AI_USAGE, and AI features): `consumeQuota` reads the
  counter and checks the limit **inside one transaction**, with an
  operation-id ledger for idempotency. Concurrent requests cannot overspend.
- Measured (COUNT, EMPLOYEES, STORAGE_MB): computed by triggers / the upload
  path from stored data; never reported by a client. Seats beyond the limit are
  locked (hidden, retained) and unlocked when seats return.

## 8. Payments (prepared, not active)

`PAYMENTS_ENABLED=false`. With payments disabled `createCheckoutOrder` and
`confirmPayment` refuse before any state change. When enabled: the backend
prices the order from `plans/{id}`, verifies the checkout HMAC with
`RAZORPAY_KEY_SECRET`, re-reads the payment from Razorpay and compares amount,
currency and order before activating; webhooks are verified with HMAC over the
raw body (`RAZORPAY_WEBHOOK_SECRET`, constant-time) and are idempotent per
event id and per order. Secrets are Secret Manager params; the emulator uses
random values in git-ignored `functions/.secret.local`.
**Not production-ready**: no request has been made to Razorpay.

## 9. Running it

```bash
npm test                      # unit + D24 rules + integration + backend authority
npm run test:backend          # Auth/Firestore/Functions/Storage emulators, AUTH-001..025
node scripts/directive25/mutationTest.mjs       # authorization mutants
node scripts/directive25/backendReadiness.mjs   # docs/directive-25/backend-readiness.json
VITE_DSBC_USE_EMULATORS=true npm run dev        # the app against the emulators
```

## 10. Before any deployment (not done, deliberately)

See `deploymentBlockers` in `backend-readiness.json`: deploy functions + rules
to the named database, set `DSBC_FIRESTORE_DATABASE`, grant the App Owner claim,
bootstrap the control plane, migrate live customers' plans into
`subscriptions/*` (otherwise they resolve to Free with content kept), and run a
real Razorpay test before setting `PAYMENTS_ENABLED=true`.
