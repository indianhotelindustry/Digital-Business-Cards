// ============================================================================
// Production Firestore bootstrap (Directive 27 Phase 2)
// ============================================================================
//   npx tsx scripts/admin/bootstrapProduction.ts --project <id> --confirm-project <id> \
//       --database <db> --reason "<why>" [--dry-run] [--report <file>]
// Creates (create-if-missing, never overwrite) the default plans, feature
// catalogue, global policy and platform configuration through
// functions/src/platform/bootstrap.ts. Running it twice changes nothing.
// It never writes customer collections and never creates demo data; the
// report proves both by counting every collection before and after.
// Real projects use Application Default Credentials; the target guard
// (adminTarget.ts) requires the project twice and the exact DSBC database.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, PRODUCTION_TARGET, resolveAdminTarget, type AdminArgs } from './adminTarget';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function runBootstrap(args: AdminArgs) {
  const target = resolveAdminTarget(args, 'bootstrap');
  const reasonText = typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : null;
  if (!reasonText) throw new Error('Missing --reason "<why>" (recorded in the audit ledger).');
  process.env.GCLOUD_PROJECT = target.projectId;
  process.env.DSBC_FIRESTORE_DATABASE = target.databaseId === '(default)' ? '' : target.databaseId;

  // Loaded after the target is fixed: the backend modules bind the database at import.
  const bootstrap = await import('../../functions/src/platform/bootstrap');
  const { db, DATABASE_ID } = await import('../../functions/src/shared/firebase');
  if ((DATABASE_ID === '(default)' ? '(default)' : DATABASE_ID) !== target.databaseId) {
    throw new Error(`Backend bound to ${DATABASE_ID}, expected ${target.databaseId}; refusing.`);
  }

  const inventory = async () => {
    const out: Record<string, number> = {};
    for (const c of [...bootstrap.BOOTSTRAP_COLLECTIONS, ...bootstrap.CUSTOMER_COLLECTIONS]) {
      out[c] = (await db().collection(c).count().get()).data().count;
    }
    return out;
  };

  const environment = target.emulator ? 'development' : target.projectId === PRODUCTION_TARGET.projectId ? 'production' : 'staging';
  const before = await inventory();
  const actor = { uid: 'bootstrap-script', name: `${userInfo().username}@bootstrap-script`, role: 'system' };
  const result = await bootstrap.bootstrapPlatform(actor, reasonText, { dryRun: args['dry-run'] === true, environment });
  const after = await inventory();
  const customerChanges = bootstrap.CUSTOMER_COLLECTIONS.filter((c) => before[c] !== after[c]);

  const report = {
    schema: 'dsbc.directive27.bootstrapReport/v1',
    generatedAt: new Date().toISOString(),
    commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
    operator: actor.name,
    target: { ...target, environment },
    reason: reasonText,
    ...result,
    inventory: { before, after },
    customerCollectionsUnchanged: customerChanges.length === 0,
    customerCollectionsChanged: customerChanges,
    status: customerChanges.length === 0 ? 'PASS' : 'FAIL',
  };
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runBootstrap(args);
  const file = typeof args.report === 'string'
    ? resolve(args.report)
    : resolve(root, 'docs/directive-27/evidence/bootstrap', `bootstrap-${report.target.projectId}-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.dryRun ? 'DRY RUN' : 'BOOTSTRAP'} ${report.status}: created ${report.created.length}, existing ${report.existing.length}, drift ${report.drift.length} -> ${file}`);
  process.exit(report.status === 'PASS' ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
