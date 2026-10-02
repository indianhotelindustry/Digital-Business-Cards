# Directive 26 — Final report

**FINAL STATUS: PASS — FIRST 3-CUSTOMER DEMO READY — PRODUCTION DEPLOYMENT PENDING**

This is not a "Production Ready" status. No production infrastructure has been
deployed or verified.

| | |
|---|---|
| Branch | `security-foundation/directive-26` |
| Started from | `security-foundation/directive-25` @ `50a495f` (570/570, recorded in Phase 0) |
| Certified commit | `0448a48` (`docs/directive-26/certification.json`) |
| Environment | Firebase Emulator Suite (`demo-dsbc`) + real Chrome against the production build; no live project contacted; nothing deployed |

## Certification

| Line | Result | Basis |
|---|---|---|
| Baseline tests | PASS | rules 433/433, integration 6/6, unit 46/46, AUTH-001..025 85/85 |
| New tests | PASS | public resolution 20/20, three-customer 25/25, browser 9/9 |
| Mutation tests | PASS | 36/36 killed |
| TypeScript | PASS | frontend + functions |
| Build | PASS | production frontend + functions bundle |
| Public resolution | PASS | PUBLIC-001..015 |
| Cross-browser | PASS | A admin / B anonymous / C and E customers / D App Owner |
| 3-tenant isolation | PASS | emulator 3 × 3 matrix + browser three-way isolation |
| Company journey | PASS | emulator ×3 + browser registration → publication |
| Employee journey | PASS | emulator ×3 + browser add → publish → anonymous card |
| Publishing | PASS | AUTH-024, PUBLIC-014/015, browser unpublished / preview / unknown URLs |
| Demo readiness | PASS | emulator readiness tests + App Owner sees 3 of 3 demo ready |

Two earlier certification runs failed: a test timeout, then a real
registration race. Both are explained and fixed in
[SECURITY-EVIDENCE.md §4](SECURITY-EVIDENCE.md).

## What was delivered, by phase

| Phase | Delivered | Commit |
|---|---|---|
| 0 | Baseline report: 570/570, TypeScript, builds, clean tree | `497546e` |
| 1 | `resolvePublicEntity`: server-authoritative `/card`, `/profile`, `/company` resolution with allow-listed projections; rules tightened (`publishingRecords`, `slugs`) | `0fcee88` |
| 2 | Public pages use the resolver only. demoStore is guarded (DEV demo personas only). Invented website and card content removed. Missing documents return `null`. | `e9e66c3`, `c6e26e4` |
| 3–5 | Publishing panel (company website, employee cards), logo upload, rules-compatible employee creation, onboarding wizard saves real data, `submitPublicLead`, website ↔ team ↔ card loop | `e9e66c3` |
| 6–9 | Three-customer emulator suite; `adminGetDemoReadiness` (read-only, App Owner) and the Demo Readiness tab with fixes that point to existing audited controls | `1800c0e` |
| 10 | Production-like browser test in real Chrome; it found and fixed the sign-in wizard and demo-copy problems | `c6e26e4` |
| 11 | Three-client pilot rehearsal through the real UI (rehearsal input only, never loaded by the app) | `cc7d7e4` |
| 12 | 36 mutants, certification script, documentation, snapshot-retry fix | `72ee954`, `d71d203`, `8d51988`, `0448a48` |

## Documents

- [ARCHITECTURE.md](ARCHITECTURE.md): what changed and what was preserved.
- [PUBLIC-RESOLUTION.md](PUBLIC-RESOLUTION.md): resolution rules, allow-lists,
  forbidden content, tests.
- [DEMO-READINESS.md](DEMO-READINESS.md): App Owner runbook for the three
  pilots, checks and recovery.
- [SECURITY-EVIDENCE.md](SECURITY-EVIDENCE.md): results, guarantees → tests,
  mutation testing, failed runs.

## How to reproduce

```bash
node scripts/directive26/certify.mjs   # full rerun → docs/directive-26/certification.json
DSBC_MUTATION_OUT=docs/directive-26/evidence/mutation-testing.json node scripts/directive25/mutationTest.mjs
```

## Remaining before production (all outstanding)

These are the Directive 25 deployment blockers, still open:

1. Deploy the functions and rules (nothing is deployed). Point the backend at
   the live named database (`DSBC_FIRESTORE_DATABASE` and `firebase.json`).
2. Grant the real App Owner the `platformRole` claim, then run
   `bootstrapControlPlane` on the live database.
3. Migrate existing live customers' plans into `subscriptions/*`. Without this
   they resolve to the free plan; content is kept, paid features lock.
4. Payments stay disabled (`PAYMENTS_ENABLED=false`) until a real Razorpay test
   has been done.

Added by Directive 26:

5. **Publish existing live content.** Live websites and cards published before
   this directive have no publishing record and slug-index entry, so they will
   show "Not Found" publicly until each customer publishes from the new panel,
   or until an App-Owner-reviewed migration creates those records.
6. **Real pilot run.** The three real pilot customers still need to complete
   the journey themselves, and the App Owner must confirm DEMO READY in the
   Demo Readiness tab on the deployed environment.
