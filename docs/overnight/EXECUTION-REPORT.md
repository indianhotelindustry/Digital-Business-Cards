# Overnight execution report: controlled live deployment and production certification

| | |
|---|---|
| Branch | `security-foundation/directive-27` |
| Start state | `559ac15` "docs(d27): certify controlled deployment foundation"; clean tree (untracked `.vscode/` only, left alone) |
| Final code commit | `37c5c7b` (evidence/docs commit follows it) |
| Date | 2026-10-03 (IST night) |
| Outcome | **Demo Ready PASS · Deployment BLOCKED · nothing deployed · Production NOT certified** |

## Summary

All code-level gates pass at the final commit: 808/808 tests, 41/41 mutants
killed, TypeScript, both builds, secrets audit, preflight with no FAIL.

Deployment was **not executed**. Read-only inspection of the production target
(`v-nexus-lite`) showed that a deploy would either fail or overwrite something
that isn't DSBC's:

- The default hosting site serves another live app ("V-Nexus Lite").
- No DSBC hosting site or public origin has been designated.
- The Cloud Functions, Cloud Build, Eventarc, Cloud Scheduler and Secret Manager APIs are disabled.
- The function secrets cannot exist.
- The storage bucket is shared.
- No App Owner identity has been designated.

These are stop conditions 1, 2, 3 and 8. Each needs an App Owner decision; see
[BLOCKERS.md](BLOCKERS.md).

## Phases

| Phase | Status | What happened |
|---|---|---|
| 0 Baseline | DONE | Branch and HEAD confirmed; D27 docs, runbook, migration plan, certify script read. |
| 1 Preflight | DONE, BLOCKED | `preflight.ts`: 13 PASS / 0 FAIL / 3 BLOCKED (hosting site, public origin, staging). Live (read-only): project + Enterprise database `us-west1` verified; default site occupied by another app; 5 deployment APIs disabled; live rules = legacy `90dcc764`; DB has PITR and delete protection off. |
| 2 Secrets | DONE, 1 defect fixed | **Defect:** the D27 docs committed in `559ac15` quoted the fake Razorpay key ids, so the source scan failed and the D27 gate evaluated to `FAIL — DIRECTIVE 27 INCOMPLETE` at the "certified" commit (its `certification.json` had never been committed). Fixed by rewording the docs (`37594c9`); the scanner was not weakened. Final: source PASS, bundle PASS, server PASS, history INVESTIGATE (placeholders only). No credential exists for Razorpay secrets; none was invented. |
| 3 Bootstrap | DRY RUN ONLY | Live dry run: 0/40 control-plane documents present, customer collections unchanged. BOOT-001..006 pass on the emulator. The real bootstrap waits for runbook step 4 (after rules + App Owner). |
| 4 App Owner | BLOCKED | Identity not designated. Legacy live rules show an email allow-list (evidence, not designation). Claim census on live Auth was denied by the permission classifier (shared Auth pool) and not retried. |
| 5 Migration | DISCOVERY ONLY | 2 companies, both legacy demo data, 0 real customers, 0 subscriptions; preview hash `49d3a426…`. Nothing executed or deleted; full preview in git-ignored `migration-work/`. |
| 6 Deployment | NOT EXECUTED | Target not fully verified (hosting). Added build-artifact identity (`dist/build-info.json`, preflight `BUILD_IDENTITY`) so a future deploy's revision can be proven. |
| 7 Live health | NOT EXECUTED | No deployed callable; no App Owner. |
| 8 Live smoke | NOT EXECUTED | Nothing deployed. Emulator equivalents: [LIVE-SMOKE-RESULTS.md](LIVE-SMOKE-RESULTS.md). |
| 9 Three customers live | NOT EXECUTED | Emulator rehearsal re-run: 11/11 REH + 9/9 D26 browser tests. [THREE-CUSTOMER-RESULTS.md](THREE-CUSTOMER-RESULTS.md). |
| 10 Security regression | DONE | All suites PASS (table below); mutation 41/41. |
| 11 Operational | DONE | Builds PASS; main chunk 1.67 MB (372 KB gzip), Vite size warning, not changed. ErrorBoundary/retry/health behaviour covered by existing tests (REH-OWNER, HEALTH-*); no live logs, heartbeat or ledger to inspect (nothing deployed). |
| 12 Payments | DONE | DISABLED; forgery tests pass; see [FINAL-GATE.md](FINAL-GATE.md). |
| 13 Certification | DONE | Gate extended to 5 separate levels fed by measured live evidence. Result: PASS / BLOCKED / NOT COMPLETE / NOT EXECUTED / **FAIL**. |
| 14 Docs | DONE | this folder |
| 15 Git | DONE | commits below |

## Tests (final full run at `37c5c7b`)

| Suite | Result |
|---|---|
| Unit (vitest) | 76/76 (+3: ENV-017..019) |
| Rules (D24 + D27, emulator) | 559/559 |
| Integration (emulator) | 19/19 |
| Backend authority / public resolution / three-customer / health (emulator) | 134/134 |
| Browser (real Chrome, production-mode bundle, emulator) | 20/20 |
| **Total** | **808/808 passed, 0 failed** |
| Mutation (D27 harness) | 41/41 killed (38 inherited + E13..E15 new) |
| TypeScript (frontend + functions) | PASS |
| Build (frontend production + functions) | PASS |

All of these ran against the Firebase Emulator Suite (`demo-dsbc`). None is a
live-production result.

## Failures encountered (not hidden)

| When | What | Resolution |
|---|---|---|
| first certify launch | log redirect pointed at a scratch dir that didn't exist; nothing ran, exit 1 | re-run; the empty run was not counted |
| first full certify | gate FAIL: secrets source scan hit key-shaped strings in the D27 docs | docs fixed (`37594c9`); re-run PASS |
| live probe v1 | `npx firebase` resolved to the JS SDK (no output), wrong Rules release name, missing quota-project header, so false FAILs | probe fixed; facts re-measured |
| vite build-info patch | a shell heredoc turned `'\n'` into a newline (syntax error); preflight correctly FAILed the missing identity | fixed and rebuilt |
| permission classifier | denied (1) a live Auth claim census and (2) reading `.env.production` | not retried; recorded as NOT EXECUTED / not needed |

## Commits

| Commit | Content |
|---|---|
| `37594c9` | fix(d27): stop quoting key-shaped placeholders in docs |
| `d74f76d` | feat(overnight): build artifact identity + read-only live deployment probe |
| `37c5c7b` | feat(overnight): five-level certification gate fed by measured live evidence |
| (next) | docs(overnight): reports, live probe + discovery evidence, re-run D27 evidence |

## Commands used (main ones)

```bash
git status; git branch --show-current; git log --oneline --decorate -12
npx vite build && npx tsx scripts/directive27/preflight.ts
node scripts/directive27/certify.mjs                       # typecheck, builds, unit, rules, integration, backend, browser
node scripts/directive27/mutationTest.mjs                  # 41 mutants
node scripts/directive27/secretsAudit.mjs --bundle dist
node scripts/directive27/liveProbe.mjs                     # read-only live measurements
npx tsx scripts/admin/bootstrapProduction.ts --project v-nexus-lite --confirm-project v-nexus-lite --database <db> --reason "..." --dry-run
npx tsx scripts/admin/migrateCustomers.ts discover --project v-nexus-lite --confirm-project v-nexus-lite --database <db> --out migration-work/preview-overnight.json
firebase projects:list | hosting:sites:list | hosting:channel:list | firestore:databases:list   (read-only)
gcloud services list --enabled | secrets describe | billing projects describe                   (read-only)
```

## Single next human action

Decide where DSBC production is hosted (a new site in `v-nexus-lite`, or a
dedicated DSBC project) and record the hosting site and public origin in
`config/environments.json`. See [BLOCKERS.md](BLOCKERS.md).
