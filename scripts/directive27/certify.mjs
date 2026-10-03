// ============================================================================
// Directive 27 Phase 8 — deployment gate certification
// ============================================================================
//   node scripts/directive27/certify.mjs           runs everything, then evaluates
//   node scripts/directive27/certify.mjs --no-run  re-evaluates the last evidence
// Writes docs/directive-27/certification.json. Every line is PASS or FAIL and
// is derived from named tests in the evidence. Readiness is reported on five
// separate levels (overnight directive Phase 13), never collapsed into one:
//   1 Demo Ready               PASS | FAIL   emulator + real Chrome evidence
//   2 Deployment Ready         PASS | BLOCKED | FAIL   owner designations and
//                              live-target prerequisites (measured by liveProbe.mjs)
//   3 Live Deployment Complete PASS | NOT COMPLETE | NOT VERIFIED   rules,
//                              functions, hosting, control plane live at HEAD
//   4 Live Acceptance Passed   PASS | FAIL | NOT EXECUTED | NOT VERIFIED   three
//                              customers on the real public URLs + live Platform Health
//   5 Production Certified     PASS only if 1-4 pass and no blocker remains
// Live levels come only from docs/overnight/evidence/live-probe.json, written by
// scripts/directive27/liveProbe.mjs (read-only) at THIS commit; older or missing
// evidence is NOT VERIFIED. This script deploys nothing and contacts no real
// Firebase project.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FINAL = 'docs/directive-27/evidence/final';
const BROWSER = 'docs/directive-27/evidence/browser/results.json';
const MUTATION = 'docs/directive-27/evidence/mutation-testing.json';
const BASELINE = 'docs/directive-27/evidence/baseline/baseline-report.json';
const PREFLIGHT = 'docs/directive-27/evidence/preflight.json';
const SECRETS = 'docs/directive-27/evidence/secrets-audit.json';
const LIVE_PROBE = 'docs/overnight/evidence/live-probe.json';
const OUT = 'docs/directive-27/certification.json';
const RUN = !process.argv.includes('--no-run');

const sh = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout.trim();
const json = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), 'utf8')) : null);

if (RUN) {
  sh('node', ['scripts/directive26/baseline.mjs', FINAL]); // typecheck, builds (production bundle), unit, rules, integration, backend
  sh('npx', ['tsx', 'scripts/directive27/preflight.ts']); // against the production bundle just built
  sh('node', ['scripts/directive27/secretsAudit.mjs', '--bundle', 'dist']);
  sh('node', ['scripts/directive26/runBrowserTests.mjs'], { DSBC_BROWSER_OUT: BROWSER }); // D26 + D27 specs in real Chrome
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
const unit = tests('unit');
const rules = tests('rules-directive24');
const integration = tests('integration');
const backend = tests('backend-authority');
const browserRaw = json(BROWSER);
const browser = [];
(function walk(s, file) {
  for (const sp of s.specs ?? []) browser.push({ file: sp.file ?? file, name: sp.title, status: sp.tests[0]?.results.at(-1)?.status });
  for (const c of s.suites ?? []) walk(c, c.file ?? file);
})({ suites: browserRaw?.suites ?? [] });
const mutation = json(MUTATION);
const preflight = json(PREFLIGHT);
const secrets = json(SECRETS);

const pass = (list) => list.length > 0 && list.every((t) => t.status === 'passed');
const count = (list) => `${list.filter((t) => t.status === 'passed').length}/${list.length}`;
const inFile = (list, file) => list.filter((t) => t.file.endsWith(file));
const ids = (list, prefix, n, from = 1) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i + from).padStart(3, '0')}`).map((id) => {
    const ts = list.filter((t) => t.name.includes(`${id} `));
    return { check: id, ok: pass(ts), detail: count(ts) };
  });

const lines = [];
function line(key, title, checks) {
  const failed = checks.filter((c) => !c.ok);
  lines.push({ key, title, status: failed.length ? 'FAIL' : 'PASS', checks: checks.map((c) => ({ check: c.check, ok: !!c.ok, ...(c.detail ? { detail: c.detail } : {}) })) });
}

const D25_FILES = ['authority-identity-plans.test.ts', 'authority-commercial-forgery.test.ts', 'authority-tenancy-lifecycle.test.ts', 'authority-client-webhooks-publishing.test.ts'];
const d25 = D25_FILES.flatMap((f) => inFile(backend, f));
const d24Rules = rules.filter((t) => !t.file.endsWith('directive27-platform.test.ts'));
const d27Rules = inFile(rules, 'directive27-platform.test.ts');
const d26Browser = inFile(browser, 'demo-journey.spec.ts');
const reh = inFile(browser, 'production-rehearsal.spec.ts');
const rehNamed = (re) => reh.filter((t) => re.test(t.name));
const ops = inFile(integration, 'productionOps.test.ts');
const healthBackend = inFile(backend, 'platform-health.test.ts');

line('regression', 'No regression of Directives 24–26', [
  { check: 'inherited D27 Phase 0 baseline recorded (615/615)', ok: inherited?.totalTests === 615 && inherited.totalPassed === 615, detail: inherited ? `${inherited.totalPassed}/${inherited.totalTests} @ ${inherited.commit?.slice(0, 7)}` : 'missing' },
  { check: 'Directive 24 rules', ok: pass(d24Rules) && d24Rules.length >= 433, detail: count(d24Rules) },
  { check: 'Directive 25 backend authority', ok: pass(d25) && d25.length >= 85, detail: count(d25) },
  { check: 'Directive 26 public resolution + three-customer (emulator)', ok: pass(inFile(backend, 'public-resolution.test.ts')) && pass(inFile(backend, 'three-customer-demo.test.ts')), detail: `${count(inFile(backend, 'public-resolution.test.ts'))}, ${count(inFile(backend, 'three-customer-demo.test.ts'))}` },
  { check: 'Directive 26 browser journey (real Chrome)', ok: pass(d26Browser) && d26Browser.length >= 9, detail: count(d26Browser) },
  { check: 'pre-D27 integration (App Owner, demo seed)', ok: pass(inFile(integration, 'adminScripts.test.ts')), detail: count(inFile(integration, 'adminScripts.test.ts')) },
]);
line('environment', 'Phase 1 — environment authority', ids(unit, 'ENV', 16));
line('productionConfig', 'Phase 1 — production configuration', [
  { check: 'preflight has no FAIL', ok: !!preflight && preflight.counts.fail === 0, detail: preflight ? `${preflight.status} (${preflight.counts.pass} pass, ${preflight.counts.fail} fail, ${preflight.counts.blocked} blocked)` : 'not run' },
  { check: 'no secret in source or production bundle', ok: secrets?.source?.verdict === 'PASS' && secrets?.clientBundles?.verdict === 'PASS' && secrets?.serverSecrets?.verdict === 'PASS', detail: secrets ? `source ${secrets.source.verdict}, bundles ${secrets.clientBundles.verdict}, history ${secrets.gitHistory.verdict}` : 'not run' },
]);
line('bootstrap', 'Phase 2 — production bootstrap', [...ids(ops, 'BOOT', 6), { check: 'D27 rules: platform config Admin-SDK only', ok: pass(d27Rules), detail: count(d27Rules) }]);
line('migration', 'Phase 3 — existing-customer migration', ids(ops, 'MIG', 7));
line('platformHealth', 'Phase 4 — platform health (measured, fail closed)', [...ids(unit, 'HEALTH', 4), ...ids(healthBackend, 'HEALTH', 4, 101), { check: 'browser: App Owner sees measured health, no fake readiness', ok: pass(rehNamed(/^REH-OWNER/)) }]);
line('publicRouting', 'Phase 5 — public production routing', [
  ...ids(unit, 'ROUTE', 7),
  { check: 'server-authoritative resolver PUBLIC-001..015', ok: ids(backend, 'PUBLIC', 15).every((c) => c.ok) },
  { check: 'clean-browser /card /profile /company, isolation, no demo', ok: pass(rehNamed(/^REH-PUBLIC/)) },
  { check: 'canonical navigation + history', ok: pass(rehNamed(/^REH-NAV/)) },
  { check: 'unpublished hidden; ?preview=true no bypass', ok: pass(rehNamed(/^REH-UNPUBLISH/)) },
  { check: '404 for unknown slugs and paths', ok: pass(rehNamed(/^REH-404/)) },
  { check: 'legacy hash links rewritten', ok: pass(rehNamed(/^REH-LEGACY/)) },
]);
line('rehearsal', 'Phase 6 — three-customer production-like rehearsal', [
  ...['R1', 'R2', 'R3'].map((k) => ({ check: `customer ${k}: register → company → employee → card + website published`, ok: pass(rehNamed(new RegExp(`^REH-${k}:`))) })),
  { check: 'employees, cards and records belong to their own company', ok: pass(rehNamed(/^REH-SERVER/)) },
  { check: 'data survives reload and a new browser', ok: pass(rehNamed(/^REH-PERSIST/)) },
  { check: 'App Owner sees all three correctly', ok: pass(rehNamed(/^REH-OWNER/)) },
  { check: 'all rehearsal scenarios', ok: pass(reh) && reh.length >= 11, detail: count(reh) },
]);
line('mutation', 'Phase 7 — mutation testing', [
  { check: 'every D27 mutant killed', ok: !!mutation && mutation.summary.total >= 43 && mutation.summary.survived.length === 0, detail: mutation ? `${mutation.summary.killed}/${mutation.summary.total}` : 'not run' },
  { check: 'unmutated baselines passed first', ok: !!mutation && Object.values(mutation.baseline).every((b) => b.exitCode === 0) },
]);
line('typescript', 'TypeScript', [{ check: 'frontend + functions typecheck', ok: final?.typescript === 'PASS' }]);
line('build', 'Build', [{ check: 'production frontend + functions bundle', ok: final?.build === 'PASS' }]);

const allPass = lines.every((l) => l.status === 'PASS');

// ---------------------------------------------------------------------------
// Readiness levels
// ---------------------------------------------------------------------------
const head = git('rev-parse', 'HEAD');
const probe = json(LIVE_PROBE);
// Evidence measured at another commit says nothing about this one, unless
// everything committed since then is documentation/evidence (docs/ only).
const changedSinceProbe = probe ? spawnSync('git', ['diff', '--name-only', probe.commit, head], { cwd: root, encoding: 'utf8' }) : null;
const probeCurrent = !!probe && changedSinceProbe.status === 0 &&
  changedSinceProbe.stdout.split(/\r?\n/).filter(Boolean).every((f) => f.startsWith('docs/'));
const NOT_PREREQUISITE = ['FIRESTORE_RULES_DEPLOYED', 'FUNCTIONS_DEPLOYED', 'HOSTING_DEPLOYED', 'CONTROL_PLANE_BOOTSTRAPPED', 'LIVE_PLATFORM_HEALTH', 'LIVE_ACCEPTANCE'];
const liveBlocked = probeCurrent ? probe.checks.filter((c) => ['BLOCKED', 'FAIL'].includes(c.status) && !NOT_PREREQUISITE.includes(c.id)) : [];
const deploymentBlockers = [
  ...(preflight?.checks ?? []).filter((c) => c.status === 'BLOCKED').map((c) => `${c.id}: ${c.detail}`),
  ...(probeCurrent
    ? liveBlocked.map((c) => `LIVE_${c.id}: ${c.detail}`)
    : [`LIVE_PROBE_NOT_VERIFIED: ${probe ? `${LIVE_PROBE} was measured at ${probe.commit.slice(0, 7)}, and code changed before HEAD ${head.slice(0, 7)}` : `${LIVE_PROBE} is missing`}; run node scripts/directive27/liveProbe.mjs (read-only).`]),
  'APP_OWNER_ON_LIVE: no App Owner claim has been granted/verified on v-nexus-lite; the owner must designate the identity (runbook: grant right after the rules deploy, then setAppOwner.ts --verify).',
  'MIGRATION_DECISION: live discovery found only legacy demo-candidate companies (docs/overnight/evidence/migration-discovery-summary.json); the App Owner records SKIP for each (nothing migrated, nothing deleted).',
  'STORAGE_BUCKET_OWNERSHIP: deploying storage.rules replaces the rules of v-nexus-lite.firebasestorage.app for every app using it; confirm ownership or provision a dedicated bucket.',
  'ENTERPRISE_EDITION: the DSBC database is Firestore Enterprise edition; the emulator runs Standard edition, so rules and Firestore triggers must be verified on a real Enterprise database first.',
  'NOTIFICATIONS: no email provider; Platform Health can never be OK until one is integrated or the owner accepts NOT_CONFIGURED.',
];
const liveDeployment = !probeCurrent ? 'NOT VERIFIED' : probe.liveDeployment === 'COMPLETE' ? 'PASS' : 'NOT COMPLETE';
const liveHealth = probeCurrent ? probe.liveHealth : 'NOT VERIFIED';
const liveAcceptance = !probeCurrent
  ? 'NOT VERIFIED'
  : probe.liveAcceptance === 'PASS' && liveHealth === 'PASS'
    ? 'PASS'
    : probe.liveAcceptance === 'NOT_EXECUTED' ? 'NOT EXECUTED' : 'FAIL';
const readiness = {
  demoReady: allPass ? 'PASS' : 'FAIL',
  deploymentReady: !allPass ? 'FAIL' : deploymentBlockers.length ? 'BLOCKED' : 'PASS',
  liveDeploymentComplete: liveDeployment,
  liveAcceptancePassed: liveAcceptance,
  productionCertified: allPass && deploymentBlockers.length === 0 && liveDeployment === 'PASS' && liveAcceptance === 'PASS' ? 'PASS' : 'FAIL',
};

const report = {
  schema: 'dsbc.directive27.certification/v1',
  directive: 27,
  generatedAt: new Date().toISOString(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: head,
  environment: 'Tests: Firebase Emulator Suite (demo-dsbc) + real Chrome against a production-mode bundle. Live levels: read-only measurements of the production target by scripts/directive27/liveProbe.mjs. This script deploys nothing.',
  gate: readiness.deploymentReady === 'PASS' ? 'PASS' : readiness.deploymentReady,
  readiness,
  liveProbe: probe
    ? { commit: probe.commit, generatedAt: probe.generatedAt, current: probeCurrent, target: probe.target, liveDeployment: probe.liveDeployment, liveHealth: probe.liveHealth, liveAcceptance: probe.liveAcceptance }
    : null,
  finalStatus: readiness.productionCertified === 'PASS'
    ? 'PASS — PRODUCTION CERTIFIED'
    : allPass
      ? `DEMO READY · DEPLOYMENT ${readiness.deploymentReady} · LIVE DEPLOYMENT ${readiness.liveDeploymentComplete} · LIVE ACCEPTANCE ${readiness.liveAcceptancePassed} · PRODUCTION NOT CERTIFIED`
      : 'FAIL — DIRECTIVE 27 INCOMPLETE',
  deploymentBlockers,
  productionCertificationRequires: [
    'Every deployment blocker resolved and the runbook (docs/directive-27/RUNBOOK.md) executed under App Owner control.',
    'Live Platform Health overall OK (or only intentionally DISABLED checks).',
    'The three-customer scenario repeated on the real public URLs from clean devices, App Owner Demo Readiness 3 of 3.',
    'Existing-customer migration decisions recorded by the App Owner against a fresh preview hash (overnight discovery: only legacy demo candidates, so SKIP) and the audit trail reviewed; rollback path rehearsed.',
  ],
  summary: Object.fromEntries(lines.map((l) => [l.key, l.status])),
  totals: {
    unit: count(unit),
    rules: count(rules),
    integration: count(integration),
    backend: count(backend),
    browser: count(browser),
    mutation: mutation ? `${mutation.summary.killed}/${mutation.summary.total}` : 'not run',
  },
  lines,
};
writeFileSync(join(root, OUT), JSON.stringify(report, null, 2) + '\n');
console.log(report.finalStatus);
console.log(`  1 Demo Ready:               ${readiness.demoReady}`);
console.log(`  2 Deployment Ready:         ${readiness.deploymentReady}`);
console.log(`  3 Live Deployment Complete: ${readiness.liveDeploymentComplete}`);
console.log(`  4 Live Acceptance Passed:   ${readiness.liveAcceptancePassed}`);
console.log(`  5 Production Certified:     ${readiness.productionCertified}`);
for (const l of lines) console.log(`  ${l.status.padEnd(4)} ${l.title}`);
process.exit(allPass ? 0 : 1);
