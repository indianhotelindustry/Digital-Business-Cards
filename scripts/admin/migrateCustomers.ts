// ============================================================================
// Existing-customer migration (Directive 27 Phase 3)
// ============================================================================
// See docs/directive-27/CUSTOMER-MIGRATION-PLAN.md.
//
//   1. discover (read-only):
//      npx tsx scripts/admin/migrateCustomers.ts discover --project <id> --confirm-project <id> --database <db> --out migration-work/preview.json
//   2. approval template for the App Owner to review and edit:
//      npx tsx scripts/admin/migrateCustomers.ts template --preview migration-work/preview.json --approver <appOwnerUid> --out migration-work/approval.json
//   3. validate (read-only dry run of the approval against FRESH data):
//      npx tsx scripts/admin/migrateCustomers.ts execute --project ... --database ... --approval migration-work/approval.json
//   4. execute (writes subscriptions only):
//      ... execute ... --approval migration-work/approval.json --run-id <id> --confirm-execute
//
// migration-work/ is git-ignored: previews contain customer names and must
// not be committed. Nothing in this tool deletes or edits customer content.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, resolveAdminTarget, type AdminArgs } from './adminTarget';

type Migration = typeof import('../../functions/src/platform/migration');

async function bind(args: AdminArgs): Promise<Migration> {
  const target = resolveAdminTarget(args, 'migrate');
  process.env.GCLOUD_PROJECT = target.projectId;
  process.env.DSBC_FIRESTORE_DATABASE = target.databaseId === '(default)' ? '' : target.databaseId;
  return import('../../functions/src/platform/migration');
}

const writeJson = (file: string, value: unknown) => {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(resolve(file), JSON.stringify(value, null, 2) + '\n');
};
const need = (args: AdminArgs, key: string): string => {
  const v = args[key];
  if (typeof v !== 'string' || !v) throw new Error(`Missing --${key}.`);
  return v;
};

export async function discover(args: AdminArgs) {
  const m = await bind(args);
  return m.discoverCustomers();
}

export function template(preview: Awaited<ReturnType<Migration['discoverCustomers']>>, approverUid: string) {
  const decisions: Record<string, { action: 'SKIP' } | { action: 'ASSIGN_FREE' }> = {};
  for (const c of preview.customers) {
    // Only the plain free-plan mapping is pre-filled; everything needing a decision starts as SKIP.
    decisions[c.key] = c.subscription.proposal === 'ASSIGN_FREE' ? { action: 'ASSIGN_FREE' } : { action: 'SKIP' };
  }
  return { schema: 'dsbc.migrationApproval/v1' as const, previewHash: preview.previewHash, approvedByUid: approverUid, decisions };
}

export async function execute(args: AdminArgs) {
  const m = await bind(args);
  const approval = JSON.parse(readFileSync(resolve(need(args, 'approval')), 'utf8'));
  if (args['confirm-execute'] !== true) {
    const preview = await m.discoverCustomers();
    await m.validateApproval(approval, preview);
    const writes = Object.entries(approval.decisions).filter(([, d]) => (d as { action: string }).action !== 'SKIP');
    return { dryRun: true, valid: true, previewHash: preview.previewHash, wouldWrite: writes.map(([k, d]) => ({ key: k, ...(d as object) })) };
  }
  return { dryRun: false, ...(await m.executeMigration(approval, need(args, 'run-id'))) };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (command === 'discover') {
    const preview = await discover(args);
    writeJson(need(args, 'out'), preview);
    console.log(`Discovered ${preview.customers.length} customers (${preview.excluded.length} excluded); preview hash ${preview.previewHash}`);
    console.log(JSON.stringify(preview.summary));
  } else if (command === 'template') {
    const preview = JSON.parse(readFileSync(resolve(need(args, 'preview')), 'utf8'));
    writeJson(need(args, 'out'), template(preview, need(args, 'approver')));
    console.log('Approval template written. Review every decision before executing.');
  } else if (command === 'execute') {
    const out = await execute(args);
    console.log(JSON.stringify(out, null, 2));
  } else {
    throw new Error('Usage: migrateCustomers.ts discover|template|execute ...');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
