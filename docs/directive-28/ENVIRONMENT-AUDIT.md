# Environment audit: what lives in `v-nexus-lite` (Phases 1–2)

All facts below were gathered on 2026-10-03 with **read-only** calls (Firebase
CLI list commands, `gcloud … list/describe/get-iam-policy`, Firebase Rules and
Identity Toolkit `GET`s, Firestore `listCollections` + `count()` on the DSBC
database only). Nothing was created, enabled, changed or deleted. No Auth user
was listed. Machine-readable: [evidence/live-probe-d28.json](evidence/live-probe-d28.json).

**VERIFIED** = read directly. **INFERRED** = deduced from matching dates or
regions. **UNKNOWN** = not determinable read-only without touching another
app's data.

## 1. Inventory

| Resource | What exists | Notes |
|---|---|---|
| Google Cloud / Firebase project | `v-nexus-lite`, display name "V Nexus Lite", number 801214429564, created 2026-01-11, billing enabled, labels `firebase=enabled` | one human owner holds `roles/owner` |
| Firebase apps | `ai-studio-applet-webapp` (web, `…6b4ce21…`), `Vidwan Kids` (web, `…c360b38…`) | **DSBC's registry uses `ai-studio-applet-webapp`**, a generic AI Studio app, not a DSBC app |
| Firestore databases | `(default)` Standard, asia-south1, 2026-01-11 · `ai-studio-0d16e7c4…` Enterprise, us-west1, 2026-09-23 · `ai-studio-37d17c3e…` Enterprise, us-west1, 2026-09-13 (**DSBC**) · `ai-studio-9106414b…` Enterprise, us-west1, 2026-09-14 | all four: PITR off, delete protection off |
| Firestore rules releases | one per database (`cloud.firestore`, `cloud.firestore/<db>`): 2026-01-19, 09-23, **10-01 (DSBC, legacy ruleset `90dcc764`)**, 09-14 | DSBC's live rules still grant App Owner by email allow-list |
| Firestore indexes (DSBC database) | none | |
| Storage buckets | **only** `ai-studio-bucket-801214429564-asia-southeast1` (created 2026-07-25) | **The registry bucket `v-nexus-lite.firebasestorage.app` does not exist (404).** `v-nexus-lite.appspot.com` does not exist either. The Cloud Storage for Firebase API is disabled; no Storage rules release exists. |
| Hosting sites | `v-nexus-lite` (default; serves "V-Nexus Lite \| Enterprise Performance", released 2026-01-19) · `vidwan-kids` | no DSBC site |
| Authentication | Firebase Auth (not Identity Platform), **one project-wide user pool**, no multi-tenancy, MFA off, no blocking functions. Enabled providers: **Google only**. Email/password: **disabled**. 15 authorized domains: localhost, the two default domains, and 4 × 3 AI Studio applet domains (`ais-{dev,shared,pre,mob}-<applet>-81456344493.asia-southeast1.run.app`) | DSBC registers with **email/password** (`createUserWithEmailAndPassword`), so DSBC sign-up cannot work in this project as configured |
| Cloud Functions | API **disabled**; no functions | |
| Cloud Run | `vidwan-kids` (asia-southeast1, 2026-07-25), runs as the **default compute service account** | |
| Cloud Scheduler / Eventarc / Secret Manager / Cloud Build | APIs **disabled** | |
| Artifact Registry | API enabled, no repositories | |
| App Engine | no application | |
| Service accounts | default compute SA (**`roles/editor` on the project**) · `firebase-adminsdk-fbsvc` (Firebase admin roles) · `ais-gemini-key-…` (AI Studio Gemini key) | plus Google-managed service agents |
| Other APIs enabled | BigQuery family, Cloud SQL Admin, Generative Language (Gemini), Remote Config, App Check, FCM, Cloud Run, Pub/Sub, Logging, Monitoring | `cloudsql.client` is granted to one external service account |

## 2. Ownership

| Resource | Belongs to | Basis |
|---|---|---|
| Hosting site `v-nexus-lite` | **V-Nexus Lite** | VERIFIED (page title) |
| Database `(default)` | **V-Nexus Lite** | INFERRED: its rules were released 2026-01-19 13:24 UTC, five minutes before the site's release at 13:29 UTC |
| Hosting site `vidwan-kids`, web app `Vidwan Kids`, Cloud Run `vidwan-kids` | **Vidwan Kids** | VERIFIED (names, app id on the site) |
| Bucket `ai-studio-bucket-…-asia-southeast1` | **Vidwan Kids / AI Studio** | INFERRED: same creation date (2026-07-25) and region as the Cloud Run service |
| Database `ai-studio-37d17c3e…` | **DSBC** (the legacy AI Studio DSBC app and the D24–D27 registry) | VERIFIED: it contains DSBC's collections (see DATABASE-ISOLATION.md) |
| Databases `ai-studio-0d16e7c4…`, `ai-studio-9106414b…` | **UNKNOWN** (other AI Studio applets) | not inspected: reading them would mean reading another app's data |
| The three AI Studio applet domains | **UNKNOWN** mapping (one is presumably the legacy DSBC applet) | the applets run on Google's AI Studio infrastructure (project 81456344493), not in this project |
| Web app `ai-studio-applet-webapp` | **SHARED** by AI Studio applets, DSBC included | DSBC's registry `appId` |
| Auth user pool, API keys, IAM, default compute SA, `firebase-adminsdk` SA, quotas, billing, Cloud Logging, API enablement | **SHARED** (project-wide by design) | |

## 3. Can DSBC be isolated inside `v-nexus-lite`? (Phase 2)

| Dependency | Classification | Why |
|---|---|---|
| Firestore database | **ISOLATED** (data) / **SHARED** (access) | A named database separates data, and rules are released per database. But the service accounts with project-wide `roles/editor` can read and write every database. |
| Firestore rules | **ISOLATED** | per-database release `cloud.firestore/<db>` |
| Firestore indexes | **ISOLATED** | per database |
| Storage bucket | **CONFLICTING** | The registry points at `v-nexus-lite.firebasestorage.app`, which **does not exist**. A separate DSBC bucket with its own rules is technically possible, but it needs the project-level Cloud Storage for Firebase API enabled, and the editor-level default SA (Vidwan Kids' runtime) could still read and write it. |
| Hosting site | **ISOLATED (possible)** | a new site + target is independent of `v-nexus-lite`/`vidwan-kids` |
| Firebase Auth | **CONFLICTING** | one user pool; tenants need an Identity Platform upgrade of the **whole project**. Enabling email/password (DSBC requires it) opens email sign-up for every app on the shared API key. DSBC's `platformRole` claim is project-wide. |
| Firebase web app / API key | **SHARED** | DSBC uses the generic `ai-studio-applet-webapp` config; restricting its key would affect the other applets |
| Cloud Functions | **CONFLICTING** | the default runtime identity (default compute SA) holds project `roles/editor`, the same identity as Vidwan Kids' Cloud Run |
| Service accounts / IAM | **CONFLICTING** | IAM is project-wide; a DSBC deployer or function SA with Firestore/Storage roles gets them for every database/bucket unless IAM conditions are used on every binding |
| Secret Manager | **SHARED** | one project namespace; secret-level IAM possible, but the editor-level default SA can read every secret |
| Deployment targets (`firebase deploy`) | **SHARED** | `--only firestore`/`storage` without a database/bucket entry deploys to the default resources. D27 guards this in `firebase.production.json`, but one mistyped command reaches V-Nexus. |
| Logging / monitoring / quotas / billing | **SHARED** | project-wide |
| Environment configuration | **SAFE** | DSBC's registry and `functions/.env.<project>` are repo-local |
| API enablement | **SHARED** | enabling Cloud Functions, Build, Eventarc, Scheduler, Secret Manager changes the project for every app |

**Result:** three critical boundaries (Auth, runtime identity/IAM, Storage)
cannot be isolated independently inside `v-nexus-lite`. **Option B is UNSAFE.**
See [ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md).

## 4. Other projects visible to the operator account (not assumed)

| Project | Observed | Usable for DSBC? |
|---|---|---|
| `command-centre-640ac` ("DSBC") | Standard `(default)` database (asia-south1); its site serves "My Google AI Studio App"; Cloud Functions, Build and Secret Manager enabled | **No**: another app already lives there; its relation to DSBC Cards is unknown |
| `dsbc-e8ok3g3sf` ("DSBC Customer Environment") | billing enabled; the operator account has **no permission** to list its services or sites | **UNKNOWN**: the owner must say what it is. Not assumed to be DSBC Cards production. |
| others (`dsbc-dine-*`, `dsbc-civil-staging`, `dsbc-g3-…-rehearsal`, `dsbc-shspl-…`, …) | names only | not DSBC Cards; not inspected |
