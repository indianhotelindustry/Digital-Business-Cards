// ============================================================================
// Directive 26 Phase 12 — final certification
// ============================================================================
//   node scripts/directive26/certify.mjs           runs everything, then evaluates
//   node scripts/directive26/certify.mjs --no-run  re-evaluates the last evidence
// Writes docs/directive-26/certification.json. Every line is PASS or FAIL,
// derived from named tests in the evidence (no assumed results). The final
// status can at most be "PASS — FIRST 3-CUSTOMER DEMO READY — PRODUCTION
// DEPLOYMENT PENDING": nothing here deploys or verifies production.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FINAL = 'docs/directive-26/evidence/final';
const BROWSER = 'docs/directive-26/evidence/browser/results.json';
const MUTATION = 'docs/directive-26/evidence/mutation-testing.json';
const BASELINE = 'docs/directive-26/evidence/baseline/baseline-report.json';
const OUT = 'docs/directive-26/certification.json';
const RUN = !process.argv.includes('--no-run');

const sh = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout.trim();
const json = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : null);

if (RUN) {
  sh('node', ['scripts/directive26/baseline.mjs', FINAL]); // typecheck, builds, unit, rules, integration, backend
  sh('node', ['scripts/directive26/runBrowserTests.mjs']); // real Chrome against the production build
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------
const final = json(`${FINAL}/baseline-report.json`);
const inherited = json(BASELINE);
const tests = (name) => {
  const j = json(`${FINAL}/${name}.json`);
  if (!j) return [];
  return j.testResults.flatMap((f) => f.assertionResults.map((a) => ({ file: f.name.replace(/\\/g, '/'), name: a.fullName, status: a.status })));
};
const backend = tests('backend-authority');
const unit = tests('unit');
const rules = tests('rules-directive24');
const integration = tests('integration');
const browserRaw = json(BROWSER);
const browser = browserRaw ? browserRaw.suites.flatMap((s) => s.specs.map((sp) => ({ name: sp.title, status: sp.tests[0]?.results.at(-1)?.status }))) : [];
const mutation = json(MUTATION);

const pass = (list) => list.length > 0 && list.every((t) => t.status === 'passed');
const inFile = (file) => backend.filter((t) => t.file.endsWith(file));
const named = (list, re) => list.filter((t) => re.test(t.name));
const D25_FILES = ['authority-identity-plans.test.ts', 'authority-commercial-forgery.test.ts', 'authority-tenancy-lifecycle.test.ts', 'authority-client-webhooks-publishing.test.ts'];
const PUBLIC_IDS = Array.from({ length: 15 }, (_, i) => `PUBLIC-${String(i + 1).padStart(3, '0')}`);

const lines = [];
function line(key, title, checks) {
  const failed = checks.filter((c) => !c.ok);
  lines.push({ key, title, status: failed.length ? 'FAIL' : 'PASS', checks: checks.map((c) => ({ check: c.check, ok: !!c.ok, ...(c.detail ? { detail: c.detail } : {}) })) });
}
const count = (list) => `${list.filter((t) => t.status === 'passed').length}/${list.length}`;

const d25Backend = D25_FILES.flatMap(inFile);
line('baselineTests', 'Baseline tests (inherited 570)', [
  { check: 'Directive 24 rules', ok: pass(rules) && rules.length >= 433, detail: count(rules) },
  { check: 'integration', ok: pass(integration) && integration.length >= 6, detail: count(integration) },
  { check: 'unit (incl. updated contract test)', ok: pass(unit) && unit.length >= 46, detail: count(unit) },
  { check: 'Directive 25 backend authority (AUTH-001..025)', ok: pass(d25Backend) && d25Backend.length >= 85, detail: count(d25Backend) },
  { check: 'inherited baseline recorded before any change', ok: inherited?.status === 'PASS' && inherited.totalTests === 570, detail: inherited ? `${inherited.totalPassed}/${inherited.totalTests} @ ${inherited.commit?.slice(0, 7)}` : 'missing' },
]);
const publicFile = inFile('public-resolution.test.ts');
const pilotFile = inFile('three-customer-demo.test.ts');
line('newTests', 'New Directive 26 tests', [
  { check: 'public resolution suite (emulator)', ok: pass(publicFile), detail: count(publicFile) },
  { check: 'three-customer suite (emulator)', ok: pass(pilotFile), detail: count(pilotFile) },
  { check: 'browser suite (real Chrome, production build)', ok: pass(browser), detail: count(browser) },
]);
line('mutationTests', 'Mutation tests', [
  { check: 'every authorization mutant killed (Directive 25 + 26)', ok: !!mutation && mutation.total >= 36 && mutation.survived.length === 0, detail: mutation ? `${mutation.killed}/${mutation.total}` : 'not run' },
  { check: 'unmutated baseline passed before mutating', ok: !!mutation?.baseline?.summary && !/failed/.test(mutation.baseline.summary), detail: mutation?.baseline?.summary },
]);
line('typescript', 'TypeScript', [{ check: 'frontend + functions typecheck', ok: final?.typescript === 'PASS' }]);
line('build', 'Build', [{ check: 'production frontend + functions bundle', ok: final?.build === 'PASS' }]);
line('publicResolution', 'Public resolution', PUBLIC_IDS.map((id) => {
  const ts = named(publicFile, new RegExp(`^${id} `));
  return { check: id, ok: pass(ts), detail: count(ts) };
}));
line('crossBrowser', 'Cross-browser (A admin / B anonymous / C, E customers / D App Owner)', [
  { check: 'all browser scenarios pass', ok: pass(browser), detail: count(browser) },
  { check: 'anonymous visitor sees the real company website and card', ok: pass(named(browser, /^Browser B/)) },
]);
line('threeTenantIsolation', '3-tenant isolation', [
  { check: 'emulator 3x3 private-data matrix + public isolation', ok: pass(named(pilotFile, /Three-tenant isolation/)), detail: count(named(pilotFile, /Three-tenant isolation/)) },
  { check: 'browser: three customers never see each other', ok: pass(named(browser, /three-way isolation|never sees customer A data/)) },
]);
line('companyJourney', 'Company journey', [
  { check: 'emulator: setup → branding → services → products → publish → public URL (x3)', ok: pass(named(pilotFile, /Company journey/)) },
  { check: 'browser: registration through publication from a clean browser', ok: pass(named(browser, /company registers, builds and publishes/)) },
]);
line('employeeJourney', 'Employee journey', [
  { check: 'emulator: employee → profile → card → publish; cross-tenant attempts denied', ok: pass(named(pilotFile, /Employee journey/)) },
  { check: 'browser: admin adds and publishes an employee card; anonymous visitor opens it', ok: pass(named(browser, /adds an employee|real employee card appears/)) },
]);
line('publishing', 'Publishing', [
  { check: 'server-authoritative publishing (AUTH-024, PUBLIC-014, PUBLIC-015)', ok: pass(named(backend, /^(AUTH-024|PUBLIC-014|PUBLIC-015) /)) },
  { check: 'browser: unpublished / preview / unknown / demo URLs show nothing', ok: pass(named(browser, /unpublished, preview and unknown URLs/)) },
]);
line('demoReadiness', 'Demo readiness', [
  { check: 'emulator: readiness checks, App Owner only, diagnosis without mutation', ok: pass(named(pilotFile, /Demo readiness/)) },
  { check: 'browser: App Owner sees all three pilots DEMO READY', ok: pass(named(browser, /App Owner sees all three pilots demo ready/)) },
]);

const allPass = lines.every((l) => l.status === 'PASS');
const report = {
  schema: 'dsbc.directive26.certification/v1',
  directive: 26,
  generatedAt: new Date().toISOString(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: git('rev-parse', 'HEAD'),
  environment: 'Firebase Emulator Suite (demo-dsbc) + real Chrome against the production build. No live Firebase project was contacted; nothing was deployed.',
  finalStatus: allPass ? 'PASS — FIRST 3-CUSTOMER DEMO READY — PRODUCTION DEPLOYMENT PENDING' : 'FAIL — DIRECTIVE 26 INCOMPLETE',
  productionReady: false,
  productionReadyReason: 'Production infrastructure has not been deployed or verified (Directive 25 deployment blockers remain).',
  summary: Object.fromEntries(lines.map((l) => [l.key, l.status])),
  totals: {
    unit: count(unit),
    rulesDirective24: count(rules),
    integration: count(integration),
    backend: count(backend),
    browser: count(browser),
    mutation: mutation ? `${mutation.killed}/${mutation.total}` : 'not run',
  },
  lines,
};
writeFileSync(join(root, OUT), JSON.stringify(report, null, 2) + '\n');
console.log(report.finalStatus);
for (const l of lines) console.log(`  ${l.status.padEnd(4)} ${l.title}`);
process.exit(allPass ? 0 : 1);
