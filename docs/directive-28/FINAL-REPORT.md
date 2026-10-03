# Directive 28: final report

| | |
|---|---|
| Branch | `security-foundation/directive-27` (D28 continues it; no new branch was needed for a study) |
| Start | `e47a487` (overnight checkpoint), clean apart from the pre-existing untracked `.vscode/` |
| Date | 2026-10-03 |
| Live environment changed? | **No.** Read-only inspection only: no deployment, API enablement, project creation, claim change, rules change, bootstrap write, migration, deletion or DNS change. |

## 1. Recommended production boundary

**A dedicated Firebase / Google Cloud project for DSBC alone** (Option A).
Proposed shape: Firestore `dsbc-production` (Standard edition, asia-south1,
PITR + delete protection), the project's default bucket, its default hosting
site, Cloud Functions gen 2 in asia-south1, Email/Password Auth, secrets in its
own Secret Manager, payments **disabled**.
[ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md), [decision.json](decision.json).

## 2. Is `v-nexus-lite` safe for DSBC?

**No. Option B is UNSAFE.**

## 3. Why (measured, not assumed)

| Boundary | Finding |
|---|---|
| Co-tenants | V-Nexus Lite (default site, `(default)` database), Vidwan Kids (site, Cloud Run, bucket), two more AI Studio applet databases |
| Auth | one plain Firebase Auth pool (no tenants); **only Google sign-in enabled**, while DSBC registers with email/password; enabling it is project-wide |
| Runtime identity / IAM | the **default compute SA has `roles/editor`**, is Vidwan Kids' runtime and would be DSBC's functions identity |
| Storage | the registry bucket **does not exist**; the Firebase Storage API is disabled; the backend uses the default bucket |
| Web app | DSBC's config is the generic `ai-studio-applet-webapp` |
| APIs | Cloud Functions, Build, Eventarc, Scheduler, Secret Manager disabled |
| Data | 0 real DSBC customers (2 legacy demo companies), so there is nothing to lose by leaving |

The decision is enforced in code. `config/environments.json` records
`boundary.dedicatedProject: false`, and the preflight check
`PRODUCTION_BOUNDARY` blocks deployment. The live probe re-measures
PROJECT_BOUNDARY, AUTH_EMAIL_PROVIDER, STORAGE_BUCKET and FUNCTIONS_IDENTITY.

## 4. Required infrastructure

New project + Blaze billing; Firebase web app "DSBC Web"; Auth (Email/Password);
Firestore `dsbc-production`; default Storage bucket; Hosting site + custom
domain; Cloud Functions gen 2 (41) with Cloud Run, Cloud Build, Artifact
Registry; Eventarc (5 triggers), Pub/Sub, Cloud Scheduler (1 job); Secret
Manager (2 secrets); Logging/Monitoring. Optional: email provider, App Check,
staging project. [API-REQUIREMENTS.md](API-REQUIREMENTS.md),
[PRODUCTION-PROVISIONING.md](PRODUCTION-PROVISIONING.md).

## 5. Human actions required

H1 create the dedicated project + Blaze billing (or state that `dsbc-e8ok3g3sf`
is meant for this and grant access) · H2 approve the APIs and region
(asia-south1) · H3 choose the domain + DNS · H4 name the App Owner email ·
H5 set the two Razorpay secrets (placeholders) · H6 enable Email/Password and
initialize Storage · H7 notifications decision · H8 approve each deploy step ·
H9 recruit the pilot customers. [BLOCKERS.md](BLOCKERS.md).

## 6. Is a dedicated Firebase project required?

**Yes.** None exists that the operator can use: `command-centre-640ac` hosts
another app, and `dsbc-e8ok3g3sf` is inaccessible with an unknown purpose. No
project was created automatically.

## 7. Was anything changed in the live environment?

**No.** All live interaction was reads: list/describe calls, rules and Auth
configuration `GET`s, an IAM policy read (summarised with members masked),
`listCollections`/`count` on the DSBC database, and the bootstrap **dry run**.
Unrelated Auth users were not enumerated. The bootstrap rehearsal ran on the
**emulator**.

## 8. Tests

Full run (`node scripts/directive27/certify.mjs`) at `898f053`. The only code
change after it (`6d16d5a`) is in `scripts/directive27/liveProbe.mjs`, which
no test executes.

| Suite | Result |
|---|---|
| Unit | 79/79 (+3 D28: ENV-020 boundary, ENV-021 proposal, ENV-022 placeholders) |
| Rules (emulator) | 559/559 |
| Integration (emulator) | 19/19 |
| Backend authority / public / three-customer / health (emulator) | 134/134 |
| Browser (real Chrome, production-mode bundle) | 20/20 |
| **Total** | **811/811 passed, 0 failed** |
| Mutation | **43/43 killed** (+E16 boundary, +E17 placeholders) |
| TypeScript / build | PASS / PASS |
| Preflight (production) | 0 FAIL; BLOCKED: PRODUCTION_BOUNDARY, hosting site, public origin, staging |
| Secrets audit | source PASS, bundle PASS, server PASS, history INVESTIGATE (known placeholders) |
| Bootstrap on a fresh named DB (emulator) | 40 created → rerun 0, PASS |
| Five-level gate | Demo Ready **PASS** · Deployment **BLOCKED** (17 blockers) · Live Deployment **NOT COMPLETE** · Live Acceptance **NOT EXECUTED** · Production Certified **FAIL** |

**Defect found and fixed during D28:** the live probe turned an unreadable
Firebase CLI result (a trailing `{"status":"error","error":"Timed out."}`) into
"database not found". It now parses the successful object, retries, and says
"could not list … nothing is concluded" otherwise (`6d16d5a`).

## 9–10. Git

See the closing commit list (`git log`): `c127bf6` safeguards, `898f053`
study docs, `6d16d5a` probe fix, then this report + evidence.

## 11. Next directive

**Directive 29: Dedicated DSBC production provisioning and controlled first
deployment.** It starts **only after** H1–H5 (project id + billing, region,
domain, App Owner email, secrets) are done. Scope:

1. Ship the email-verification step (AUTHORITY-PLAN gap C4), with tests.
2. Optional hardening: a dedicated functions runtime SA (`setGlobalOptions`).
3. Fill the registry from the proposal, `functions/.env.<P>`, `.firebaserc`;
   preflight `PRODUCTION_BOUNDARY` = PASS, 0 placeholders.
4. Execute PRODUCTION-PROVISIONING steps 1b–12 with owner approval at each live step.
5. Live health, live smoke, three-customer pilot, then the five-level gate.

Payments stay disabled in Directive 29.
