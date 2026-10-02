// Directive 26 Phase 0 — record the inherited baseline before any change.
//   node scripts/directive26/baseline.mjs [outDir]
// Runs typechecks, builds and every suite (emulator only) with JSON reporters
// and writes <outDir>/baseline-report.json. Exit code 0 only if all pass.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outRel = (process.argv[2] || 'docs/directive-26/evidence/baseline').split('\\').join('/');
const out = join(root, outRel);
mkdirSync(out, { recursive: true });
const bin = join(root, 'node_modules', '.bin');
const env = { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, FUNCTIONS_DISCOVERY_TIMEOUT: '120' };
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024 });
const git = (...a) => sh('git', a).stdout.trim();
const json = (name) => ['--reporter=dot', '--reporter=json', `--outputFile.json=${outRel}/${name}.json`];

const steps = {};
function step(name, cmd, args) {
  const t = Date.now();
  const r = sh(cmd, args);
  writeFileSync(join(out, `${name}.log`), `${r.stdout}\n${r.stderr}`.replace(/\u001b\[[0-9;]*m/g, ''));
  steps[name] = { exitCode: r.status, seconds: Math.round((Date.now() - t) / 1000) };
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'} ${name}`);
}
const startCommit = git('rev-parse', 'HEAD');
const startClean = git('status', '--porcelain') === '';
step('typescript-frontend', 'node', ['node_modules/typescript/bin/tsc', '--noEmit']);
step('typescript-functions', 'npm', ['--prefix', 'functions', 'run', 'typecheck']);
step('build-functions', 'npm', ['--prefix', 'functions', 'run', 'build']);
step('build-frontend', 'npx', ['vite', 'build']);
step('unit', 'npx', ['vitest', 'run', ...json('unit')]);
step('rules-directive24', 'firebase', ['emulators:exec', '--only', 'firestore', '--project', 'demo-dsbc', `"vitest run --config vitest.rules.config.ts ${json('rules-directive24').join(' ')}"`]);
step('integration', 'firebase', ['emulators:exec', '--only', 'auth,firestore', '--project', 'demo-dsbc', `"vitest run --config vitest.integration.config.ts ${json('integration').join(' ')}"`]);
step('backend-authority', 'node', ['scripts/directive25/runBackendTests.mjs', ...json('backend-authority')]);

const count = (name) => {
  const p = join(out, `${name}.json`);
  if (!existsSync(p)) return { passed: 0, total: 0, success: false };
  const j = JSON.parse(readFileSync(p, 'utf8'));
  return { passed: j.numPassedTests, failed: j.numFailedTests, total: j.numTotalTests, success: j.success && j.numFailedTests === 0 };
};
const suites = { unit: count('unit'), rulesDirective24: count('rules-directive24'), integration: count('integration'), backendAuthority: count('backend-authority') };
const all = Object.values(steps).every((s) => s.exitCode === 0) && Object.values(suites).every((s) => s.success);
const report = {
  schema: 'dsbc.baseline/v1',
  directive: 26,
  generatedAt: new Date().toISOString(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: startCommit,
  workingTreeCleanAtStart: startClean,
  environment: 'Firebase Emulator Suite only (demo-dsbc)',
  typescript: steps['typescript-frontend'].exitCode === 0 && steps['typescript-functions'].exitCode === 0 ? 'PASS' : 'FAIL',
  build: steps['build-frontend'].exitCode === 0 && steps['build-functions'].exitCode === 0 ? 'PASS' : 'FAIL',
  suites,
  totalPassed: Object.values(suites).reduce((n, s) => n + s.passed, 0),
  totalTests: Object.values(suites).reduce((n, s) => n + s.total, 0),
  steps,
  status: all ? 'PASS' : 'FAIL',
};
writeFileSync(join(out, 'baseline-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.status}: ${report.totalPassed}/${report.totalTests}`);
process.exit(all ? 0 : 1);
