// ============================================================================
// Directive 25 Phase 13 — mutation testing of the authorization conditions
// ============================================================================
// For each mutant: apply ONE deliberate weakening to the backend, the shared
// domain or firestore.rules, rebuild, run the relevant emulator test files and
// record whether the suite fails ("killed"). A surviving mutant means the
// tests would not notice that protection being removed.
//
//   node scripts/directive25/mutationTest.mjs [MUTANT_ID ...]
//
// Safety: every mutated file is restored in a finally block (and a backup copy
// is kept next to the results until restoration is confirmed). Emulator only.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, 'docs/directive-25/evidence/mutation-testing.json');
const BACKUP_DIR = join(root, 'docs/directive-25/evidence/.mutation-backup');

const F = {
  identity: 'tests/backend/authority-identity-plans.test.ts',
  commercial: 'tests/backend/authority-commercial-forgery.test.ts',
  tenancy: 'tests/backend/authority-tenancy-lifecycle.test.ts',
  client: 'tests/backend/authority-client-webhooks-publishing.test.ts',
};

/** find must occur exactly once (after CRLF -> LF normalisation). */
const MUTANTS = [
  // ---- identity / authorization ------------------------------------------------
  { id: 'M01', area: 'auth', file: 'functions/src/auth/identity.ts', desc: 'requireAppOwner() no longer denies',
    find: "if (!caller.isAppOwner) deny('Only the App Owner may perform this operation.');", replace: '/* mutant: no App Owner check */', tests: [F.identity] },
  { id: 'M02', area: 'auth', file: 'functions/src/auth/identity.ts', desc: 'App Owner claim accepted on an unverified email',
    find: "isAppOwner: token[APP_OWNER_CLAIM] === 'app_owner' && emailVerified,", replace: "isAppOwner: token[APP_OWNER_CLAIM] === 'app_owner',", tests: [F.identity] },
  { id: 'M03', area: 'auth', file: 'functions/src/auth/identity.ts', desc: 'users/{uid}.role == app_owner trusted as App Owner',
    find: "isAppOwner: token[APP_OWNER_CLAIM] === 'app_owner' && emailVerified,", replace: "isAppOwner: (token[APP_OWNER_CLAIM] === 'app_owner' && emailVerified) || snap.get('role') === 'app_owner',", tests: [F.identity] },
  { id: 'M04', area: 'auth', file: 'functions/src/auth/identity.ts', desc: 'every company member treated as billing contact / admin',
    find: "const isAdmin = profile.role === 'company_admin';", replace: 'const isAdmin = true;', tests: [F.identity, F.commercial] },
  { id: 'M05', area: 'validation', file: 'functions/src/shared/validate.ts', desc: 'unknown payload fields (role, customerId, price…) accepted',
    find: "if (extra.length) invalid(`Unexpected field(s): ${extra.join(', ')}`);", replace: '/* mutant: extra fields accepted */', tests: [F.identity] },
  { id: 'M06', area: 'entitlements', file: 'functions/src/entitlements/admin.ts', desc: 'upsertOverride callable without App Owner check',
    find: "export async function upsertOverride(caller: Caller, data: unknown) {\n  requireAppOwner(caller);", replace: 'export async function upsertOverride(caller: Caller, data: unknown) {', tests: [F.commercial] },
  // ---- audit ---------------------------------------------------------------------------
  { id: 'M07', area: 'audit', file: 'functions/src/audit/ledger.ts', desc: 'audit record silently not written',
    find: '(tx as Transaction).create(ref, record(entry));', replace: 'void record;', tests: [F.identity] },
  // ---- payments ------------------------------------------------------------------------
  { id: 'M08', area: 'payments', file: 'functions/src/billing/paymentProvider.ts', desc: 'any well-formed hex signature accepted',
    find: "return timingSafeEqual(Buffer.from(presented, 'hex'), Buffer.from(expectedHex, 'hex'));", replace: 'return true;', tests: [F.commercial, F.client] },
  { id: 'M09', area: 'payments', file: 'functions/src/billing/payments.ts', desc: 'webhook processed without signature verification',
    find: 'if (!provider.verifyWebhookSignature(req.rawBody, req.signature)) {', replace: 'if (false) {', tests: [F.client] },
  { id: 'M10', area: 'payments', file: 'functions/src/billing/payments.ts', desc: 'webhook event ledger idempotency removed',
    find: "if (seen.exists) return { duplicate: true, outcome: seen.get('outcome') as string };", replace: '/* mutant: no duplicate check */', tests: [F.client] },
  { id: 'M11', area: 'payments', file: 'functions/src/billing/payments.ts', desc: 'paid order can be applied twice',
    find: "if (order.status === 'PAID') return { outcome: 'ALREADY_APPLIED', orderId: orderRef.id };", replace: '/* mutant: re-apply */', tests: [F.client] },
  { id: 'M12', area: 'payments', file: 'functions/src/billing/payments.ts', desc: 'captured amount not compared with the server-priced order',
    find: 'if (payment.amountMinor !== order.amountMinor || payment.currency !== order.currency || payment.orderId !== order.providerOrderId) {', replace: 'if (false) {', tests: [F.client] },
  { id: 'M13', area: 'payments', file: 'functions/src/billing/payments.ts', desc: 'payment confirmation without order ownership check',
    find: "if (order.get('customerType') !== subject.customerType || order.get('customerId') !== subject.customerId) deny('Order belongs to another customer.');", replace: '/* mutant: any tenant */', tests: [F.commercial] },
  // ---- subscriptions -------------------------------------------------------------------
  { id: 'M14', area: 'subscriptions', file: 'functions/src/subscriptions/service.ts', desc: 'any member may cancel the subscription',
    find: "if (!subject.isBillingContact) deny('Only the billing contact may cancel this subscription.');", replace: '/* mutant: anyone cancels */', tests: [F.commercial] },
  { id: 'M15', area: 'subscriptions', file: 'shared/domain/subscriptionLifecycle.ts', desc: 'expired trials keep paid access',
    find: "if (sub.trialEndsAt && sub.trialEndsAt <= nowIso) return { status: 'EXPIRED', reason: 'Trial period ended' };", replace: '/* mutant: trials never expire */', tests: [F.tenancy] },
  // ---- entitlement resolution ------------------------------------------------------------
  { id: 'M16', area: 'entitlements', file: 'shared/domain/entitlementResolver.ts', desc: 'expired overrides stay in force',
    find: 'if (o.expiresAt && o.expiresAt <= nowIso) return false;', replace: '/* mutant: no expiry */', tests: [F.tenancy] },
  { id: 'M17', area: 'entitlements', file: 'shared/domain/entitlementResolver.ts', desc: 'individual overrides ignored (precedence broken)',
    find: '  if (ind) {\n    apply(ind.rule);', replace: '  if (false && ind) {\n    apply(ind.rule);', tests: [F.tenancy] },
  // ---- quota ---------------------------------------------------------------------------
  { id: 'M18', area: 'quota', file: 'functions/src/usage/quota.ts', desc: 'metered limit not enforced',
    find: "if (eff.status === 'DISABLED' || (limited && current + amount > eff.limit!)) {", replace: "if (eff.status === 'DISABLED') {", tests: [F.commercial] },
  { id: 'M19', area: 'quota', file: 'functions/src/usage/quota.ts', desc: 'operation-id idempotency removed',
    find: "if (prior.exists) return { ...(prior.get('result') as Record<string, unknown>), idempotentReplay: true };", replace: '/* mutant: no replay protection */', tests: [F.commercial] },
  { id: 'M20', area: 'quota', file: 'functions/src/usage/quota.ts', desc: 'seats beyond the plan limit never locked',
    find: 'const shouldLock = limit !== null && i >= limit;', replace: 'const shouldLock = false;', tests: [F.tenancy] },
  // ---- publishing ---------------------------------------------------------------------
  { id: 'M21', area: 'publishing', file: 'functions/src/publishing/service.ts', desc: 'publishing without ownership check',
    find: "if (!isAdmin && !(entityType !== 'company' && isSelf)) deny('You may only publish entities you own.');", replace: '/* mutant: anyone publishes */', tests: [F.tenancy, F.client] },
  { id: 'M22', area: 'publishing', file: 'functions/src/publishing/service.ts', desc: 'unpublished state not mirrored to the entity',
    find: "tx.update(entity.ref, { publicationHidden: state === 'PUBLISHED' ? FieldValue.delete() : true });", replace: '/* mutant: no visibility mirror */', tests: [F.client] },
  { id: 'M23', area: 'publishing', file: 'functions/src/publishing/service.ts', desc: 'released slugs free for takeover immediately (no quarantine)',
    find: "if (slugSnap.exists && slugSnap.get('entityId') !== entityId && !quarantineEnded)", replace: "if (slugSnap.exists && slugSnap.get('entityId') !== entityId && !slugSnap.get('releasedAt'))", tests: [F.client] },
  // ---- firestore.rules ----------------------------------------------------------------
  { id: 'R01', area: 'rules', file: 'firestore.rules', desc: 'customers may write their subscription',
    find: '      allow read: if isAppOwner() || isSubscriptionCustomer(resource.data.customerType, resource.data.customerId);\n      allow write: if false;\n    }\n\n    match /invoices/{invoiceId} {',
    replace: '      allow read: if isAppOwner() || isSubscriptionCustomer(resource.data.customerType, resource.data.customerId);\n      allow write: if isSubscriptionCustomer(request.resource.data.customerType, request.resource.data.customerId);\n    }\n\n    match /invoices/{invoiceId} {',
    tests: [F.commercial] },
  { id: 'R02', area: 'rules', file: 'firestore.rules', desc: 'App Owner may edit the entitlement audit ledger',
    find: '    match /entitlementAuditLogs/{auditId} {\n      allow read: if isAppOwner();\n      allow write: if false;',
    replace: '    match /entitlementAuditLogs/{auditId} {\n      allow read: if isAppOwner();\n      allow write: if isAppOwner();', tests: [F.identity] },
  { id: 'R03', area: 'rules', file: 'firestore.rules', desc: 'company members may write usage counters',
    find: "        || (resource.data.targetType == 'individual' && isSubscriptionCustomer('individual', resource.data.targetId));\n      allow write: if false;",
    replace: "        || (resource.data.targetType == 'individual' && isSubscriptionCustomer('individual', resource.data.targetId));\n      allow write: if isSignedIn();", tests: [F.commercial] },
  { id: 'R04', area: 'rules', file: 'firestore.rules', desc: 'unpublished cards remain publicly readable',
    find: '          && notPlatformSuspended(resource.data) && notPublicationHidden(resource.data)\n          && isCompanyActive(resource.data.companyId))',
    replace: '          && notPlatformSuspended(resource.data)\n          && isCompanyActive(resource.data.companyId))', tests: [F.client] },
];

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function applyMutant(m) {
  const original = read(m.file);
  const crlf = original.includes('\r\n');
  const text = original.replace(/\r\n/g, '\n');
  const count = text.split(m.find).length - 1;
  if (count !== 1) throw new Error(`${m.id}: expected exactly one match in ${m.file}, found ${count}`);
  const mutated = text.replace(m.find, m.replace);
  writeFileSync(join(root, m.file), crlf ? mutated.replace(/\n/g, '\r\n') : mutated);
  return original;
}

function runTests(files) {
  const started = Date.now();
  const r = spawnSync('node', ['scripts/directive25/runBackendTests.mjs', ...files], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout}\n${r.stderr}`.replace(/\u001b\[[0-9;]*m/g, '');
  const summary = out.match(/^\s*Tests\s+\d+[^\n]*\(\d+\)\s*$/gm)?.pop()?.trim() ?? 'no summary';
  const failed = [...out.matchAll(/FAIL\s+(tests\/backend\/\S+) > ([^\n]+)/g)].map((x) => `${x[1]} > ${x[2].replace(/\u001b\[[0-9;]*m/g, '').trim()}`);
  return { exitCode: r.status, summary, failed: [...new Set(failed)].slice(0, 10), seconds: Math.round((Date.now() - started) / 1000) };
}

const only = process.argv.slice(2);
const selected = only.length ? MUTANTS.filter((m) => only.includes(m.id)) : MUTANTS;
mkdirSync(BACKUP_DIR, { recursive: true });

// Every mutant must apply cleanly before anything runs.
for (const m of selected) {
  const t = read(m.file).replace(/\r\n/g, '\n');
  if (t.split(m.find).length - 1 !== 1) throw new Error(`${m.id}: pattern not found exactly once in ${m.file}`);
}

console.log('Baseline (unmutated) run…');
const baseline = runTests(Object.values(F));
if (baseline.exitCode !== 0) {
  console.error('Baseline failed; mutation results would be meaningless.', baseline);
  process.exit(1);
}

const results = [];
for (const m of selected) {
  const backup = join(BACKUP_DIR, `${m.id}.orig`);
  copyFileSync(join(root, m.file), backup);
  let original;
  try {
    original = applyMutant(m);
    console.log(`${m.id} ${m.desc} …`);
    const run = runTests(m.tests);
    const killed = run.exitCode !== 0;
    results.push({ id: m.id, area: m.area, file: m.file, mutation: m.desc, killed, testFiles: m.tests, ...run });
    console.log(`  ${killed ? 'KILLED' : 'SURVIVED'} (${run.summary}, ${run.seconds}s)`);
  } finally {
    if (original !== undefined) writeFileSync(join(root, m.file), original);
    if (read(m.file) !== readFileSync(backup, 'utf8')) throw new Error(`${m.id}: failed to restore ${m.file}; backup at ${backup}`);
    rmSync(backup);
  }
}
rmSync(BACKUP_DIR, { recursive: true, force: true });
// Rebuild the unmutated backend so lib/ matches source again.
spawnSync('npm', ['--prefix', 'functions', 'run', 'build'], { cwd: root, shell: process.platform === 'win32', stdio: 'ignore' });

const report = {
  schema: 'dsbc.mutationTesting/v1',
  directive: 25,
  generatedAt: new Date().toISOString(),
  environment: 'Firebase Emulator Suite (demo-dsbc): auth, firestore, functions, storage',
  baseline: { summary: baseline.summary, seconds: baseline.seconds },
  total: results.length,
  killed: results.filter((r) => r.killed).length,
  survived: results.filter((r) => !r.killed).map((r) => r.id),
  mutationScore: results.length ? Number((results.filter((r) => r.killed).length / results.length).toFixed(3)) : 0,
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
if (only.length && existsSync(OUT)) {
  // Partial re-run: merge into the existing report.
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const merged = [...prev.results.filter((r) => !only.includes(r.id)), ...results].sort((a, b) => a.id.localeCompare(b.id));
  Object.assign(report, { total: merged.length, killed: merged.filter((r) => r.killed).length, survived: merged.filter((r) => !r.killed).map((r) => r.id), mutationScore: Number((merged.filter((r) => r.killed).length / merged.length).toFixed(3)), results: merged });
}
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`Mutation score ${report.killed}/${report.total}; survived: ${report.survived.join(', ') || 'none'}`);
process.exit(report.survived.length ? 2 : 0);
