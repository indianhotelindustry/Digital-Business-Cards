# Database isolation and collision analysis (Phase 5)

Read-only: database metadata, rules release metadata, index listing, and
`listCollections()` + `count()` on the **DSBC database only**. No document was
read individually for this analysis, and nothing was written. Customer-level
facts come from the D27 discovery tool
([../overnight/evidence/migration-discovery-summary.json](../overnight/evidence/migration-discovery-summary.json)).

## Databases in `v-nexus-lite`

| Database | Edition / region | Created | Owner | DSBC may touch it? |
|---|---|---|---|---|
| `(default)` | Standard / asia-south1 | 2026-01-11 | V-Nexus Lite (inferred) | **never** |
| `ai-studio-0d16e7c4…` | Enterprise / us-west1 | 2026-09-23 | unknown AI Studio applet | **never** |
| `ai-studio-9106414b…` | Enterprise / us-west1 | 2026-09-14 | unknown AI Studio applet | **never** |
| `ai-studio-37d17c3e…` | Enterprise / us-west1 | 2026-09-13 | DSBC (legacy AI Studio app) | **read-only** from now on; see below |

## The DSBC database today

| Collection | Documents | Used by current DSBC code? |
|---|---|---|
| `users` | 2 | yes |
| `companies` | 2 | yes |
| `employees` | 2 | yes |
| `departments` | 2 | yes |
| `cards` | 2 | yes |
| `cardTemplates` | 3 | yes (`cardService`, rules) |
| `connections` | 2 | yes (`connectService`, rules) |
| every other DSBC collection (plans, subscriptions, publishingRecords, slugs, digitalIdentityProfiles, audit ledgers, …) | 0 (absent) | yes |

- **Indexes:** none (the D27 backend uses equality queries only; Platform Health's INDEXES check runs every query shape).
- **Triggers / scheduled jobs:** none deployed (the Cloud Functions, Eventarc and Scheduler APIs are disabled).
- **Rules:** legacy ruleset `90dcc764`, released 2026-10-01. Its security assumptions are the ones D24 removed: App Owner by an **email allow-list** plus a `users.role` field, and browser-written plans. The D24–D27 rules have never been deployed here.

## The two legacy demo companies

| | Company 1 | Company 2 |
|---|---|---|
| Legacy demo id (`company_acme` / `company_nexus` family) | yes | yes |
| Admin accounts / verified | 0 / 0, with an admin profile whose Auth account **no longer exists** | 0 / 0, no admin profile |
| Employees / departments / profiles | 1 / 1 / 0 | 1 / 1 / 0 |
| Browser-written legacy `planId` | `enterprise` | `growth` |
| Subscription / publishing record | none / none | none / none |
| Migration proposal | `OWNER_DECISION_REQUIRED`; only **SKIP** is accepted for demo candidates | same |

Neither is a customer, and neither can be one: no verified sign-in owns them.
The legacy paid `planId` values were written by the old browser code and are
not evidence of payment.

## How DSBC production avoids touching them

With the recommended dedicated project ([ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md)),
DSBC production gets a **new, empty** `dsbc-production` database in a
different project. Nothing reads from or writes to `ai-studio-37d17c3e…`:

1. **Configuration:** the registry's production entry is replaced wholesale.
   The backend refuses to load unless `GCLOUD_PROJECT` and `DSBC_FIRESTORE_DATABASE`
   match the registry (D27 `assertBackendEnvironment`), so it cannot drift
   back to the old database.
2. **Admin scripts** need `--project X --confirm-project X --database Y` and
   refuse a production database other than the registered one (`adminTarget.ts`).
3. **No migration:** discovery found 0 real customers, so nothing is copied.
   The demo companies are not recreated; the bootstrap never creates demo data
   (`BOOT-*` tests, D28 fresh-database rehearsal).
4. **No deletion:** the legacy database and its rules stay as they are.
   Retiring them (or the legacy AI Studio app) is a separate owner decision.

## Collisions

| Kind | Finding |
|---|---|
| Collection-name collisions with other apps | **none possible** with a dedicated project. Inside `v-nexus-lite` each app already has its own named database, so names never collided there either. |
| DSBC vs legacy DSBC in `ai-studio-37d17c3e…` | same collection names, **different schema generation**: the legacy rules let browsers write plans and roles, while D24–D27 code and rules assume backend authority. Deploying D24 rules there breaks the legacy app's writes. Another reason not to share it. |
| Indexes | none on either side |
| Triggers on shared paths | none deployed; in a dedicated project DSBC's 5 Firestore triggers only see `dsbc-production` |

## Fresh-database rehearsal (emulator, D28)

`scripts/admin/bootstrapProduction.ts` against an **empty named database**
`dsbc-production` (emulator, project `demo-dsbc`), run twice:

| Run | Created | Existing | Drift | Customer collections changed | Status |
|---|---|---|---|---|---|
| 1 | 40 (5 plans, 33 catalogue entries, 1 global policy, 1 platform config) + 2 audit entries | 0 | 0 | none | PASS |
| 2 | 0 | 40 | 0 | none | PASS |

Evidence: [evidence/bootstrap-fresh-named-db-run1.json](evidence/bootstrap-fresh-named-db-run1.json),
[run2](evidence/bootstrap-fresh-named-db-run2.json).
