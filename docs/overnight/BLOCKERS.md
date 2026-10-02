# Blockers: why DSBC was not deployed overnight

Every blocker below was **measured** on 2026-10-03 with read-only commands
(`scripts/directive27/liveProbe.mjs`, Firebase CLI and gcloud list/describe
calls, Firestore reads) unless it is marked otherwise. Nothing was deployed,
enabled, created or written on the live project.

Evidence: [evidence/live-probe.json](evidence/live-probe.json),
[evidence/bootstrap-dry-run-live.json](evidence/bootstrap-dry-run-live.json),
[evidence/migration-discovery-summary.json](evidence/migration-discovery-summary.json).

## The single next human action

**Decide where DSBC production is hosted, and record it.**

`v-nexus-lite` is a shared project. Its default hosting site serves another
live app, it holds three other AI Studio databases, and its Auth user pool and
storage bucket are shared. The App Owner has two options:

| | Option A: stay in `v-nexus-lite` | Option B: a dedicated DSBC project |
|---|---|---|
| Hosting | create a **new** site (the default site is taken) | default site is free |
| Auth | shared with the other apps' users | DSBC only |
| Storage rules | deploying them replaces the rules for **every** app on the bucket | DSBC only |
| Existing data | stays where it is (only 2 legacy demo companies, see B9) | nothing real to move |
| Registry change | `hosting.site`, `publicOrigin` | the whole `production` entry, `functions/.env.<project>`, `.firebaserc` |

Then record the decision in `config/environments.json` and run
`node scripts/directive27/liveProbe.mjs` again. Every other blocker depends on
this choice.

## Blockers to deployment (stop conditions 1, 2, 3, 8)

| # | Blocker | Measured fact | Who | What resolves it |
|---|---|---|---|---|
| B1 | **Hosting site not designated; the default site belongs to another app** | `https://v-nexus-lite.web.app` serves "V-Nexus Lite \| Enterprise Performance" (live release 2026-01-19). Site `vidwan-kids` is another app. `hosting.site` is `null`. | App Owner | Option A: `firebase hosting:sites:create <dsbc-site> --project v-nexus-lite`, set `hosting.site`, then `firebase target:apply hosting dsbc-web <dsbc-site> --project v-nexus-lite --config firebase.production.json`. Never deploy to the `v-nexus-lite` site. |
| B2 | **Public origin not designated** | `publicOrigin` is `null`, `DSBC_PUBLIC_ORIGIN=` is empty | App Owner | Set `publicOrigin` in the registry **and** `DSBC_PUBLIC_ORIGIN` in `functions/.env.v-nexus-lite` (the backend refuses to load if they differ). Share links and QR codes use it. |
| B3 | **Deployment APIs disabled** | Not enabled: `cloudfunctions`, `cloudbuild`, `eventarc`, `cloudscheduler`, `secretmanager`. Enabled: `artifactregistry`, `run`, `pubsub`, `firestore`, `firebasehosting`, `firebaserules`, `identitytoolkit`, `storage`. Billing is enabled. | App Owner (billing, shared project) | `gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com eventarc.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com --project v-nexus-lite` |
| B4 | **Function secrets do not exist** | Secret Manager API disabled, so `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` cannot exist. The payment functions declare them, so `firebase deploy --only functions` fails. | App Owner | After B3: `firebase functions:secrets:set RAZORPAY_KEY_SECRET --project v-nexus-lite` (same for the webhook secret). A placeholder value is fine while payments are off. **Not set overnight: credentials are never invented.** |
| B5 | **Storage bucket is shared** | `v-nexus-lite.firebasestorage.app` serves every app in the project | App Owner | Confirm no other app uses the bucket, or provision a dedicated DSBC bucket and register it (Option B avoids this). |
| B6 | **App Owner identity not designated** | The live rules are still the legacy ruleset `90dcc764` (released 2026-10-01). They grant App Owner through an **email allow-list**: a placeholder address plus one Gmail account, the same account the Firebase CLI on this machine is signed in as. No `platformRole` claim census was taken (see N1). | App Owner | Confirm the identity. **Right after** the rules deploy (runbook step 3): `npx tsx scripts/admin/setAppOwner.ts --project v-nexus-lite --confirm-project v-nexus-lite --database ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5 --email <owner email>`, then the same command with `--verify` (exit 0). Not granted overnight: the email must not be guessed, and a claim granted before the new rules is inert. |
| B7 | **No staging; Enterprise edition unverified** | The DSBC database is **Enterprise** edition. The emulator only runs Standard, so rules and Firestore triggers have never run on Enterprise. No staging project is designated. | App Owner | Designate a staging project, or approve a one-off rehearsal on a scratch Enterprise database. Other DSBC-named projects visible to this account (`dsbc-civil-staging`, `dsbc-g3-072a-rehearsal`, …) were **not** assumed to be DSBC Cards staging. |
| B8 | **Legacy client still live against the same database** | The legacy rules release was updated 2026-10-01 05:38 UTC, which suggests the AI Studio app that owns this database still publishes to it. **NOT VERIFIED**: whether republishing that app would overwrite DSBC's rules. | App Owner | Retire or disconnect the legacy AI Studio deployment before go-live. Deploying the new rules **breaks the legacy client's browser-side writes** (by design: D25 backend authority). Deploy rules, functions and hosting in one window (RUNBOOK §2–9). |
| B9 | **Migration decision** | Read-only discovery (hash `49d3a426f733…`): **2 companies, both legacy in-app demo data** (`DEMO_CANDIDATE`, no verified sign-in, browser-written paid `planId`), 0 subscriptions, 0 publishing records, 0 real customers. | App Owner | Record `SKIP` for both (the only decision the tool accepts for demo candidates). Nothing is migrated and nothing is deleted. Removing the demo data later is a separate, explicit owner decision. |
| B10 | **Notifications** | No email provider is integrated | App Owner | Integrate one, or accept `NOTIFICATIONS = NOT_CONFIGURED` in writing. Platform Health then reports DEGRADED, honestly. |

## Recommendations (not blockers, but worth deciding before real customer data)

| # | Item | Measured fact | Action |
|---|---|---|---|
| R1 | Database recovery | DSBC database: point-in-time recovery **DISABLED**, delete protection **DISABLED** | `gcloud firestore databases update --database=ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5 --enable-pitr --delete-protection --project v-nexus-lite` |
| R2 | Browser API key scope | The Gemini API (`generativelanguage.googleapis.com`) is enabled on the project. **NOT VERIFIED** whether the public Firebase web key is API-restricted (the API Keys API is disabled; the key was not probed against Gemini). | In the Cloud Console, restrict the browser key to the Firebase APIs and the DSBC origin. |
| R3 | Bundle size | Main chunk 1.67 MB (372 KB gzip); Vite warns over 500 KB | Code-split later. Not a launch defect, and left unchanged overnight. |

## Not executed overnight (and why)

| # | Item | Reason |
|---|---|---|
| N1 | Census of `platformRole` claim holders on live Auth | Denied by the Claude Code permission classifier: it would list every account in an Auth pool shared with other apps. Not retried. It is a read-only check the owner can run. |
| N2 | Live Platform Health | The `adminGetPlatformHealth` callable is not deployed (B3), and it must be called by a signed-in App Owner (B6). |
| N3 | Live smoke test and live three-customer rehearsal | No DSBC deployment exists to test (B1–B4). |
| N4 | Production bootstrap (write) | A dry run against live shows all 40 control-plane documents missing. The real run is RUNBOOK step 4, **after** the rules deploy and the App Owner grant, so it was not run ahead of them. |
