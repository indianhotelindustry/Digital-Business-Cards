# Required Google Cloud services (Phase 8)

"Current state" is `v-nexus-lite`, measured read-only on 2026-10-03
(`gcloud services list --enabled`). Nothing was enabled. In the recommended
**dedicated project**, every API marked *required* is enabled during
provisioning ([PRODUCTION-PROVISIONING.md](PRODUCTION-PROVISIONING.md) step 1),
by the owner or with the owner's approval. Enabling an API costs nothing in
itself; usage is billed.

Derived from the code: `functions/src/index.ts` exports 34 callables, 1 HTTP
function (Razorpay webhook, declares 2 secrets), 5 Firestore `onDocumentWritten`
triggers and 1 `onSchedule` job (41 functions); the client uses Auth
(email/password), Firestore, Storage reads and Hosting.

| API | Purpose for DSBC | Required by DSBC? | Required for the pilot? | Can stay disabled? | `v-nexus-lite` now | Human action |
|---|---|---|---|---|---|---|
| `firebase.googleapis.com` | Firebase project management | yes | yes | no | enabled | enable at project creation |
| `identitytoolkit.googleapis.com` | Firebase Auth (email/password sign-up/in) | yes | yes | no | enabled (Google provider only) | enable the **Email/Password** provider |
| `securetoken.googleapis.com` | ID token refresh | yes | yes | no | enabled | automatic with Auth |
| `firestore.googleapis.com` | `dsbc-production` database | yes | yes | no | enabled | create the database (edition, region) |
| `firebaserules.googleapis.com` | deploying Firestore + Storage rules | yes | yes | no | enabled | — |
| `firebasestorage.googleapis.com` | Cloud Storage for Firebase (default bucket, rules) | yes | yes (logos, photos) | no | **disabled** | enable; create the default bucket |
| `storage.googleapis.com` | Cloud Storage | yes | yes | no | enabled | — |
| `firebasehosting.googleapis.com` | the DSBC site | yes | yes | no | enabled | — |
| `cloudfunctions.googleapis.com` | the 41 backend functions | yes | yes (all authority is in the backend, D25) | no | **disabled** | approve enabling |
| `run.googleapis.com` | runtime of gen 2 functions | yes | yes | no | enabled | — |
| `cloudbuild.googleapis.com` | builds the function containers on deploy | yes | yes | no | **disabled** | approve enabling (needs billing) |
| `artifactregistry.googleapis.com` | stores function images | yes | yes | no | enabled | — |
| `eventarc.googleapis.com` | the 5 Firestore triggers (seat enforcement, usage measurement) | yes | yes (seat limits are enforced by them) | no | **disabled** | approve enabling |
| `pubsub.googleapis.com` | transport for Scheduler and Eventarc | yes | yes | no | enabled | — |
| `cloudscheduler.googleapis.com` | `reconcileSubscriptionsDaily` (expires trials / complimentary grants; Platform Health RECONCILIATION) | yes | yes: deploy fails without it as the code stands | no | **disabled** | approve enabling |
| `secretmanager.googleapis.com` | `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | yes | yes: the webhook function declares them even while payments are disabled | no | **disabled** | approve enabling; the owner sets placeholder values |
| `logging.googleapis.com`, `monitoring.googleapis.com` | function logs, error triage | yes (operations) | yes | no | enabled | — |
| `iam.googleapis.com`, `cloudresourcemanager.googleapis.com`, `serviceusage.googleapis.com` | service accounts, IAM bindings, enabling APIs | yes | yes | no | enabled | — |
| `firebaseappcheck.googleapis.com` | App Check (abuse protection for callables) | optional | no | yes | enabled | later hardening decision |
| `generativelanguage.googleapis.com` (Gemini) | **not used**: `@google/genai` is a dependency, but no DSBC code calls it | no | no | **yes** | enabled | keep disabled in the DSBC project; restrict the browser key |
| BigQuery, Cloud SQL, Remote Config, FCM, Dataform, … | not used by DSBC | no | no | yes | enabled (other apps) | do not enable in the DSBC project |

## Summary

- **Disabled in `v-nexus-lite` but required:** Cloud Functions, Cloud Build,
  Eventarc, Cloud Scheduler, Secret Manager, Cloud Storage for Firebase, and
  the Email/Password Auth provider.
- **Recommended path:** enable them in the new dedicated project, where doing
  so cannot affect V-Nexus Lite, Vidwan Kids or the AI Studio applets.
