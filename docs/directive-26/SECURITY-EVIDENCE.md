# Directive 26 — Security evidence

All evidence was produced on the Firebase Emulator Suite (project `demo-dsbc`)
and in real Chrome against the production build. No live Firebase project was
contacted and nothing was deployed. The machine-readable record is
[`certification.json`](certification.json); raw results are in
[`evidence/`](evidence/).

## 1. Results at the certified commit `0448a48`

| Suite | Result | Evidence |
|---|---|---|
| Unit | 46/46 | `evidence/final/unit.json` |
| Directive 24 rules regression | 433/433 | `evidence/final/rules-directive24.json` |
| Integration | 6/6 | `evidence/final/integration.json` |
| Backend (emulator): Directive 25 authority AUTH-001..025 | 85/85 | `evidence/final/backend-authority.json` |
| Backend (emulator): public resolution PUBLIC-001..015 | 20/20 | same file |
| Backend (emulator): three-customer pilot | 25/25 | same file |
| Browser (real Chrome, production build, 4 customer sessions + anonymous visitor) | 9/9 | `evidence/browser/results.json`, screenshots |
| Mutation testing (backend, shared domain, rules) | 36/36 killed | `evidence/mutation-testing.json` |
| TypeScript (frontend + functions) | PASS | `evidence/final/baseline-report.json` |
| Build (production frontend + functions bundle) | PASS | same |

Inherited baseline, recorded before any change at `50a495f`: 570/570
(`evidence/baseline/baseline-report.json`).

## 2. Security guarantees and the tests that prove them

| Guarantee | Tests |
|---|---|
| Anonymous visitors resolve only published, visible, same-tenant content | PUBLIC-001..005, 013; browser "real company website", "real employee card" |
| `?preview=true` grants nothing to anonymous visitors or other tenants | PUBLIC-006; browser "unpublished, preview and unknown URLs" |
| No commercial, ownership or enforcement field in any public response | PUBLIC-010 (deep key scan); mutant M27 |
| No demo-data fallback on customer routes | PUBLIC-009 (backend + source check); browser (demo and unknown slugs show Not Found) |
| Employees stay attached to their tenant; cross-tenant cards never resolve | PUBLIC-011; three-customer "Employee journey"; mutant M25 |
| Directory lists only published employees; locked seats disappear, data is kept | PUBLIC-012; mutant M29 |
| Publication state is server-authoritative; slugs cannot be taken over | PUBLIC-014, 015, AUTH-024 |
| 3 × 3 tenant isolation of private data, plus public isolation | three-customer "Three-tenant isolation" (6 directed pairs × 8 collections + write attempts); browser "three-way isolation" |
| Enquiries land only in the resolved company's CRM; visitors cannot choose the tenant | three-customer "Company website experience"; browser enquiry; mutant M30 |
| Demo readiness is App Owner only and read-only | three-customer "Demo readiness"; mutant M31 |
| Publishing metadata is not public (tightened rule) | PUBLIC-008; mutant R05 |
| All Directive 24 and 25 guarantees still hold | 433 rules tests, AUTH-001..025, mutants M01–M23 and R01–R04 |

## 3. Mutation testing

36 deliberate weakenings were applied one at a time, each followed by the
relevant emulator test files:

- M01–M23 and R01–R04: Directive 25 authority.
- M24–M31: public resolver, leads and readiness.
- R05: the publishing-records rule.

**All 36 were detected.** Every mutated file was restored and verified
afterwards. The run measured the code at `72ee954`. The later commits change
only the test timeout (`8d51988`) and the browser's snapshot retry
(`0448a48`); no mutation target changed.

## 4. Runs that failed during certification (kept for the record)

| Run | Result | Cause | Action |
|---|---|---|---|
| Certification 1 (`d71d203`) | FAIL: backend 128/130 | AUTH-016 hit the 60 s per-test limit. It calls about eight functions for the first time, and each first call starts an emulator worker. AUTH-017 failed as a consequence (audit records not yet written). | Per-test limit raised to 180 s (`8d51988`). Timing only; no logic change. |
| Certification 2 (`8d51988`) | FAIL: browser 6/9 | **Product bug.** After registration the Firebase session can exist before the profile is committed. The first commercial-snapshot request failed, and the new customer stayed fail-closed ("0 / 0 employees used") for up to 5 minutes. | Snapshot fetch now retries after 1, 2, 4, 8 and 15 s (`0448a48`). |
| Certification 3 (`0448a48`) | **PASS**, all 12 lines | — | — |

## 5. Issues found and fixed by this directive's tests

- **Demo-tenant matching by slug.** Any company whose slug contained "acme" or
  "nexus" was shown the demo company's content.
- **Invented website content.** Real websites received made-up metrics,
  values, a certification and a stock service. Real cards showed the Acme
  tagline and stock slogans.
- **Silent writes to demo storage.** A signed-in customer's failed Firestore
  write was saved to demoStore and reported as success. Empty optional fields
  caused such failures.
- **Employee creation order.** The card was written before the employee, so
  the card rule's ownership check could not pass. The slug-uniqueness query was
  also unprovable under the rules.
- **Public publishing metadata.** `publishingRecords` (tenant id, publisher
  uid) was readable by anyone once PUBLISHED.
- **Wrong storage host in the emulator.** The logo URL pointed at production
  Google Cloud Storage even in the emulator.
- **Sign-in UX.** Sign-in opened the setup wizard, pre-filled with invented
  details.
- **Registration race.** A new customer could be left fail-closed after
  registration (section 4).

## 6. Not covered

- Production infrastructure. Nothing is deployed, and the Directive 25
  deployment blockers remain (see the final report).
- Browsers other than Chrome. The browser suite uses Chrome; other engines
  were not run.
- Load and abuse testing beyond the per-company enquiry cap.
