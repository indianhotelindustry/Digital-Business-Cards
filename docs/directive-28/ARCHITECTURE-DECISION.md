# Architecture decision: the DSBC production boundary

**Decision: DSBC production gets a dedicated Firebase / Google Cloud project
(Option A). Hosting DSBC inside `v-nexus-lite` (Option B) is UNSAFE and is
rejected.**

Status: recommended, not yet executed. Creating the project, its billing link,
domain and App Owner are human actions ([BLOCKERS.md](BLOCKERS.md)). The
decision is enforced in code: `config/environments.json` records
`production.boundary.dedicatedProject: false` for `v-nexus-lite`, and the
preflight check `PRODUCTION_BOUNDARY` blocks every deployment until production
points at a dedicated project.

## Evidence (measured read-only on 2026-10-03, see [ENVIRONMENT-AUDIT.md](ENVIRONMENT-AUDIT.md))

1. `v-nexus-lite` already runs **V-Nexus Lite** (default site and `(default)`
   database), **Vidwan Kids** (site, Cloud Run, bucket) and **two more AI
   Studio applets** (two databases).
2. **Auth** is one plain Firebase Auth pool (no tenants) with **only Google
   sign-in enabled**. DSBC needs email/password, and enabling it changes sign-up
   for every app in the project.
3. The **default compute service account holds `roles/editor`** and is Vidwan
   Kids' runtime identity. Cloud Functions gen 2 use it by default, so DSBC's
   backend and another app would share an identity that can read and write
   every database and bucket.
4. The registry's **storage bucket does not exist**, the Cloud Storage for
   Firebase API is disabled, and the DSBC backend always uses the project's
   **default** bucket.
5. DSBC's web config is the generic **`ai-studio-applet-webapp`**, shared with
   the AI Studio applets.
6. The deployment APIs (Cloud Functions, Build, Eventarc, Scheduler, Secret
   Manager) are disabled. Enabling them changes a project other teams' apps run in.
7. The DSBC database is **Enterprise** edition. The emulator, where 808 tests
   and 43 mutants run, is **Standard** edition, so the database DSBC was tested
   against does not match production.
8. DSBC has **0 real customers** in `v-nexus-lite` (2 legacy demo companies),
   so leaving costs no data.

## Options

| Criterion (priority order from the directive) | A: dedicated DSBC project | B: isolated resources inside `v-nexus-lite` |
|---|---|---|
| 1 Isolation from V-Nexus Lite | **Full**: separate Auth pool, IAM, service accounts, buckets, secrets, quotas, logs | **Partial**: data and rules can be separated; Auth, IAM, the default runtime identity, API key, quotas and logs cannot |
| 2 Data safety | V-Nexus data is unreachable from DSBC credentials | an editor-level SA shared with Vidwan Kids can write DSBC data, and the reverse |
| 3 Deployment safety | a wrong `firebase deploy` can only hit DSBC | a mistyped `--only storage`/`firestore`/`hosting` can replace another app's rules or site |
| 4 Security | App Owner claim, email/password policy, API key restrictions and App Check scoped to DSBC | claims, providers and key restrictions are project-wide, shared with four other apps |
| 5 Operational simplicity | default database/bucket/site are DSBC's; the backend needs no code change | needs a non-default bucket (code change), per-binding IAM conditions, coordination with other apps' owners |
| 6 3-customer pilot | supported (PILOT plan) | blocked until Auth, Storage and APIs are reconciled with the other apps |
| 7 Future Razorpay | secrets, webhook URL and audit isolated | secrets readable by the shared editor SA |
| 8 Future scale | quotas and billing attributable to DSBC | quotas and billing mixed with other apps |
| Edition / testing | **Standard** edition, the same as the emulator suite | Enterprise edition, untested |
| Cost to leave the current project | none (no real customers) | n/a |

**Option B verdict: UNSAFE.** Three critical boundaries cannot be isolated
independently: Auth (one pool, provider change is project-wide), runtime
identity / IAM (editor-level default SA), and Storage (non-existent registry
bucket; the backend uses the default bucket; shared access). The directive's
rule applies: *if any critical boundary cannot be independently isolated, mark
OPTION B UNSAFE.*

## Option A: the recommended architecture

| Component | Choice | Why |
|---|---|---|
| Project | new project, e.g. id chosen by the owner, display name "DSBC Production" | DSBC alone |
| Billing | Blaze, linked by the owner | Cloud Functions, Secret Manager and current default buckets need a billing account |
| Firebase web app | "DSBC Web", registered in the new project | replaces the shared `ai-studio-applet-webapp` config |
| Auth | Firebase Auth, **email/password** enabled; authorized domains = the DSBC origins only | matches DSBC's registration code; nothing else shares the pool |
| Firestore | named database **`dsbc-production`**, **Standard** edition, **asia-south1**, PITR + delete protection **on** | the resolver requires a named production database; Standard = what the emulator tests; asia-south1 is close to the users (the reconciler runs in Asia/Kolkata) |
| Storage | default bucket `<project>.firebasestorage.app` in asia-south1, `storage.rules` deployed | the backend's `bucket()` is the default bucket, so no code change |
| Functions | gen 2, **asia-south1** (must equal the database location for Firestore triggers). Runtime identity: the project's default compute SA, whose reach is now **only DSBC**. Recommended hardening (a small code change, `setGlobalOptions({ serviceAccount })`): a dedicated runtime SA with only Datastore User, Storage Object Admin on the DSBC bucket, Secret Accessor on the two secrets, Firebase Auth Admin | a blast radius limited to DSBC, then least privilege |
| Scheduler / Eventarc | for `reconcileSubscriptionsDaily` and the 5 Firestore triggers | required by `functions/src/index.ts` |
| Secret Manager | `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (owner-set placeholders while payments are disabled) | declared by the payment functions |
| Hosting | default site `<project>` → target `dsbc-web` | DSBC's own default site |
| Domain | owner-chosen custom domain (recommended), interim `https://<project>.web.app` | see [HOSTING-PLAN.md](HOSTING-PLAN.md) |
| Deployer identity | the owner's account, or a deployer SA with Firebase Admin + Cloud Functions Developer + Service Account User **on the new project only** | |
| Payments | **disabled** (`PAYMENTS_ENABLED=false`, registry `payments: disabled`) | pilot policy |

The exact registry entry is
[environments.production.proposed.json](environments.production.proposed.json)
(placeholders for the values only the owner or Firebase can provide; the
resolver refuses to build while any placeholder remains, and ENV-021 proves it
resolves once filled).

## What happens to `v-nexus-lite`

Nothing. DSBC stops pointing at it once the registry is switched. The legacy
DSBC database (`ai-studio-37d17c3e…`, 2 demo companies) and its legacy rules
stay untouched; retiring them is a separate decision for the owner. V-Nexus
Lite, Vidwan Kids and the other applets are not affected.
