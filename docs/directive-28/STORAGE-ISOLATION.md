# Storage isolation and collision analysis (Phase 6)

Read-only: `gcloud storage buckets list/describe`, the Firebase Rules releases
list, and the Cloud Storage for Firebase API. No object was listed or read.

## What exists in `v-nexus-lite`

| Item | Finding |
|---|---|
| Buckets | **one**: `ai-studio-bucket-801214429564-asia-southeast1` (created 2026-07-25, the same day and region as the `vidwan-kids` Cloud Run service; inferred Vidwan Kids / AI Studio) |
| DSBC registry bucket `v-nexus-lite.firebasestorage.app` | **does not exist** (404) |
| Legacy default `v-nexus-lite.appspot.com` | does not exist (404) |
| Cloud Storage for Firebase API (`firebasestorage.googleapis.com`) | **disabled** |
| Storage rules releases (`firebase.storage/*`) | **none** |

D27 called the bucket "shared". The measured situation is different: **DSBC
has no bucket at all**, and the only bucket belongs to another app.

## What DSBC expects

| Path (storage.rules) | Content | Writer |
|---|---|---|
| `companies/{companyId}/branding/**` | company logo / branding | backend only (`uploadAsset`, D25) |
| `companies/{companyId}/employees/{employeeId}/**` | employee photos | backend only |
| `individuals/{uid}/**` | individual profile media | backend only |

The backend writes to `getStorage(app).bucket()`, the project's **default
bucket** (`functions/src/shared/firebase.ts`). Platform Health's STORAGE check
FAILs if that bucket differs from the registry or does not exist.

## Could DSBC get a dedicated bucket inside `v-nexus-lite`?

Technically yes: a second bucket with its own Firebase rules release
(`firebase.storage/<bucket>`). But:

| Requirement | Inside `v-nexus-lite` |
|---|---|
| Firebase Storage API | must be enabled project-wide (a change to a shared project) |
| Bucket choice | not the default bucket, so the backend needs a code change (`initializeApp({ storageBucket })`) plus a matching health check |
| Access isolation | **not achievable**: the default compute SA (`roles/editor`) can read and write every bucket, and it is Vidwan Kids' runtime identity |
| Rules isolation | achievable (per-bucket release), but a `firebase deploy --only storage` with the wrong config replaces another bucket's rules |

**Verdict: inside `v-nexus-lite`, Storage is CONFLICTING.** The environment is
unsafe for DSBC production storage.

## With a dedicated project (recommended)

| Item | Plan |
|---|---|
| Bucket | the new project's default bucket `<project>.firebasestorage.app`, location **asia-south1** (same as Firestore and Functions) |
| Rules | `storage.rules` as committed: all three namespaces are **publicly readable** (branding and profile images appear on public cards and sites), and **no browser may write** (uploads only through the `uploadAsset` function) |
| Backend | no code change: the default bucket **is** the DSBC bucket |
| Cross-application risk | none: no other app in the project |
| Verification | Platform Health STORAGE = OK (bucket name equals the registry, one-object listing works); `liveProbe.mjs` STORAGE_BUCKET = PASS |
