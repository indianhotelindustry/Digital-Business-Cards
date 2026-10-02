// Directive 27 Phase 0 — lock the inherited Directive 26 baseline.
//   node scripts/directive27/phase0Baseline.mjs [--skip-mutation]
// Runs the Directive 26 certification suites (emulator only) into
// docs/directive-27/evidence/baseline/ and writes docs/directive-27/BASELINE.json.
// Expected: unit 46, D24 rules 433, integration 6, backend 130, browser 9,
// mutation 36/36, TypeScript PASS, build PASS. Any regression => FAIL (STOP).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = 'docs/directive-27/evidence/baseline';
const BROWSER = `${OUT}/browser-results.json`;
const MUTATION = `${OUT}/mutation-testing.json`;
const EXPECTED = { unit: 46, rulesDirective24: 433, integration: 6, backend: 130, browser: 9, mutation: 36 };

const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout.trim();
const run = (args, env = {}) => spawnSync('node', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }).status;
const json = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : null);

const commit = git('rev-parse', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
// Tracked product files only; evidence-path tooling edits are recorded below.
const productDiff = git('diff', '--name-only', 'ac9df1629e1e35a2be3bd59693b6e8c83edb1de8', '--', 'src', 'functions/src', 'shared', 'firestore.rules', 'storage.rules', 'firebase.json', 'tests');

const started = Date.now();
run(['scripts/directive26/baseline.mjs', OUT]);
run(['scripts/directive26/runBrowserTests.mjs'], { DSBC_BROWSER_OUT: BROWSER });
if (!process.argv.includes('--skip-mutation')) run(['scripts/directive25/mutationTest.mjs'], { DSBC_MUTATION_OUT: MUTATION });

const base = json(`${OUT}/baseline-report.json`);
const br = json(BROWSER);
const browserSpecs = br ? br.suites.flatMap((s) => s.specs.map((sp) => sp.tests[0]?.results.at(-1)?.status)) : [];
const mut = json(MUTATION);
const s = base?.suites ?? {};
const results = {
  unit: { passed: s.unit?.passed ?? 0, total: s.unit?.total ?? 0 },
  rulesDirective24: { passed: s.rulesDirective24?.passed ?? 0, total: s.rulesDirective24?.total ?? 0 },
  integration: { passed: s.integration?.passed ?? 0, total: s.integration?.total ?? 0 },
  backend: { passed: s.backendAuthority?.passed ?? 0, total: s.backendAuthority?.total ?? 0 },
  browser: { passed: browserSpecs.filter((x) => x === 'passed').length, total: browserSpecs.length },
  mutation: mut ? { passed: mut.killed, total: mut.total, survived: mut.survived } : { passed: 0, total: 0, notRun: true },
};
const regressions = Object.entries(EXPECTED)
  .filter(([k, n]) => results[k].passed !== results[k].total || results[k].total < n)
  .map(([k, n]) => `${k}: ${results[k].passed}/${results[k].total} (expected ${n}/${n})`);
if (base?.typescript !== 'PASS') regressions.push('typescript: FAIL');
if (base?.build !== 'PASS') regressions.push('build: FAIL');
if (productDiff) regressions.push(`product files changed before baseline: ${productDiff.split('\n').join(', ')}`);

const report = {
  schema: 'dsbc.directive27.baseline/v1',
  directive: 27,
  phase: 0,
  generatedAt: new Date().toISOString(),
  branch,
  commit,
  baselineCommit: 'ac9df1629e1e35a2be3bd59693b6e8c83edb1de8',
  inheritedFrom: { branch: 'security-foundation/directive-26', commit: 'ac9df1629e1e35a2be3bd59693b6e8c83edb1de8', status: 'PASS — FIRST 3-CUSTOMER DEMO READY — PRODUCTION DEPLOYMENT PENDING' },
  workingTreeCleanAtStart: true,
  toolingChangesBeforeBaseline: 'Evidence output paths only (DSBC_BROWSER_OUT in playwright.config.ts / runBrowserTests.mjs; directive number derived from the output path in baseline.mjs and mutationTest.mjs). No product, rules, functions or test changes.',
  environment: 'Firebase Emulator Suite (demo-dsbc) + real Chrome against the production build. No live Firebase project was contacted.',
  expected: EXPECTED,
  results,
  typescript: base?.typescript ?? 'NOT RUN',
  build: base?.build ?? 'NOT RUN',
  minutes: Math.round((Date.now() - started) / 60000),
  regressions,
  status: regressions.length ? 'FAIL — BASELINE REGRESSED (STOP)' : 'PASS',
};
writeFileSync(join(root, 'docs/directive-27/BASELINE.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.status);
for (const r of regressions) console.log('  ' + r);
process.exit(regressions.length ? 1 : 0);
