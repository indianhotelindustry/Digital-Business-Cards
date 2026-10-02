# Final gate (Phase 13)

Source: `node scripts/directive27/certify.mjs` (full run) at code commit
`37c5c7b`, with live evidence from `node scripts/directive27/liveProbe.mjs`
(read-only) measured at the same commit. Output:
[../directive-27/certification.json](../directive-27/certification.json).

```
DEMO READY · DEPLOYMENT BLOCKED · LIVE DEPLOYMENT NOT COMPLETE · LIVE ACCEPTANCE NOT EXECUTED · PRODUCTION NOT CERTIFIED
```

| # | Level | Result | Basis |
|---|---|---|---|
| 1 | Demo Ready | **PASS** | All 11 certification lines PASS: 808/808 tests, 41/41 mutants killed, TypeScript, build, secrets audit, preflight with no FAIL |
| 2 | Deployment Ready | **BLOCKED** | 12 blocker entries (grouped into 10 below), all needing an App Owner decision or project change |
| 3 | Live Deployment Complete | **NOT COMPLETE** | live probe: legacy rules still live, 0/41 functions, 0/40 control-plane documents, no DSBC hosting |
| 4 | Live Acceptance Passed | **NOT EXECUTED** | no deployment to test; no live health, no live three-customer run |
| 5 | Production Certified | **FAIL** (`productionCertified = false`) | levels 2–4 not passed |

## Production certification conditions

| Condition | Met? |
|---|---|
| Actual production deployment succeeded | NO (not executed) |
| Production target verified | PARTIAL: project + database verified; hosting site/origin undesignated |
| Live health acceptable | NOT EXECUTED |
| Critical security controls pass | YES on the emulator (rules 559/559, backend authority, 41/41 mutants); NOT VERIFIED live |
| Public routes work | YES on the emulator / production-mode bundle; NOT VERIFIED live |
| Customer journeys work | YES on the emulator (REH-R1..R3); NOT VERIFIED live |
| Three-customer isolation works | YES on the emulator; NOT VERIFIED live |
| No critical unresolved security defect | YES: none known. The one gate defect found (docs quoting key-shaped strings) is fixed. |
| Migration state is safe | YES: discovery only; 0 real customers; nothing written |
| Audit evidence exists | YES for tests and probes; no live audit ledger (nothing deployed) |
| Build / type checks pass | YES |
| No secrets exposed | YES: source, bundle and server PASS; git history INVESTIGATE (placeholders only, documented) |
| Payment state honestly represented | YES: DISABLED everywhere (registry, `PAYMENTS_ENABLED=false`, health reports DISABLED) |

## Deployment blockers the gate computed

1. `HOSTING_SITE_DESIGNATED` / `LIVE_HOSTING_SITE`: no DSBC hosting site; the default site serves another app.
2. `PUBLIC_ORIGIN_DESIGNATED` / `LIVE_PUBLIC_ORIGIN`: no public origin.
3. `STAGING_DESIGNATED`: no staging project.
4. `LIVE_REQUIRED_APIS`: Cloud Functions, Cloud Build, Eventarc, Cloud Scheduler, Secret Manager disabled.
5. `LIVE_FUNCTION_SECRETS`: Razorpay secrets cannot exist (Secret Manager disabled).
6. `APP_OWNER_ON_LIVE`: App Owner identity not designated or granted.
7. `MIGRATION_DECISION`: owner records SKIP for the 2 legacy demo companies.
8. `STORAGE_BUCKET_OWNERSHIP`: shared bucket.
9. `ENTERPRISE_EDITION`: rules and triggers never run on Enterprise edition.
10. `NOTIFICATIONS`: no provider, or written acceptance of NOT_CONFIGURED.

Details and the exact commands: [BLOCKERS.md](BLOCKERS.md).

## Payments

**DISABLED**, intentionally (pilot launch policy). Verified on the emulator:
checkout refuses with `PAYMENTS_NOT_ENABLED` and changes nothing (AUTH-003); a
correctly signed callback cannot activate while payments are disabled
(AUTH-005); the browser cannot forge subscriptions, entitlements, complimentary
grants or quota (AUTH-004/006/009/010, AUTH-019/020); forged webhooks get 401
(AUTH-021); the UI shows "Online payments are not active yet. Please contact
the platform owner…" rather than a success (code: `describeBackendError`;
**not** covered by a browser test). Razorpay was not activated.
