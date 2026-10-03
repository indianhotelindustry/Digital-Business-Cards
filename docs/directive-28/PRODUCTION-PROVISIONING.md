# Production provisioning plan: dedicated DSBC project (Phases 10, 11, 13, 15)

Nothing in this plan has been executed. "AUTOMATED" means the engineering
agent can run it **after** the human steps before it are done, with the
owner's go-ahead for each live step. `<P>` is the new project id.

```bash
P=<P>; DB=dsbc-production; REGION=asia-south1
A="--project $P --confirm-project $P --database $DB"
```

## Step-by-step

| # | Step | Type | Commands / actions | Verified by |
|---|---|---|---|---|
| 1 | **Infrastructure creation** | **HUMAN ACTION REQUIRED** | Create the project (Firebase Console → Add project, or `gcloud projects create $P`), choose the id (permanent), link a **Blaze** billing account, keep Google Analytics optional. Approve the API list ([API-REQUIREMENTS.md](API-REQUIREMENTS.md)). | project visible to the operator; billing enabled |
| 1b | Enable APIs | AUTOMATED after approval | `gcloud services enable firebase.googleapis.com identitytoolkit.googleapis.com firestore.googleapis.com firebaserules.googleapis.com firebasestorage.googleapis.com storage.googleapis.com firebasehosting.googleapis.com cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com eventarc.googleapis.com pubsub.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com --project $P` | `liveProbe` REQUIRED_APIS = PASS |
| 2 | **Firebase initialization** | AUTOMATED | `firebase projects:addfirebase $P` (if created in GCP); `firebase apps:create web "DSBC Web" --project $P`; `firebase apps:sdkconfig web <appId> --project $P` → fill `<WEB_APP_ID>`, `<WEB_API_KEY>`, `<SENDER_ID>` in the registry | resolver accepts the target (no placeholders) |
| 3 | **Authentication** | HUMAN ACTION REQUIRED (Console), then verified automatically | Enable **Email/Password**. Authorized domains: `<P>.web.app`, `<P>.firebaseapp.com`, the custom domain. Restrict the browser API key to the Firebase APIs + DSBC origins. | `liveProbe` AUTH_EMAIL_PROVIDER = PASS |
| 4 | **Firestore** | AUTOMATED after approval of location | `gcloud firestore databases create --database=$DB --location=$REGION --edition=standard --project $P` (location is **permanent**), then `gcloud firestore databases update --database=$DB --enable-pitr --delete-protection --project $P` | `liveProbe` TARGET_DATABASE = PASS, DATABASE_RECOVERY = PASS |
| 5 | **Storage** | HUMAN ACTION REQUIRED (Console: Storage → Get started, location $REGION) | creates `<P>.firebasestorage.app` | `liveProbe` STORAGE_BUCKET = PASS |
| 6 | **Functions configuration** | AUTOMATED | Write `functions/.env.<P>` (from the proposal's `backendEnv`), `.firebaserc` production alias = `<P>`, replace the registry production entry with the filled proposal (`boundary.dedicatedProject: true`). Run `npx vite build && npx tsx scripts/directive27/preflight.ts`. | preflight: 0 FAIL; PRODUCTION_BOUNDARY = PASS |
| 7 | **Secrets** | **HUMAN ACTION REQUIRED** | `firebase functions:secrets:set RAZORPAY_KEY_SECRET --project $P` and `… RAZORPAY_WEBHOOK_SECRET …`, with a placeholder value of the owner's choosing while payments are disabled. **Never generated or invented by the agent.** | `liveProbe` FUNCTION_SECRETS = PASS |
| 8 | **Hosting** | AUTOMATED | `firebase target:apply hosting dsbc-web $P --project $P --config firebase.production.json` | `liveProbe` HOSTING_SITE = PASS |
| 9 | **Domain** | **HUMAN ACTION REQUIRED** | Choose the domain, add the DNS records Firebase shows, wait for TLS. Set `publicOrigin` + `DSBC_PUBLIC_ORIGIN`. | `liveProbe` PUBLIC_ORIGIN = PASS; HTTPS works |
| 10 | **App Owner** | **HUMAN ACTION REQUIRED** | See [AUTHORITY-PLAN.md](AUTHORITY-PLAN.md): name the email; email-verification step shipped first; register + verify; operator grants with `setAppOwner.ts $A --email …` right after step 12a. | `setAppOwner.ts … --verify` exit 0 |
| 11 | **Bootstrap** | AUTOMATED | `npx tsx scripts/admin/bootstrapProduction.ts $A --reason "DSBC production bootstrap" --dry-run`, then without `--dry-run` | report PASS, 40 created, customer collections unchanged; second run creates 0 |
| 12 | **Deployment** | AUTOMATED, after explicit owner go-ahead | Clean tree at the certified commit. 12a `firebase deploy --config firebase.production.json --project production --only firestore`; 12b App Owner grant (step 10); 12c `… --only functions`; 12d `… --only storage`; 12e `npx vite build` → `… --only hosting` | `liveProbe`: FIRESTORE_RULES_DEPLOYED, FUNCTIONS_DEPLOYED (41/41), CONTROL_PLANE_BOOTSTRAPPED, HOSTING_DEPLOYED (build-info commit = HEAD) all PASS → live deployment COMPLETE |
| 13 | **Health checks** | HUMAN (App Owner signs in) + AUTOMATED evaluation | App Owner opens Platform Health; owner triggers `adminReconcileNow` once. Export the report to `docs/overnight/evidence/live-health.json`. Expected: all OK, PAYMENTS/WEBHOOK = DISABLED, NOTIFICATIONS = NOT_CONFIGURED unless a provider is added. | `liveProbe` LIVE_PLATFORM_HEALTH |
| 14 | **Live smoke tests** | AUTOMATED (real browser against the live origin) | the 20 steps of [../overnight/LIVE-SMOKE-RESULTS.md](../overnight/LIVE-SMOKE-RESULTS.md) with clean browser contexts | recorded results |
| 15 | **Three-customer pilot** | **HUMAN** (three real pilot customers) + AUTOMATED verification | [THREE-CUSTOMER-PILOT-PLAN.md](THREE-CUSTOMER-PILOT-PLAN.md) → `docs/overnight/evidence/live-acceptance.json` | `liveProbe` LIVE_ACCEPTANCE = PASS |
| 16 | **Production certification** | AUTOMATED gate, HUMAN sign-off | `node scripts/directive27/liveProbe.mjs && node scripts/directive27/certify.mjs` → all five levels PASS | `certification.json` productionCertified = PASS |

Rollback at any step: hosting `firebase hosting:rollback`, functions delete,
rules redeploy, plus the database's PITR. The new project holds no other app,
so rollback cannot affect anyone else.

## Production configuration (Phase 10)

The exact registry entry, backend env and secrets list are in
[environments.production.proposed.json](environments.production.proposed.json).

| Item | Value |
|---|---|
| Hosting target | `dsbc-web` → site `<P>` |
| Firestore database | `dsbc-production` (Standard, asia-south1, PITR + delete protection) |
| Storage bucket | `<P>.firebasestorage.app` (asia-south1) |
| Functions region | `asia-south1` |
| Public URL | `<DSBC_PUBLIC_ORIGIN>` (custom domain; interim `https://<P>.web.app`) |
| Backend env (`functions/.env.<P>`) | `DSBC_ENVIRONMENT=production`, `DSBC_FIRESTORE_DATABASE=dsbc-production`, `DSBC_FUNCTIONS_REGION=asia-south1`, `DSBC_PUBLIC_ORIGIN=<origin>`, `PAYMENTS_ENABLED=false`, `RAZORPAY_KEY_ID=` |
| Secrets | `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (owner-set placeholders) |
| App Owner | one verified account, claim `platformRole=app_owner` |
| Platform configuration | bootstrap: 5 plans, 33 catalogue features, global policy, `platformConfig/deployment` (reserved slugs, `paymentsEnabled: false`) |
| Payments | **DISABLED** (registry, backend env, global policy, platform config). Enabling them is a separate, explicitly approved directive. |

Region note: asia-south1 (Mumbai) is recommended because the users are in
India (the reconciler runs in Asia/Kolkata, and Razorpay is the intended
gateway). Firestore, Cloud Functions gen 2, Scheduler and Eventarc are all
offered there. The owner confirms it, because a database location cannot be
changed later.

## Bootstrap review (Phase 11)

| Control-plane record | Created by | Verified |
|---|---|---|
| plans (5) | `bootstrapProduction.ts` (create-if-missing) | fresh named-DB rehearsal: created 40, rerun created 0 |
| feature catalogue (33) | same | same |
| global policy | same | same |
| platform configuration + reserved slugs, `paymentsEnabled: false` | same | same; drift detection reports changed reserved slugs or payments |
| reconciliation record `platformConfig/reconciliation` | **the reconciler itself** (daily job or `adminReconcileNow`); deliberately **not** faked by the bootstrap | Platform Health shows NOT_VERIFIED until the first real run, then OK |
| audit | `entitlementAuditLogs` + `platformAuditLogs` entry per bootstrap | rehearsal: 1 + 1 |

No destructive writes (create-if-missing only), no customer collections
touched (counted before/after), no demo data, no payment activation. Evidence:
[evidence/bootstrap-fresh-named-db-run1.json](evidence/bootstrap-fresh-named-db-run1.json),
[run2](evidence/bootstrap-fresh-named-db-run2.json); D27 tests BOOT-001..006.

## Cost and operational review (Phase 13)

No prices are quoted here. They must come from the Google Cloud pricing pages
or the billing console at provisioning time.

| Resource | Existing / new | Mandatory / optional | Billing basis (no figures) |
|---|---|---|---|
| Google Cloud project + Blaze billing account | **new** | mandatory | pay-as-you-go; per-product free quotas apply |
| Firestore `dsbc-production`, Standard edition | new | mandatory | reads/writes/storage. **Measured:** in `v-nexus-lite` the Standard `(default)` database reports `freeTier: true` and the Enterprise DSBC database `freeTier: false`. Choosing Standard keeps the free tier available to DSBC. |
| PITR | new | recommended | extra storage for version retention |
| Cloud Storage default bucket | new | mandatory | stored GB + egress (logos and photos) |
| Hosting site + custom domain TLS | new | mandatory | storage + transfer; TLS included |
| Cloud Functions gen 2 (41) + Cloud Run + Cloud Build + Artifact Registry | new | mandatory | invocations / compute time; build minutes; image storage |
| Eventarc (5 triggers), Pub/Sub, Cloud Scheduler (1 job) | new | mandatory | per event / message / job |
| Secret Manager (2 secrets) | new | mandatory | per secret version + access |
| Logging / Monitoring | new | mandatory | ingestion beyond free allotment |
| Custom domain registration | existing or new (owner's) | recommended | registrar |
| Email provider for notifications | new | optional (NOTIFICATIONS = NOT_CONFIGURED otherwise) | provider plan |
| Staging project (same shape, no customer data) | new | recommended before scale | as above, low volume |
| `v-nexus-lite` resources | existing | not used by DSBC production | unchanged |
