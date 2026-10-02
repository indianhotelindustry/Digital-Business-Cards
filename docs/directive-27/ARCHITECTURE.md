# Directive 27 — Architecture

Directive 27 moves DSBC from "three-customer demo certified on the emulator"
(D26) to "deployable under control". It builds the production infrastructure
foundation. It deploys nothing.

```
D24 security foundation → D25 backend authority → D26 public journey + 3-customer demo
  → D27 production infrastructure + controlled deployment foundation (this)
  → controlled live deployment → production certification
```

## Phase map

| Phase | What exists now | Main files | Tests |
|---|---|---|---|
| 1 Environment separation | One registry; build-time selection only; client + backend fail closed; production deploy config; offline preflight; secrets audit | `config/environments.json`, `src/lib/environment*.ts`, `src/lib/firebase.ts`, `functions/src/shared/environment.ts`, `firebase.production.json`, `.firebaserc`, `scripts/directive27/preflight.ts`, `secretsAudit.mjs` | ENV-001..016 |
| 2 Production bootstrap | Create-if-missing plans, feature catalogue, global policy, platform config (reserved slugs, payments off), audited; Admin SDK script only | `functions/src/platform/bootstrap.ts`, `scripts/admin/bootstrapProduction.ts`, `scripts/admin/setAppOwner.ts --verify` | BOOT-001..006, D27 RULES |
| 3 Customer migration | discover → preview hash → App Owner approval → validated execute; run lock; immutable trail | `functions/src/platform/migration.ts`, `scripts/admin/migrateCustomers.ts` | MIG-001..007, D27 RULES |
| 4 Platform health | 15 checks measured from authoritative sources; fail-closed aggregate; reconciler heartbeat; honest App Owner UI | `functions/src/platform/health.ts`, `shared/domain/platformHealth.ts`, `PlatformHealthPanel.tsx` | HEALTH-001..004, HEALTH-101..104 |
| 5 Public routing | `/card/{slug}`, `/profile/{slug}`, `/company/{slug}` paths; legacy hash links rewritten; 404 page; hosting serves only public routes, others get HTTP 404; canonical share/QR URLs | `src/lib/routes.ts`, `NotFoundPage.tsx`, `vite.config.ts` (404.html) | ROUTE-001..007, PUBLIC-001..015 (D26) |
| 6 3-customer rehearsal | Real Chrome, three independent customers, clean browsers per URL, persistence, unpublish, 404, legacy links, App Owner | `tests/e2e/production-rehearsal.spec.ts`, `tests/e2e/support/journey.ts` | REH-* (11) |
| 7 Mutation testing | 38 mutants across environment, routing, health, bootstrap, migration, rules; crash-safe harness | `scripts/directive27/mutationTest.mjs` | evidence/mutation-testing.json |
| 8 Deployment gate | Certification script and gate report separating Demo Ready / Deployment Ready / Production Certified | `scripts/directive27/certify.mjs`, `DEPLOYMENT-GATE.md` | certification.json |

## Environment authority

```
.env.<mode> (VITE_DSBC_ENV) ─┐
                             ├─► resolveEnvironment(registry) ─► frozen target ─► firebase.ts (project, DB, bucket, region, emulators)
config/environments.json ────┤                                   └─ throws → main.tsx shows "misconfigured", app never loads
                             └─► evaluateBackendEnvironment(process.env) ─► index.ts assertBackendEnvironment() → refuse to load
functions/.env.<projectId> ──┘                                              └─► Platform Health ENVIRONMENT
```

What was removed: hostname-based detection (`localhost` → DEVELOPMENT,
anything else → PRODUCTION), the localStorage override
(`dsbc_env_override_v2`), the in-app environment switch, the hard-coded live
config in `firebase.ts`, and the invented production values (`dsbc-production`,
`rzp_live_DSBCprod2026`, `support@dsbc.example.com`).

## Health: measured, not displayed

| Check | Authoritative source | Never OK when |
|---|---|---|
| ENVIRONMENT | registry vs runtime | any mismatch |
| AUTH | Admin Auth lookup of the caller | caller disabled / Auth unreachable |
| APP_OWNER | census of all Auth accounts holding the claim | caller not in census; claim holders without verified email → DEGRADED |
| FIRESTORE | read from the bound named database | read fails |
| INDEXES | every backend query shape executed with `limit(1)` | FAILED_PRECONDITION |
| STORAGE | bucket name vs registry + object listing | wrong bucket, 404, 403 |
| FUNCTIONS | the callable executing | — |
| PUBLIC_URL | HTTP to `/pricing` (200) and an unknown path (404) | no origin designated → NOT_CONFIGURED |
| ENTITLEMENTS | plans, catalogue, policy documents | not bootstrapped → FAIL |
| PUBLISHING | platform config + `publishingState == PUBLISHED` count | config missing → DEGRADED |
| AUDIT | audit ledgers readable | — |
| NOTIFICATIONS | backend integrations | none integrated → NOT_CONFIGURED |
| PAYMENTS / WEBHOOK | parameters + processed signed events | enabled without key → FAIL; enabled without verified event → NOT_VERIFIED |
| RECONCILIATION | `platformConfig/reconciliation` heartbeat | none → NOT_VERIFIED; older than 26 h → DEGRADED |

Overall: FAIL if any check fails **or a required check is missing or
duplicated**. OK only if all are OK or intentionally DISABLED. Otherwise DEGRADED.

## Defects found and fixed in this directive

| Defect | Effect | Found by |
|---|---|---|
| Health and migration read `publishingRecords.state`; the service writes `publishingState` | health always reported 0 published records; every customer looked unpublished in the migration preview | REH-SERVER (browser) |
| D22 Launch Center hard-coded `HEALTHY`, `CODE READY (186/186)`, `OPERATIONALLY READY` | an App Owner could read the platform as launch-ready with nothing verified | REH-OWNER (browser) |
| Mutant M17 (`if (false && ind)`) left in `shared/domain/entitlementResolver.ts` by a crashed D25-harness run | individual overrides silently ignored | functions typecheck; the D27 harness now refuses to start while a crash manifest exists |
| Storage `exists()` is unsupported on the emulator | health reported a working bucket as missing | HEALTH-102; the check now lists one object |
| `migration-work/` claimed but not git-ignored | customer names/emails could be committed | review |
| Hash URLs in publishing panel, QR codes, team links, readiness, employee portal | share links depended on client-side hash routing | review + REH-NAV |
