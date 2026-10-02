# Production deployment evidence

**Deployment status: NOT EXECUTED.** No `firebase deploy`, no API enablement,
no secret creation, no bootstrap write, no App Owner grant and no migration ran
against any real project. The reasons are in [BLOCKERS.md](BLOCKERS.md).

## Target (from `config/environments.json`, verified live where marked)

| Item | Registry value | Live verification (read-only, 2026-10-03) |
|---|---|---|
| Firebase project | `v-nexus-lite` | VERIFIED: the signed-in operator account can read it; billing is enabled |
| Firestore database | `ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5` | VERIFIED: exists, **ENTERPRISE** edition, `us-west1`, PITR off, delete protection off |
| Other databases in the project | none for DSBC | `(default)` (Standard, asia-south1) plus two other `ai-studio-*` databases belonging to other apps |
| Storage bucket | `v-nexus-lite.firebasestorage.app` | shared with the project's other apps (ownership not confirmed) |
| Functions region | `us-west1` | the Cloud Functions API is **disabled**; 0 of 41 DSBC functions exist |
| Hosting site | **not designated** | the default site serves another app; a second site `vidwan-kids` is another app |
| Public origin | **not designated** | none |
| Firestore rules on the DSBC database | `firestore.rules` at HEAD | live release = legacy ruleset `90dcc764-80f8-456f-b48b-a468eca65f6c` (2026-10-01 05:38 UTC); **differs** from `firestore.rules`; App Owner granted by email allow-list |
| Control plane | 40 documents (plans, catalogue, policy, platform config) | 0 of 40 present (bootstrap dry run, `customerCollectionsUnchanged: true`) |
| Payments | disabled | `PAYMENTS_ENABLED=false` in `functions/.env.v-nexus-lite` |

The target is **not ambiguous at the project and database level**: the registry,
`firebase.production.json`, `functions/.env.v-nexus-lite` and the live project
all agree (preflight `DEPLOY_CONFIG`, `BACKEND_PARAMS`, probe `TARGET_DATABASE`).
It **is undetermined at the hosting level** (no site, no origin), and the only
existing sites belong to other apps. That alone is stop condition 1 for a
hosting deploy, and stop condition 3 (overwriting an unintended environment) if
anyone deployed to the default site.

## Build artifact identity (pre-deployment record)

New overnight: every `vite build` writes `dist/build-info.json`, which hosting
serves, so the live revision can be proven after a deploy
(`liveProbe.mjs` → `HOSTING_DEPLOYED` compares it with HEAD).

```json
{
  "schema": "dsbc.buildInfo/v1",
  "envKey": "production",
  "environment": "PRODUCTION",
  "projectId": "v-nexus-lite",
  "firestoreDatabaseId": "ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5",
  "functionsRegion": "us-west1"
}
```

The preflight `BUILD_IDENTITY` check FAILs a bundle without identity or for
another target, and BLOCKs one built at another commit (ENV-017..019; mutants
E13..E15 killed). A release build must also show `treeClean: true`.

## Deployed revisions

| Component | Revision before | Revision after |
|---|---|---|
| Firestore rules (DSBC database) | `90dcc764…` (legacy) | unchanged: NOT DEPLOYED |
| Firestore indexes | none required (`firestore.indexes.json` empty) | unchanged: NOT DEPLOYED |
| Storage rules | not inspected (shared bucket) | unchanged: NOT DEPLOYED |
| Functions | none (API disabled) | unchanged: NOT DEPLOYED |
| Hosting | no DSBC site | unchanged: NOT DEPLOYED |
| Control plane | 0 / 40 documents | unchanged: NOT WRITTEN |
| App Owner claim | not granted | unchanged: NOT GRANTED |

## Commands that will deploy, once the blockers are cleared

These are from [../directive-27/RUNBOOK.md](../directive-27/RUNBOOK.md), in
order. Stop at the first failure.

```bash
PROJECT=v-nexus-lite
DB=ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5
P="--project $PROJECT --confirm-project $PROJECT --database $DB"

git status                                   # clean tree at the certified commit
npx vite build && npx tsx scripts/directive27/preflight.ts   # 0 FAIL, 0 BLOCKED; BUILD_IDENTITY = HEAD
node scripts/directive27/secretsAudit.mjs --bundle dist
node scripts/directive27/liveProbe.mjs       # target verified = true

firebase deploy --config firebase.production.json --project production --only firestore
npx tsx scripts/admin/setAppOwner.ts $P --email <owner> && npx tsx scripts/admin/setAppOwner.ts $P --email <owner> --verify
npx tsx scripts/admin/bootstrapProduction.ts $P --reason "production bootstrap" --dry-run
npx tsx scripts/admin/bootstrapProduction.ts $P --reason "production bootstrap"
firebase deploy --config firebase.production.json --project production --only functions
firebase deploy --config firebase.production.json --project production --only storage   # only after B5
firebase deploy --config firebase.production.json --project production --only hosting
node scripts/directive27/liveProbe.mjs       # live deployment = COMPLETE
```

## How this evidence was gathered (all read-only)

| Command | Purpose |
|---|---|
| `firebase projects:list`, `hosting:sites:list`, `hosting:channel:list`, `firestore:databases:list` | project, sites, databases |
| `gcloud services list --enabled --project v-nexus-lite` | APIs |
| `gcloud secrets describe …` | secrets (API disabled) |
| `gcloud billing projects describe v-nexus-lite` | billing enabled |
| `GET firebaserules.googleapis.com/v1/projects/v-nexus-lite/releases` | live rules release per database |
| `curl https://v-nexus-lite.web.app/` | who occupies the default site |
| `npx tsx scripts/admin/bootstrapProduction.ts … --dry-run` | control-plane inventory (reads + counts) |
| `npx tsx scripts/admin/migrateCustomers.ts discover …` | customer discovery (reads only) |
| `node scripts/directive27/liveProbe.mjs` | all of the above, recorded in `evidence/live-probe.json` |
