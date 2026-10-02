// ============================================================================
// Directive 27 Phase 7 — mutation testing of the production-infrastructure controls
// ============================================================================
// Each mutant applies ONE deliberate weakening (environment authority,
// production config, routing, platform health, bootstrap, migration, rules)
// and runs the suite that is supposed to notice it. A surviving mutant means
// that control could regress silently.
//
//   node scripts/directive27/mutationTest.mjs [MUTANT_ID ...]
//
// Crash safety (session 1 of Directive 27 crashed mid-run and left a mutant
// in the source tree):
//   * a manifest (.mutation-backup/<id>.json: file + original text) is written
//     BEFORE a file is mutated and removed only after the restore is verified;
//   * on start, a leftover manifest stops the run and prints how to restore;
//   * SIGINT / SIGTERM / uncaught errors restore the file before exiting.
// Emulator / local only: no runner can reach a real Firebase project.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, process.env.DSBC_MUTATION_OUT || 'docs/directive-27/evidence/mutation-testing.json');
const BACKUP_DIR = join(root, 'docs/directive-27/evidence/.mutation-backup');
const bin = join(root, 'node_modules', '.bin');
const ENV = {
  ...process.env,
  PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '120',
};

const T = {
  env: 'tests/unit/environment.test.ts',
  routes: 'tests/unit/routes.test.ts',
  ops: 'tests/integration/productionOps.test.ts',
  rules: 'tests/rules/directive27-platform.test.ts',
  health: 'tests/backend/platform-health.test.ts',
};

/** runner: unit | integration | rules | backend. find must occur exactly once (after CRLF -> LF). */
const MUTANTS = [
  // ---- Phase 1: environment authority (client) ------------------------------------------------
  { id: 'E01', area: 'environment', runner: 'unit', file: 'src/lib/environmentResolver.ts', desc: 'an undesignated target (staging) is accepted',
    find: "  if (target.configured !== true) fail(`The ${key} target is not designated: ${target.notConfiguredReason || 'configured is not true'}.`);", replace: '  /* mutant: undesignated accepted */', tests: [T.env] },
  { id: 'E02', area: 'environment', runner: 'unit', file: 'src/lib/environmentResolver.ts', desc: 'production may be pointed at the emulators by a build flag',
    find: "  if (input.VITE_DSBC_USE_EMULATORS === 'true' && !useEmulators) fail(`${key} may not be pointed at the emulators.`);", replace: '  /* mutant: emulator override accepted */', tests: [T.env] },
  { id: 'E03', area: 'environment', runner: 'unit', file: 'src/lib/environmentResolver.ts', desc: 'production may use the (default) database',
    find: `    if (dbId === '(default)') fail('production must name its Firestore database explicitly; "(default)" is not the DSBC database.');`, replace: '    /* mutant: default db accepted */', tests: [T.env] },
  { id: 'E04', area: 'environment', runner: 'unit', file: 'src/lib/environmentResolver.ts', desc: 'production may allow demo data / personas / dev tools',
    find: '    if (allow.demoData || allow.mockPersonas || allow.developmentTools || allow.securityTestRunner) {', replace: '    if (false) {', tests: [T.env] },
  { id: 'E05', area: 'environment', runner: 'unit', file: 'src/lib/environmentResolver.ts', desc: 'a missing VITE_DSBC_ENV silently means production',
    find: '  const raw = input.VITE_DSBC_ENV;', replace: "  const raw = input.VITE_DSBC_ENV || 'production';", tests: [T.env] },
  { id: 'E06', area: 'environment', runner: 'unit', file: 'src/lib/environment.ts', desc: 'the environment can be overridden from localStorage',
    find: '    VITE_DSBC_ENV: import.meta.env?.VITE_DSBC_ENV,', replace: "    VITE_DSBC_ENV: globalThis.localStorage?.getItem('dsbc_env') || import.meta.env?.VITE_DSBC_ENV,", tests: [T.env] },
  { id: 'E07', area: 'environment', runner: 'unit', file: 'src/lib/firebase.ts', desc: 'the client hard-codes the live project instead of the resolved target',
    find: 'const app = !getApps().length ? initializeApp({ ...env.firebase }) : getApp();', replace: "const app = !getApps().length ? initializeApp({ ...env.firebase, projectId: 'v-nexus-lite' }) : getApp();", tests: [T.env] },
  // ---- Phase 1: environment authority (backend) -------------------------------------------------
  { id: 'E08', area: 'environment', runner: 'unit', file: 'functions/src/shared/environment.ts', desc: 'backend accepts the wrong Firestore database',
    find: '      if (databaseId !== norm(t.firestoreDatabaseId)) problems.push(', replace: '      if (false) problems.push(', tests: [T.env] },
  { id: 'E09', area: 'environment', runner: 'unit', file: 'functions/src/shared/environment.ts', desc: 'backend accepts the wrong project',
    find: '      else if (projectId !== t.firebase?.projectId) problems.push(', replace: '      else if (false) problems.push(', tests: [T.env] },
  { id: 'E10', area: 'environment', runner: 'unit', file: 'functions/src/shared/environment.ts', desc: 'backend accepts the wrong region',
    find: '      else if (region !== t.functionsRegion) problems.push(', replace: '      else if (false) problems.push(', tests: [T.env] },
  { id: 'E11', area: 'environment', runner: 'unit', file: 'functions/src/shared/environment.ts', desc: 'backend accepts PAYMENTS_ENABLED=true for a payments-disabled target',
    find: "      if (t.payments === 'disabled' && env.PAYMENTS_ENABLED === 'true') problems.push(", replace: '      if (false) problems.push(', tests: [T.env] },
  { id: 'E12', area: 'environment', runner: 'unit', file: 'functions/src/index.ts', desc: 'backend loads without asserting its target',
    find: 'const BACKEND_ENV = assertBackendEnvironment();', replace: 'const BACKEND_ENV = evaluateBackendEnvironment();', tests: [T.env] },
  // ---- Phase 5: public routing -------------------------------------------------------------------
  { id: 'P01', area: 'routing', runner: 'unit', file: 'src/lib/routes.ts', desc: 'any text accepted as a slug (traversal, separators)',
    find: 'const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;', replace: 'const SLUG = /^.+$/;', tests: [T.routes] },
  { id: 'P02', area: 'routing', runner: 'unit', file: 'src/lib/routes.ts', desc: 'unknown paths fall back to the home page instead of NOT_FOUND',
    find: "  return { kind: 'not_found', path: `/${pathPart.replace(/^\\/+/, '')}` };", replace: "  return { kind: 'home' };", tests: [T.routes] },
  { id: 'P03', area: 'routing', runner: 'unit', file: 'src/lib/routes.ts', desc: 'any preview parameter value turns preview on',
    find: "  const preview = new URLSearchParams(query).get('preview') === 'true';", replace: "  const preview = new URLSearchParams(query).has('preview');", tests: [T.routes] },
  { id: 'P04', area: 'routing', runner: 'unit', file: 'firebase.production.json', desc: 'hosting catch-all rewrite (unknown paths answer 200)',
    find: '      "rewrites": [\n', replace: '      "rewrites": [\n        { "source": "**", "destination": "/index.html" },\n', tests: [T.routes, T.env] },
  // ---- Phase 4: platform health ---------------------------------------------------------------------
  { id: 'H01', area: 'health', runner: 'unit', file: 'shared/domain/platformHealth.ts', desc: 'a report missing required checks can be OK',
    find: "  if (PLATFORM_HEALTH_CHECKS.some((id) => ids.filter((x) => x === id).length !== 1)) return 'FAIL';", replace: '  /* mutant: completeness not checked */', tests: [T.routes] },
  { id: 'H02', area: 'health', runner: 'unit', file: 'shared/domain/platformHealth.ts', desc: 'NOT_VERIFIED / NOT_CONFIGURED count as healthy',
    find: "  return checks.every((c) => c.state === 'OK' || c.state === 'DISABLED') ? 'OK' : 'DEGRADED';", replace: "  return checks.every((c) => c.state !== 'FAIL') ? 'OK' : 'DEGRADED';", tests: [T.routes] },
  { id: 'H03', area: 'health', runner: 'unit', file: 'functions/src/platform/health.ts', desc: 'ENVIRONMENT check reports OK for a mismatched backend',
    find: "  if (!env.ok || env.problems.length) return { state: 'FAIL',", replace: "  if (false) return { state: 'FAIL',", tests: [T.routes] },
  { id: 'H04', area: 'health', runner: 'backend', file: 'functions/src/platform/health.ts', desc: 'platform health callable without the App Owner gate',
    find: '  requireAppOwner(caller);\n  obj(data ?? {}, []);\n  return measurePlatformHealth(caller, ctx);', replace: '  obj(data ?? {}, []);\n  return measurePlatformHealth(caller, ctx);', tests: [T.health] },
  { id: 'H05', area: 'health', runner: 'backend', file: 'functions/src/platform/health.ts', desc: 'an undesignated public URL is reported OK',
    find: "      if (!env.publicOrigin) return { state: 'NOT_CONFIGURED',", replace: "      if (!env.publicOrigin) return { state: 'OK',", tests: [T.health] },
  { id: 'H06', area: 'health', runner: 'backend', file: 'functions/src/platform/health.ts', desc: 'claim holders without a verified email counted as App Owners',
    find: '          if (u.emailVerified && !u.disabled) owners.push(u.uid);\n          else unverified.push(u.uid);', replace: '          owners.push(u.uid);', tests: [T.health] },
  { id: 'H07', area: 'health', runner: 'backend', file: 'functions/src/platform/health.ts', desc: 'an un-bootstrapped control plane reported OK',
    find: "        return { state: 'FAIL', detail: 'Control plane not bootstrapped", replace: "        return { state: 'OK', detail: 'Control plane not bootstrapped", tests: [T.health] },
  { id: 'H08', area: 'health', runner: 'backend', file: 'functions/src/subscriptions/service.ts', desc: 'the reconciler no longer records its runs',
    find: "  await db().collection('platformConfig').doc('reconciliation').set({\n    lastRunAt: serverNow(), examined: all.size, changed: changed.length, actor: actor.uid,\n  });", replace: '  /* mutant: no heartbeat */', tests: [T.health] },
  // ---- Phase 2: production bootstrap ----------------------------------------------------------------
  { id: 'B01', area: 'bootstrap', runner: 'integration', file: 'functions/src/platform/bootstrap.ts', desc: 'a dry run writes',
    find: '  if (opts.dryRun) {', replace: '  if (false) {', tests: [T.ops] },
  { id: 'B02', area: 'bootstrap', runner: 'integration', file: 'functions/src/platform/bootstrap.ts', desc: 'platform configuration is overwritten on every run',
    find: '    if (snap.exists) return false;\n    tx.create(cfgRef, {', replace: '    tx.set(cfgRef, {', tests: [T.ops] },
  { id: 'B03', area: 'bootstrap', runner: 'integration', file: 'functions/src/entitlements/admin.ts', desc: 'existing plans (App Owner pricing) are overwritten',
    find: '    planSnaps.forEach((s, i) => {\n      if (s.exists) return;\n      const { createdAt, updatedAt, ...plan } = INITIAL_PLANS[i];\n      tx.create(s.ref,', replace: '    planSnaps.forEach((s, i) => {\n      const { createdAt, updatedAt, ...plan } = INITIAL_PLANS[i];\n      tx.set(s.ref,', tests: [T.ops] },
  { id: 'B04', area: 'bootstrap', runner: 'integration', file: 'functions/src/platform/bootstrap.ts', desc: 'the bootstrap seeds a demo company',
    find: '  const allCreated = [...created, ...(cfgCreated ? [cfgRef.path] : [])];', replace: "  await firestore.collection('companies').doc('company_acme').set({ name: 'Acme Innovations' });\n  const allCreated = [...created, ...(cfgCreated ? [cfgRef.path] : [])];", tests: [T.ops] },
  // ---- Phase 3: existing-customer migration ---------------------------------------------------------
  { id: 'G01', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'a stale preview (data changed) is still executed',
    find: '  if (approval.previewHash !== preview.previewHash) {', replace: '  if (false) {', tests: [T.ops] },
  { id: 'G02', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'any account may approve a migration',
    find: "  if (approver.customClaims?.[APP_OWNER_CLAIM] !== 'app_owner' || !approver.emailVerified || approver.disabled) {", replace: '  if (false) {', tests: [T.ops] },
  { id: 'G03', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'demo candidates may be migrated',
    find: "    if (c.flags.includes('DEMO_CANDIDATE')) throw new MigrationRefused(", replace: '    if (false) throw new MigrationRefused(', tests: [T.ops] },
  { id: 'G04', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'complimentary grants without evidence',
    find: '      if (!d.evidence || d.evidence.trim().length < 8) throw', replace: '      if (false) throw', tests: [T.ops] },
  { id: 'G05', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'existing subscriptions may be overwritten',
    find: '    if (c.subscription.existing) throw new MigrationRefused(', replace: '    if (false) throw new MigrationRefused(', tests: [T.ops] },
  { id: 'G06', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'a migration run id can be replayed',
    find: "    await ref.create({ runId, status: 'RUNNING',", replace: "    await ref.set({ runId, status: 'RUNNING',", tests: [T.ops] },
  { id: 'G07', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'a legacy browser-assigned paid plan is mapped without an owner decision',
    find: "  } else if (flags.includes('LEGACY_PAID_PLAN_CLAIM')) {", replace: '  } else if (false) {', tests: [T.ops] },
  { id: 'G08', area: 'migration', runner: 'integration', file: 'functions/src/platform/migration.ts', desc: 'a complimentary grant may use a plan of the wrong customer type',
    find: "      if (!plan.exists || plan.get('targetType') !== c.customerType) throw", replace: '      if (!plan.exists) throw', tests: [T.ops] },
  // ---- firestore.rules ---------------------------------------------------------------------------------
  { id: 'R10', area: 'rules', runner: 'rules', file: 'firestore.rules', desc: 'the App Owner browser may write platform configuration',
    find: '    match /platformConfig/{configId} {\n      allow read: if isAppOwner();\n      allow write: if false;', replace: '    match /platformConfig/{configId} {\n      allow read: if isAppOwner();\n      allow write: if isAppOwner();', tests: [T.rules] },
  { id: 'R11', area: 'rules', runner: 'rules', file: 'firestore.rules', desc: 'migration runs readable by any signed-in user',
    find: '    match /migrationRuns/{runId} {\n      allow read: if isAppOwner();', replace: '    match /migrationRuns/{runId} {\n      allow read: if request.auth != null;', tests: [T.rules] },
];

const read = (rel) => readFileSync(join(root, rel), 'utf8');

function runTests(runner, files) {
  const started = Date.now();
  const vitest = (config) => `vitest run --config ${config} ${files.join(' ')}`;
  const cmd = {
    unit: ['npx', ['vitest', 'run', ...files]],
    integration: ['firebase', ['emulators:exec', '--only', 'auth,firestore', '--project', 'demo-dsbc', `"${vitest('vitest.integration.config.ts')}"`]],
    rules: ['firebase', ['emulators:exec', '--only', 'firestore', '--project', 'demo-dsbc', `"${vitest('vitest.rules.config.ts')}"`]],
    backend: ['node', ['scripts/directive25/runBackendTests.mjs', ...files]],
  }[runner];
  const r = spawnSync(cmd[0], cmd[1], { cwd: root, env: ENV, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout}\n${r.stderr}`.replace(/\u001b\[[0-9;]*m/g, '');
  const summary = out.match(/^\s*Tests\s+\d+[^\n]*\(\d+\)\s*$/gm)?.pop()?.trim() ?? 'no summary';
  const failed = [...out.matchAll(/(?:FAIL|×)\s+(tests\/\S+ > [^\n]+)/g)].map((x) => x[1].trim());
  return { exitCode: r.status, summary, failed: [...new Set(failed)].slice(0, 8), seconds: Math.round((Date.now() - started) / 1000) };
}

// ---- crash-safe apply / restore -------------------------------------------------------------------
let active = null; // { id, file, original }

function restoreActive() {
  if (!active) return;
  writeFileSync(join(root, active.file), active.original);
  if (read(active.file) !== active.original) throw new Error(`${active.id}: failed to restore ${active.file}; manifest kept in ${BACKUP_DIR}`);
  rmSync(join(BACKUP_DIR, `${active.id}.json`), { force: true });
  active = null;
}

function applyMutant(m) {
  const original = read(m.file);
  const text = original.replace(/\r\n/g, '\n');
  const count = text.split(m.find).length - 1;
  if (count !== 1) throw new Error(`${m.id}: expected exactly one match in ${m.file}, found ${count}`);
  writeFileSync(join(BACKUP_DIR, `${m.id}.json`), JSON.stringify({ id: m.id, file: m.file, original }));
  active = { id: m.id, file: m.file, original };
  const mutated = text.replace(m.find, m.replace);
  writeFileSync(join(root, m.file), original.includes('\r\n') ? mutated.replace(/\n/g, '\r\n') : mutated);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      restoreActive();
    } finally {
      process.exit(130);
    }
  });
}
process.on('uncaughtException', (err) => {
  try {
    restoreActive();
  } finally {
    console.error(err);
    process.exit(1);
  }
});

// ---- main ---------------------------------------------------------------------------------------------
mkdirSync(BACKUP_DIR, { recursive: true });
const leftovers = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
if (leftovers.length) {
  console.error(`A previous mutation run did not finish. Restore before running again:\n${leftovers.map((f) => `  ${f}: file ${JSON.parse(readFileSync(join(BACKUP_DIR, f), 'utf8')).file}`).join('\n')}\n` +
    'Each manifest holds { file, original }; write "original" back to "file", verify, then delete the manifest.');
  process.exit(2);
}

const only = process.argv.slice(2);
const selected = only.length ? MUTANTS.filter((m) => only.includes(m.id)) : MUTANTS;
for (const m of selected) {
  const count = read(m.file).replace(/\r\n/g, '\n').split(m.find).length - 1;
  if (count !== 1) throw new Error(`${m.id}: expected exactly one match in ${m.file}, found ${count}`);
}

// Baseline: every runner used must pass on the unmutated tree.
const runners = [...new Set(selected.map((m) => m.runner))];
const baseline = {};
for (const runner of runners) {
  const files = [...new Set(selected.filter((m) => m.runner === runner).flatMap((m) => m.tests))];
  console.log(`baseline ${runner}: ${files.join(', ')}`);
  baseline[runner] = runTests(runner, files);
  console.log(`  ${baseline[runner].summary} (${baseline[runner].seconds}s)`);
  if (baseline[runner].exitCode !== 0) {
    console.error(`Baseline ${runner} failed; mutation results would be meaningless.`, baseline[runner]);
    process.exit(1);
  }
}

const results = [];
for (const m of selected) {
  try {
    applyMutant(m);
    console.log(`${m.id} [${m.runner}] ${m.desc} …`);
    const run = runTests(m.runner, m.tests);
    const killed = run.exitCode !== 0;
    results.push({ id: m.id, area: m.area, runner: m.runner, file: m.file, mutation: m.desc, killed, testFiles: m.tests, ...run });
    console.log(`  ${killed ? 'KILLED' : 'SURVIVED'} (${run.summary}, ${run.seconds}s)`);
  } finally {
    restoreActive();
  }
}
rmSync(BACKUP_DIR, { recursive: true, force: true });
// Rebuild the unmutated backend so functions/lib matches source again.
spawnSync('npm', ['--prefix', 'functions', 'run', 'build'], { cwd: root, env: ENV, shell: process.platform === 'win32', stdio: 'ignore' });

const report = {
  schema: 'dsbc.mutationTesting/v1',
  directive: 27,
  generatedAt: new Date().toISOString(),
  environment: 'Local: vitest (unit), Firebase Emulator Suite demo-dsbc (integration, rules, backend)',
  baseline,
  summary: { total: results.length, killed: results.filter((r) => r.killed).length, survived: results.filter((r) => !r.killed).map((r) => r.id) },
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`\nMutation testing: ${report.summary.killed}/${report.summary.total} killed${report.summary.survived.length ? `; SURVIVED: ${report.summary.survived.join(', ')}` : ''} -> ${OUT}`);
process.exit(report.summary.survived.length ? 1 : 0);
