# Existing-customer migration plan (Directive 27 Phase 3)

Directive 25 found that live customers created before the server-authoritative
model have **no `subscriptions/*` record**. Without one they resolve to the free
plan: their content stays, and paid features lock. This plan maps them onto the
authoritative model before go-live, without losing content or paid access.

Code: [functions/src/platform/migration.ts](../../functions/src/platform/migration.ts),
CLI: [scripts/admin/migrateCustomers.ts](../../scripts/admin/migrateCustomers.ts),
tests: [tests/integration/productionOps.test.ts](../../tests/integration/productionOps.test.ts) (MIG-001..007).

## Guarantees

| Guarantee | How it is enforced | Test |
|---|---|---|
| Discovery changes nothing | `discoverCustomers()` only reads | MIG-001 compares every collection before/after |
| Nothing paid is proposed | proposals are `ASSIGN_FREE`, `NONE_NEEDED` or `OWNER_DECISION_REQUIRED` | MIG-001 |
| Legacy "paid" plans need an owner decision | a browser-written `companies.planId` is not evidence of payment → `LEGACY_PAID_PLAN_CLAIM` | MIG-001, MIG-005 |
| Paid / complimentary access can be preserved | `GRANT_COMPLIMENTARY` with recorded evidence (invoice, contract, payment reference), right plan type, 1–3650 days | MIG-004, MIG-005 |
| Only the App Owner approves | approver must hold the `platformRole` claim, a verified email and an enabled account | MIG-002 |
| The approval matches the data | SHA-256 preview hash; any change since the preview refuses the run | MIG-003 |
| Demo / test records are never migrated | `DEMO_CANDIDATE` accepts only `SKIP` | MIG-004 |
| Existing subscriptions are never overwritten | refused at validation and re-checked right before each write | MIG-004, MIG-006 |
| Content is preserved | only subscriptions are created; companies, employees, profiles, cards, publishing records stay byte-identical (except the `companies.planId` display mirror) | MIG-005 |
| Idempotent | a second run finds `NONE_NEEDED`; an old approval no longer matches; a run id works once | MIG-006 |
| Immutable audit trail | per-customer entries in `commercialAuditLogs` + `CUSTOMER_MIGRATION_EXECUTED` in `platformAuditLogs`; `migrationRuns/{runId}` with every result and the legacy plan id. Clients can't write any of these (rules) | MIG-005, D27 RULES |

## Procedure (live project, App Owner present)

Prerequisites: Application Default Credentials of an operator allowed to use
the Admin SDK on `v-nexus-lite`, the App Owner claim granted
([RUNBOOK.md](RUNBOOK.md) step 3), the bootstrap done (step 4).
`migration-work/` is git-ignored: previews contain customer names and emails.

```bash
P="--project v-nexus-lite --confirm-project v-nexus-lite --database ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5"

# 1. Discover (read-only)
npx tsx scripts/admin/migrateCustomers.ts discover $P --out migration-work/preview.json

# 2. Approval template (free-plan mappings pre-filled; everything else SKIP)
npx tsx scripts/admin/migrateCustomers.ts template --preview migration-work/preview.json \
    --approver <APP_OWNER_UID> --out migration-work/approval.json
```

3. **App Owner review.** For every customer, read `flags`, `content` and the
   `note`, then set its decision in `approval.json`:
   - `{ "action": "ASSIGN_FREE" }`: free plan, content kept.
   - `{ "action": "GRANT_COMPLIMENTARY", "planId": "company_pro", "durationDays": 365, "evidence": "INV-2025-0042 paid by bank transfer" }`
     for a customer who paid outside the system.
   - `{ "action": "SKIP" }`: leave the customer untouched (demo/test data, unknown owner).

```bash
# 4. Validate against FRESH data (read-only dry run)
npx tsx scripts/admin/migrateCustomers.ts execute $P --approval migration-work/approval.json

# 5. Execute (creates subscriptions only)
npx tsx scripts/admin/migrateCustomers.ts execute $P --approval migration-work/approval.json \
    --run-id d27-live-<yyyymmdd> --confirm-execute
```

If step 4 or 5 reports a preview hash mismatch, the data changed after the
review. Start again at step 1.

## Flags in the preview

| Flag | Meaning | Allowed decisions |
|---|---|---|
| `DEMO_CANDIDATE` | legacy in-app demo id, or every admin email is on a test/example domain | SKIP |
| `NO_VERIFIED_IDENTITY` | no enabled, email-verified sign-in owns the customer | owner decides (confirm the owner first) |
| `AUTH_ACCOUNT_MISSING` | a profile points to an Auth account that does not exist | owner decides |
| `ACCOUNT_SUSPENDED` | company/user status is not `active` | owner decides |
| `LEGACY_PAID_PLAN_CLAIM` | old browser code wrote a paid `planId` | ASSIGN_FREE or GRANT_COMPLIMENTARY with evidence |
| `HAS_SUBSCRIPTION` | already on the authoritative model | SKIP (nothing to do) |

Excluded from customers: the App Owner account and orphan profiles whose
company no longer exists. Both are listed in `excluded` and left untouched.

## Rollback

The run only **created** subscriptions. `migrationRuns/{runId}.results` lists
each `subscriptionId`. To undo one customer, an App Owner changes or suspends
that subscription through the audited App Owner controls. Nothing is deleted
silently, and the audit trail keeps the history. A run stopped half way stays
`RUNNING` in `migrationRuns`. Rerun from step 1: customers already migrated
show `NONE_NEEDED`.

## Not covered (owner decision)

**Publishing legacy live content.** Websites and cards published before
Directive 26 have no publishing record or slug-index entry, so they show "Not
Found" until published again. The preview shows this per company
(`content.publishingState: NO_PUBLISHING_RECORD`). The migration does **not**
publish anything automatically: making a customer's content public is the
customer's (or an explicitly approving App Owner's) decision. Customers can
publish from the Publishing panel in one step.
