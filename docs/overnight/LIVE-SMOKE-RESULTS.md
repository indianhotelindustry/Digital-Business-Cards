# Live smoke test results (Phase 8)

**Live result: NOT EXECUTED.** No DSBC deployment exists on any real URL
([BLOCKERS.md](BLOCKERS.md) B1–B4), so there was nothing live to test. No live
step is reported as PASS.

The right-hand column shows the closest **non-live** evidence: the same
behaviour exercised in real Chrome against a **production-mode bundle** served
locally and backed by the Firebase Emulator Suite (`demo-dsbc`), run overnight
at code commit `37c5c7b` (20/20 browser tests, 2026-10-03). That
evidence shows the code works. It is **not** evidence that production works,
and it does not count toward Live Acceptance.

| # | Smoke step | Live | Emulator / production-mode bundle evidence (not live) |
|---|---|---|---|
| 1 | Public marketing page | NOT EXECUTED | REH-404 (`/pricing` path routing), ROUTE-001..007 unit |
| 2 | Registration | NOT EXECUTED | REH-R1/R2/R3, demo-journey "Browser A: company registers…" |
| 3 | Login | NOT EXECUTED | REH-PERSIST (new browser, sign in again) |
| 4 | Company account creation | NOT EXECUTED | REH-R1/R2/R3 |
| 5 | Company dashboard | NOT EXECUTED | REH-R1/R2/R3 (screenshots `d27-R*-dashboard.png`) |
| 6 | Employee creation | NOT EXECUTED | REH-R1/R2/R3, REH-SERVER |
| 7 | Employee card creation | NOT EXECUTED | REH-R1/R2/R3, demo-journey "adds an employee and publishes the card" |
| 8 | Company profile / website creation | NOT EXECUTED | REH-R1/R2/R3 |
| 9 | Publishing | NOT EXECUTED | REH-R1/R2/R3, PUBLIC-001..015 (backend) |
| 10 | Public company URL | NOT EXECUTED | REH-PUBLIC (clean browser per URL) |
| 11 | Public employee / card URL | NOT EXECUTED | REH-PUBLIC, REH-NAV |
| 12 | QR / share URL | NOT EXECUTED | REH-NAV (canonical paths), REH-LEGACY (old hash links rewritten). No public origin is designated, so live share links would carry no canonical domain (B2). |
| 13 | Logout | NOT EXECUTED | REH-PERSIST |
| 14 | Login again | NOT EXECUTED | REH-PERSIST |
| 15 | Data persistence | NOT EXECUTED | REH-PERSIST (reload + brand-new browser) |
| 16 | Unpublish | NOT EXECUTED | REH-UNPUBLISH |
| 17 | Public 404 after unpublish | NOT EXECUTED | REH-UNPUBLISH, REH-404; `?preview=true` is no bypass |
| 18 | Tenant isolation | NOT EXECUTED | REH-SERVER, REH-PUBLIC, demo-journey Browser C/E, three-customer-demo.test.ts (25 backend tests) |
| 19 | Unauthorized cross-tenant access | NOT EXECUTED | AUTH-012 (backend), D24 rules suite (559 rules tests incl. cross-tenant denials) |
| 20 | App Owner access | NOT EXECUTED | REH-OWNER (measured health, all three customers), demo-journey Browser D |

## What a live run needs

1. Clear B1–B6 and deploy per [PRODUCTION-DEPLOYMENT-EVIDENCE.md](PRODUCTION-DEPLOYMENT-EVIDENCE.md).
2. `node scripts/directive27/liveProbe.mjs` must report live deployment `COMPLETE`.
3. Run the 20 steps above against the designated public origin, a clean browser
   profile per tenant, and record the result in
   `docs/overnight/evidence/live-acceptance.json` (schema in
   [THREE-CUSTOMER-RESULTS.md](THREE-CUSTOMER-RESULTS.md)).
