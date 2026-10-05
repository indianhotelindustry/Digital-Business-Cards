# Controlled deployment runbook (Directive 27)

Nothing here runs automatically, and passing tests is not a reason to deploy.
Each step names its verification and how to undo it. Stop at the first failure.

Values used below:

```bash
PROJECT=v-nexus-lite
DB=ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5
P="--project $PROJECT --confirm-project $PROJECT --database $DB"
```

## 0. Before deployment day

| Item | Done when |
|---|---|
| Designations in [PRODUCTION-CONFIGURATION.md](PRODUCTION-CONFIGURATION.md) (hosting site, public origin, bucket ownership, staging or a written waiver) | `npx tsx scripts/directive27/preflight.ts` shows **0 FAIL, 0 BLOCKED** |
| Firestore **Enterprise edition** verified for rules + Firestore triggers | staging rehearsal, or a one-off test on a scratch Enterprise database (the emulator only runs Standard edition) |
| Secret Manager: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` exist (placeholders are fine while payments are off) | `firebase functions:secrets:get RAZORPAY_KEY_SECRET --project $PROJECT` |
| Billing (Blaze) enabled; APIs: Cloud Functions, Cloud Build, Artifact Registry, Eventarc, Secret Manager | Console |
| Notifications decision: integrate a provider, or accept NOTIFICATIONS = NOT_CONFIGURED | written decision |
| Certification at the commit being deployed | `node scripts/directive27/certify.mjs` → Demo Ready PASS |
| Snapshot of the live rules (rollback point) | `docs/directive-27/evidence/live-snapshot/` (ruleset `90dcc764…`, taken 2026-10-02); refresh it on the day |

## 1. Build the release

```bash
git status            # clean tree, the certified commit
npx vite build        # production mode → [dsbc] building for PRODUCTION: v-nexus-lite / ai-studio-…
npx tsx scripts/directive27/preflight.ts
node scripts/directive27/secretsAudit.mjs --bundle dist
```

## 2. Deploy rules and indexes (named database only)

```bash
firebase deploy --config firebase.production.json --project production --only firestore
```

Verify: in the Console, check that the rules of database `$DB` match `firestore.rules`.
The rules require the `platformRole` claim for App Owner access. The old email
allow-list and `users.role` paths stop working **now**, so do step 3
immediately.

Undo: redeploy `docs/directive-27/evidence/live-snapshot/live-firestore.rules`
to `$DB`.

> **⚠️ Only valid for the Directive 27 deploy itself.** That snapshot is the
> **pre-D27** capture (2026-10-02) and is now three directives stale: it differs
> from `firestore.rules` at the live hosting commit `28fb0c7` by ~1,191 lines
> (25,854 vs 32,640 bytes). Redeploying it during a later rollback would revert
> production rules past Directives 29-34. For a post-D27 rollback, use the rules
> from the commit that is actually live — see
> `docs/directive-34/PHASE-1-REPORT.md` §8, and confirm the live ruleset's
> provenance before relying on any source.

## 3. Grant and verify the App Owner

```bash
npx tsx scripts/admin/setAppOwner.ts $P --email <the real App Owner's verified email>
npx tsx scripts/admin/setAppOwner.ts $P --email <same email> --verify   # exit 0 = authority confirmed
```

The owner signs out and back in (the claim is in the ID token).
Undo: `--uid <uid> --revoke`.

## 4. Bootstrap the platform configuration

```bash
npx tsx scripts/admin/bootstrapProduction.ts $P --reason "D27 production bootstrap" --dry-run
npx tsx scripts/admin/bootstrapProduction.ts $P --reason "D27 production bootstrap"
```

Verify: the report under `docs/directive-27/evidence/bootstrap/` shows
`status: PASS` and `customerCollectionsUnchanged: true`. Running it again
creates nothing. Undo: the report lists every created document. Nothing else
was touched.

## 5. Deploy the backend

```bash
firebase deploy --config firebase.production.json --project production --only functions
```

The backend checks itself against the registry at load. A wrong project,
database, region or payment switch makes this step fail before anything is
created. Undo: `firebase functions:delete <names> --project $PROJECT --region us-west1`.
Before DSBC no DSBC functions existed, so deleting returns to the previous state.

> **⚠️ The region in that undo command is wrong for this project.** DSBC's
> functions are deployed in **`asia-south1`** (measured 2026-10-04: 45 callables
> in `asia-south1`), not `us-west1`. Use `--region asia-south1`, or the delete
> silently matches nothing. Note also that `firebase` is not on `PATH` — it is a
> root devDependency, so prefix CLI commands with `npx`.

## 6. Storage rules (only after the bucket-ownership decision)

```bash
firebase deploy --config firebase.production.json --project production --only storage
```

## 7. Platform Health

The App Owner signs in, then opens **Production Launch Gate → Health &
Fail-Safe Observability**. Expected: ENVIRONMENT, AUTH, APP_OWNER, FIRESTORE,
INDEXES, STORAGE, FUNCTIONS, ENTITLEMENTS, PUBLISHING, AUDIT = OK; PAYMENTS and
WEBHOOK = DISABLED. PUBLIC_URL turns OK only after step 9. Stop on any FAIL.

## 8. Existing-customer migration

Follow [CUSTOMER-MIGRATION-PLAN.md](CUSTOMER-MIGRATION-PLAN.md) (discover →
App Owner review → validate → execute).

## 9. Deploy hosting

```bash
firebase deploy --config firebase.production.json --project production --only hosting
```

Verify from a clean browser on another device: `/pricing` loads,
`/no-such-page` answers HTTP 404, and `/card/<slug>`, `/profile/<slug>`,
`/company/<slug>` of a real published customer render. Platform Health
PUBLIC_URL is OK.
Undo: `firebase hosting:rollback --project $PROJECT` (or Console → Hosting →
release history).

## 10. Live three-customer verification (Production Certification input)

Repeat the Phase 6 acceptance scenario on the real URLs with three real
customers: register → company → ≥1 employee → card + website published →
clean-browser checks → App Owner Demo Readiness shows 3 of 3. Record the
results. Only then can production certification be considered.

## Full rollback order

hosting rollback → delete functions → redeploy the snapshot rules → (data)
subscriptions created by the migration stay, are audited and can be changed
through App Owner controls. Bootstrap documents are inert without the backend.
