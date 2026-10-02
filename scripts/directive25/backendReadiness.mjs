// ============================================================================
// Directive 25 Phase 14 — machine-readable backend readiness report
// ============================================================================
//   node scripts/directive25/backendReadiness.mjs            (runs everything)
//   node scripts/directive25/backendReadiness.mjs --no-run   (re-evaluates the
//                                                              last evidence)
// Produces docs/directive-25/backend-readiness.json. Every required item is
// PASS or BLOCKED — there is no WARNING. Evidence is executed here (typecheck,
// builds, unit, Directive 24 rules regression, integration, backend authority
// on the emulator) or read from docs/directive-25/evidence/mutation-testing.json
// (scripts/directive25/mutationTest.mjs). Nothing touches a real Firebase project.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EV = join(root, 'docs/directive-25/evidence');
const OUT = join(root, 'docs/directive-25/backend-readiness.json');
const RUN = !process.argv.includes('--no-run');
mkdirSync(EV, { recursive: true });

const bin = join(root, 'node_modules', '.bin');
const env = { ...process.env, PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, FUNCTIONS_DISCOVERY_TIMEOUT: '120' };
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024, ...opts });
const rel = (p) => p.replace(/\\/g, '/');
const text = (p) => readFileSync(join(root, p), 'utf8');
const lf = (p) => text(p).replace(/\r\n/g, '\n');
const git = (...a) => sh('git', a).stdout.trim();

// ---------------------------------------------------------------------------
// 1. Execute
// ---------------------------------------------------------------------------
const steps = {};
function step(name, cmd, args) {
  const started = Date.now();
  const r = sh(cmd, args);
  steps[name] = { command: [cmd, ...args].join(' '), exitCode: r.status, seconds: Math.round((Date.now() - started) / 1000) };
  writeFileSync(join(EV, `${name}.log`), `${r.stdout}\n${r.stderr}`.replace(/\u001b\[[0-9;]*m/g, ''));
  return r.status === 0;
}
const jsonOut = (name) => rel(join('docs/directive-25/evidence', `${name}.json`));
const vitestJson = (name) => ['--reporter=dot', '--reporter=json', `--outputFile.json=${jsonOut(name)}`];

if (RUN) {
  step('typecheck-frontend', 'node', ['node_modules/typescript/bin/tsc', '--noEmit']);
  step('typecheck-functions', 'npm', ['--prefix', 'functions', 'run', 'typecheck']);
  step('build-functions', 'npm', ['--prefix', 'functions', 'run', 'build']);
  step('build-frontend', 'npx', ['vite', 'build']);
  step('tests-unit', 'npx', ['vitest', 'run', ...vitestJson('tests-unit')]);
  step('tests-rules-directive24', 'firebase', ['emulators:exec', '--only', 'firestore', '--project', 'demo-dsbc', `"vitest run --config vitest.rules.config.ts ${vitestJson('tests-rules-directive24').join(' ')}"`]);
  step('tests-integration', 'firebase', ['emulators:exec', '--only', 'auth,firestore', '--project', 'demo-dsbc', `"vitest run --config vitest.integration.config.ts ${vitestJson('tests-integration').join(' ')}"`]);
  step('tests-backend-authority', 'node', ['scripts/directive25/runBackendTests.mjs', ...vitestJson('tests-backend-authority')]);
  writeFileSync(join(EV, 'steps.json'), JSON.stringify(steps, null, 2) + '\n');
}
const stepResults = existsSync(join(EV, 'steps.json')) ? JSON.parse(readFileSync(join(EV, 'steps.json'), 'utf8')) : {};

// ---------------------------------------------------------------------------
// 2. Evidence helpers
// ---------------------------------------------------------------------------
function suite(name) {
  const p = join(EV, `${name}.json`);
  if (!existsSync(p)) return { present: false, passed: 0, failed: 0, total: 0, tests: [] };
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const tests = j.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: a.fullName, status: a.status })));
  return { present: true, passed: j.numPassedTests, failed: j.numFailedTests, total: j.numTotalTests, success: j.success && j.numFailedTests === 0, tests };
}
const unit = suite('tests-unit');
const rules = suite('tests-rules-directive24');
const integration = suite('tests-integration');
const backend = suite('tests-backend-authority');

const AUTH_IDS = Array.from({ length: 25 }, (_, i) => `AUTH-${String(i + 1).padStart(3, '0')}`);
const authStatus = Object.fromEntries(
  AUTH_IDS.map((id) => {
    // The id is a describe title token (some cases are nested in a parent describe).
    const ts = backend.tests.filter((t) => new RegExp(`(^| )${id} `).test(t.name));
    return [id, { tests: ts.length, passed: ts.length > 0 && ts.every((t) => t.status === 'passed') }];
  })
);
const authPass = (...ids) => ids.every((id) => authStatus[id]?.passed);

const mutation = existsSync(join(EV, 'mutation-testing.json')) ? JSON.parse(readFileSync(join(EV, 'mutation-testing.json'), 'utf8')) : null;

function files(dir) {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(root, p)).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [rel(p)] : [];
  });
}
const codeOnly = (p) => lf(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const srcFiles = files('src');

function rulesBlock(collection) {
  const t = lf('firestore.rules');
  const i = t.indexOf(`match /${collection}/`);
  if (i < 0) return null;
  return t.slice(i, t.indexOf('\n    }', i));
}
const serverOnly = (c) => !!rulesBlock(c) && /allow write: if false;/.test(rulesBlock(c));

// ---------------------------------------------------------------------------
// 3. Required items (PASS | BLOCKED)
// ---------------------------------------------------------------------------
const items = [];
function item(key, title, checks) {
  const failed = checks.filter((c) => !c.ok);
  items.push({ key, title, status: failed.length ? 'BLOCKED' : 'PASS', checks: checks.map((c) => ({ check: c.check, ok: !!c.ok, ...(c.detail !== undefined ? { detail: c.detail } : {}) })) });
}
const ok = (name) => stepResults[name]?.exitCode === 0;

const LEGACY_KEYS = ['dsbc_entitlement_plans_v1', 'dsbc_entitlement_overrides_v1', 'dsbc_entitlement_policy_v1', 'dsbc_entitlement_audit_v1', 'dsbc_entitlement_usage_v1', 'dsbc_subscriptions_v1', 'dsbc_invoices_v1', 'dsbc_commercial_audit_v1', 'dsbc_publishing_records_v1', 'dsbc_registered_slugs_v1', 'dsbc_quarantined_slugs_v1', 'dsbc_pilot_registry_v1'];
const COMMERCIAL = ['plans', 'featureCatalogue', 'globalPolicies', 'entitlementOverrides', 'subscriptions', 'invoices', 'usageCounters', 'usageLedger', 'paymentOrders', 'webhookEvents', 'publishingRecords', 'slugs', 'customerClassifications'];
const AUDIT = ['entitlementAuditLogs', 'commercialAuditLogs', 'platformAuditLogs'];
const fnIndex = existsSync(join(root, 'functions/src/index.ts')) ? lf('functions/src/index.ts') : '';
const distJs = existsSync(join(root, 'dist/assets')) ? readdirSync(join(root, 'dist/assets')).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(root, 'dist/assets', f), 'utf8')).join('\n') : '';

item('backendConfigured', 'Backend configured (Cloud Functions, Node 22, params/secrets)', [
  { check: 'functions/src/index.ts exports the control plane', ok: /export const getMyCommercialState = callable/.test(fnIndex) && /export const razorpayWebhook = onRequest/.test(fnIndex) },
  { check: 'functions/package.json engine node 22', ok: JSON.parse(text('functions/package.json')).engines?.node === '22' },
  { check: 'firebase.json declares the functions codebase', ok: Array.isArray(JSON.parse(text('firebase.json')).functions) },
  { check: 'secrets via defineSecret, payments behind PAYMENTS_ENABLED param', ok: /defineSecret\('RAZORPAY_KEY_SECRET'\)/.test(lf('functions/src/shared/config.ts')) && /defineBoolean\('PAYMENTS_ENABLED'/.test(lf('functions/src/shared/config.ts')) },
  { check: 'functions typecheck', ok: ok('typecheck-functions') },
  { check: 'functions build', ok: ok('build-functions') },
]);

item('emulatorTested', 'Backend authority tested on the Firebase Emulator (AUTH-001..025)', [
  { check: 'backend suite executed against auth/firestore/functions/storage emulators', ok: backend.present && ok('tests-backend-authority'), detail: `${backend.passed}/${backend.total}` },
  { check: 'every AUTH-001..025 has passing tests', ok: AUTH_IDS.every((id) => authStatus[id].passed), detail: AUTH_IDS.filter((id) => !authStatus[id].passed) },
  { check: 'mutation testing: every authorization mutant killed', ok: !!mutation && mutation.total > 0 && mutation.survived.length === 0, detail: mutation ? `${mutation.killed}/${mutation.total}` : 'not run' },
]);

item('clientAuthorityRemoved', 'Client authority removed', [
  { check: 'no source reads a legacy authority localStorage key', ok: srcFiles.filter((f) => !f.endsWith('commercialStore.ts')).every((f) => LEGACY_KEYS.every((k) => !codeOnly(f).includes(k))) },
  { check: 'no browser write path to commercial collections', ok: srcFiles.every((f) => !/(setDoc|updateDoc|addDoc|deleteDoc)\([^)]*['"](subscriptions|invoices|paymentOrders|entitlementOverrides|plans|usageCounters|globalPolicies|publishingRecords|slugs)['"]/.test(codeOnly(f))) },
  { check: 'browser payment "verification" removed', ok: srcFiles.every((f) => !/verifyWebhookSignature|generateSignedWebhook|sig_rzp_/.test(codeOnly(f))) },
  { check: 'browser mutations go through backend callables', ok: /httpsCallable/.test(lf('src/lib/backend.ts')) },
  { check: 'AUTH-019/020 (forged localStorage has no effect) pass', ok: authPass('AUTH-019', 'AUTH-020') },
]);

item('commercialStatePersistent', 'Commercial state persistent in Firestore (server-written)', [
  ...COMMERCIAL.map((c) => ({ check: `rules: ${c} is server-written only`, ok: serverOnly(c) })),
  { check: 'AUTH-016 App Owner plan change persisted with server timestamps', ok: authPass('AUTH-016') },
]);

item('entitlementAuthorityServerSide','Entitlement authority server-side', [
  { check: 'server resolver exported (getEffectiveEntitlement / can / getLimit / getUsage / checkLimit / isFeatureLocked)', ok: ['getEffectiveEntitlement', 'can', 'getLimit', 'getUsage', 'checkLimit', 'isFeatureLocked'].every((n) => new RegExp(`export (const|async function) ${n}\\b`).test(lf('functions/src/entitlements/resolution.ts'))) },
  { check: 'browser displays the server snapshot (getMyCommercialState) and fails closed', ok: /getMyCommercialState/.test(lf('src/services/commercialStore.ts')) && /lockedEntitlement/.test(lf('src/services/entitlementService.ts')) },
  { check: 'AUTH-006 / AUTH-013 pass', ok: authPass('AUTH-006', 'AUTH-013') },
]);

item('subscriptionAuthorityServerSide', 'Subscription authority server-side', [
  { check: 'customer callables limited to checkout / confirm / cancel', ok: /export const cancelMySubscription/.test(fnIndex) && !/export const (upgradeMySubscription|setMyPlan)/.test(fnIndex) },
  { check: 'AUTH-003 / 004 / 005 / 009 / 014 / 015 pass', ok: authPass('AUTH-003', 'AUTH-004', 'AUTH-005', 'AUTH-009', 'AUTH-014', 'AUTH-015') },
]);

item('quotaAuthorityServerSide', 'Quota authority server-side', [
  { check: 'usage counters and ledger server-written only', ok: serverOnly('usageCounters') && serverOnly('usageLedger') },
  { check: 'consumeQuota checks the limit inside its transaction', ok: /current \+ amount > eff\.limit/.test(lf('functions/src/usage/quota.ts')) },
  { check: 'AUTH-010 / AUTH-011 pass (incl. concurrent overspend)', ok: authPass('AUTH-010', 'AUTH-011') },
]);

item('paymentSecretsBackendOnly', 'Payment secrets backend-only', [
  { check: 'production bundle built', ok: ok('build-frontend') && distJs.length > 0 },
  { check: 'bundle contains no secret material', ok: distJs.length > 0 && !/rzp_sec_|RAZORPAY_(KEY|WEBHOOK)_SECRET|BEGIN PRIVATE KEY|private_key_id/.test(distJs) },
  { check: 'browser sources reference no secret', ok: srcFiles.every((f) => !/RAZORPAY_(KEY|WEBHOOK)_SECRET|rzp_sec_|BEGIN PRIVATE KEY/.test(lf(f))) },
  { check: 'functions/.secret.local is git-ignored and untracked', ok: sh('git', ['check-ignore', 'functions/.secret.local']).status === 0 && git('ls-files', 'functions/.secret.local') === '' },
]);

item('webhookCryptographicVerification', 'Webhook cryptographic verification present', [
  { check: 'HMAC-SHA256 with constant-time compare in the backend provider', ok: /createHmac\('sha256'/.test(lf('functions/src/billing/paymentProvider.ts')) && /timingSafeEqual/.test(lf('functions/src/billing/paymentProvider.ts')) },
  { check: 'webhook verifies the raw body before parsing', ok: lf('functions/src/billing/payments.ts').indexOf('verifyWebhookSignature') < lf('functions/src/billing/payments.ts').indexOf('parseWebhookEvent') },
  { check: 'unit tests of signature verification pass', ok: unit.tests.filter((t) => /signature/.test(t.name)).length >= 3 && unit.tests.filter((t) => /signature/.test(t.name)).every((t) => t.status === 'passed') },
  { check: 'AUTH-021 / 022 / 023 pass', ok: authPass('AUTH-021', 'AUTH-022', 'AUTH-023') },
]);

item('auditImmutability', 'Audit immutability present', [
  ...AUDIT.map((c) => ({ check: `rules: ${c} not writable by any client`, ok: serverOnly(c) })),
  { check: 'ledger writes use create() only (no update/set/delete)', ok: /\.create\(ref, record\(entry\)\)/.test(lf('functions/src/audit/ledger.ts')) && !/\.(update|delete|set)\((ref|tx|this)\b/.test(codeOnly('functions/src/audit/ledger.ts')) },
  { check: 'AUTH-017 / AUTH-018 pass', ok: authPass('AUTH-017', 'AUTH-018') },
]);

item('tenantIsolationVerified', 'Tenant isolation verified', [
  { check: 'AUTH-012 passes', ok: authPass('AUTH-012') },
  { check: 'Directive 24 tenant-isolation rules suite passes', ok: rules.present && rules.tests.filter((t) => /tenant/i.test(t.name)).length > 0 && rules.tests.filter((t) => /tenant/i.test(t.name)).every((t) => t.status === 'passed') },
]);

item('directive24RegressionPassing', 'Directive 24 regression suite passing', [
  { check: 'rules suite 433/433', ok: rules.present && rules.success && rules.total >= 433, detail: `${rules.passed}/${rules.total}` },
  { check: 'integration suite', ok: integration.present && integration.success, detail: `${integration.passed}/${integration.total}` },
  { check: 'unit suite', ok: unit.present && unit.success, detail: `${unit.passed}/${unit.total}` },
  { check: 'frontend typecheck', ok: ok('typecheck-frontend') },
]);

// ---------------------------------------------------------------------------
// 4. Deployment blockers (outside backend-authority certification; never PASS
//    by assumption — each stays BLOCKED until verified outside this repo run)
// ---------------------------------------------------------------------------
const deploymentBlockers = [
  { key: 'notDeployed', status: 'BLOCKED', detail: 'Nothing has been deployed (Directive 25: DO NOT DEPLOY). Functions, rules and indexes run only in the emulator.' },
  { key: 'appOwnerClaimNotGranted', status: 'BLOCKED', detail: 'No real account holds platformRole=app_owner (scripts/admin/setAppOwner.ts not run against the live project).' },
  { key: 'liveDatabaseTarget', status: 'BLOCKED', detail: 'Live client uses the named database ai-studio-37d17c3e-…; functions need DSBC_FIRESTORE_DATABASE set for that project and firebase.json must target the same database before deployment.' },
  { key: 'realPaymentProviderTest', status: 'BLOCKED', detail: 'PAYMENTS_ENABLED=false. Razorpay createOrder / payment lookup / webhook have only been exercised with a stubbed transport and emulator-signed webhooks; no request has been made to Razorpay.' },
  { key: 'liveCommercialDataMigration', status: 'BLOCKED', detail: 'Existing live customers have no subscriptions/{id} records (their plan lived in browser storage / companies.planId). Without an App-Owner-reviewed migration they resolve to the free plan once the backend is authoritative (content retained, paid features locked).' },
  { key: 'controlPlaneBootstrap', status: 'BLOCKED', detail: 'plans / featureCatalogue / globalPolicies must be seeded in the live database by the App Owner (bootstrapControlPlane) after deployment.' },
];

const required = items.map((i) => i.status);
const finalStatus = required.every((s) => s === 'PASS') ? 'PASS — BACKEND AUTHORITY CERTIFIED' : 'BLOCKED — BACKEND AUTHORITY INCOMPLETE';

const report = {
  schema: 'dsbc.backendReadiness/v1',
  directive: 25,
  generatedAt: new Date().toISOString(),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  commit: git('rev-parse', 'HEAD'),
  workingTreeClean: git('status', '--porcelain') === '',
  environment: 'Firebase Emulator Suite only (project demo-dsbc). No live Firebase project was contacted.',
  finalStatus,
  productionCertified: false,
  productionCertifiedReason: 'Backend authority certification is not production certification; see deploymentBlockers.',
  summary: Object.fromEntries(items.map((i) => [i.key, i.status])),
  tests: {
    unit: { passed: unit.passed, total: unit.total },
    rulesDirective24: { passed: rules.passed, total: rules.total },
    integration: { passed: integration.passed, total: integration.total },
    backendAuthority: { passed: backend.passed, total: backend.total },
    authCases: authStatus,
    mutation: mutation ? { killed: mutation.killed, total: mutation.total, survived: mutation.survived, generatedAt: mutation.generatedAt } : null,
  },
  steps: stepResults,
  items,
  deploymentBlockers,
};
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`${finalStatus}`);
for (const i of items) console.log(`  ${i.status.padEnd(7)} ${i.key}`);
process.exit(finalStatus.startsWith('PASS') ? 0 : 1);
