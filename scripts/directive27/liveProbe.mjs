// ============================================================================
// Live deployment probe (overnight directive, Phases 1, 6, 7) — READ-ONLY
// ============================================================================
//   node scripts/directive27/liveProbe.mjs [--out docs/overnight/evidence/live-probe.json]
//
// Measures what is actually deployed on the registry's production target,
// instead of assuming it. Every call is a read: Firebase CLI / gcloud list and
// describe commands, the Firebase Rules API GET, and HTTP GETs of public
// URLs. Nothing is created, enabled, deployed or written.
//
// Verdicts per check: PASS | FAIL | BLOCKED (a human designation or project
// change is missing) | NOT_DEPLOYED | NOT_EXECUTED (needs a deployed backend
// or a signed-in App Owner, which a script cannot be).
//
// liveDeployment = COMPLETE only when rules, functions and hosting on the live
// target all match this commit. liveAcceptance = PASS only when
// docs/overnight/evidence/live-acceptance.json records a passing three-customer
// run against the deployed public origin at this commit.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argOut = process.argv.indexOf('--out');
const OUT = argOut > 0 ? process.argv[argOut + 1] : 'docs/overnight/evidence/live-probe.json';
const ACCEPTANCE = 'docs/overnight/evidence/live-acceptance.json';
const HEALTH = 'docs/overnight/evidence/live-health.json';

const registry = JSON.parse(readFileSync(join(root, 'config/environments.json'), 'utf8')).environments.production;
const PROJECT = registry.firebase.projectId;
const DATABASE = registry.firestoreDatabaseId;
const REGION = registry.functionsRegion;
const SITE = registry.hosting?.site ?? null;
const ORIGIN = registry.publicOrigin ?? null;

// Never inherit emulator variables: this probe measures the real target only.
const liveEnv = { ...process.env };
for (const k of Object.keys(liveEnv)) if (/_EMULATOR_HOST$/.test(k)) delete liveEnv[k];
// The repo's firebase-tools binary (node_modules/.bin) first on PATH.
const pathKey = Object.keys(liveEnv).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
liveEnv[pathKey] = `${join(root, 'node_modules', '.bin')}${process.platform === 'win32' ? ';' : ':'}${liveEnv[pathKey] ?? ''}`;
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', env: liveEnv });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
// The Firebase CLI on PATH (`npx firebase` resolves to the JS SDK package, which has no binary).
const firebase = (...a) => run('firebase', [...a, '--project', PROJECT, '--json']);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout.trim();
const commit = git('rev-parse', 'HEAD');

const checks = [];
const add = (id, status, detail, data) => checks.push({ id, status, detail, ...(data ? { data } : {}) });

async function http(url) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}
const titleOf = (html) => (/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '').trim();

// ---- 1. target: project + named database --------------------------------------------
const dbs = parse(firebase('firestore:databases:list').out)?.result ?? [];
const dbNames = dbs.map((d) => String(d.name ?? d).split('/').pop());
const dsbcDb = dbs.find((d) => String(d.name ?? d).endsWith(`/databases/${DATABASE}`));
add('TARGET_DATABASE', dsbcDb ? 'PASS' : 'FAIL',
  dsbcDb ? `${DATABASE} exists in ${PROJECT} (${dsbcDb.databaseEdition ?? dsbcDb.edition ?? '?'} edition, ${dsbcDb.locationId ?? '?'})` : `registered database ${DATABASE} not found in ${PROJECT}`,
  { databasesInProject: dbNames });
if (dsbcDb && registry.firestoreEdition && (dsbcDb.databaseEdition ?? '').toUpperCase() !== registry.firestoreEdition) {
  add('TARGET_DATABASE_EDITION', 'FAIL', `registry says ${registry.firestoreEdition}, live says ${dsbcDb.databaseEdition}`);
}
if (dsbcDb && dsbcDb.locationId !== registry.firestoreLocation) {
  add('TARGET_DATABASE_LOCATION', 'FAIL', `registry says ${registry.firestoreLocation}, live says ${dsbcDb.locationId}`);
}
if (dsbcDb) {
  const pitr = dsbcDb.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED';
  const protectedDb = dsbcDb.deleteProtectionState === 'DELETE_PROTECTION_ENABLED';
  add('DATABASE_RECOVERY', pitr && protectedDb ? 'PASS' : 'WARN',
    `point-in-time recovery ${pitr ? 'enabled' : 'DISABLED'}, delete protection ${protectedDb ? 'enabled' : 'DISABLED'} (owner decision; recommended before customer data goes live)`);
}

// ---- 2. required Google APIs -----------------------------------------------------------
const REQUIRED_APIS = [
  'firestore.googleapis.com', 'firebaserules.googleapis.com', 'identitytoolkit.googleapis.com', 'firebasehosting.googleapis.com',
  'storage.googleapis.com', 'cloudfunctions.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com',
  'run.googleapis.com', 'eventarc.googleapis.com', 'pubsub.googleapis.com', 'cloudscheduler.googleapis.com', 'secretmanager.googleapis.com',
];
const apisRun = run('gcloud', ['services', 'list', '--enabled', '--project', PROJECT, '--format=value(config.name)']);
const enabled = new Set(apisRun.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
const missingApis = REQUIRED_APIS.filter((a) => !enabled.has(a));
add('REQUIRED_APIS', apisRun.code !== 0 ? 'FAIL' : missingApis.length ? 'BLOCKED' : 'PASS',
  apisRun.code !== 0 ? `could not list services: ${apisRun.err.slice(0, 200)}` : missingApis.length ? `not enabled: ${missingApis.join(', ')} (enabling them is a project change the owner must approve)` : 'all deployment APIs enabled',
  { missing: missingApis });

// ---- 3. Secret Manager secrets the payment functions declare -----------------------------
if (!enabled.has('secretmanager.googleapis.com')) {
  add('FUNCTION_SECRETS', 'BLOCKED', 'Secret Manager API disabled; RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET cannot exist, so `firebase deploy --only functions` cannot succeed');
} else {
  const missing = ['RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].filter((s) => run('gcloud', ['secrets', 'describe', s, '--project', PROJECT, '--format=value(name)']).code !== 0);
  add('FUNCTION_SECRETS', missing.length ? 'BLOCKED' : 'PASS', missing.length ? `missing: ${missing.join(', ')}` : 'both secrets exist (values not read)');
}

// ---- 4. hosting site + public origin designation ------------------------------------------
const sites = parse(firebase('hosting:sites:list').out)?.result?.sites ?? [];
const siteIds = sites.map((s) => String(s.name).split('/').pop());
const defaultSite = await http(`https://${PROJECT}.web.app/`);
const defaultTitle = titleOf(defaultSite.body);
const defaultIsDsbc = defaultSite.body.includes('/build-info.json') || /DSBC|Digital Business Card/i.test(defaultTitle);
add('DEFAULT_SITE_OCCUPANT', 'INFO', `https://${PROJECT}.web.app serves "${defaultTitle || '(no title)'}" (HTTP ${defaultSite.status})${defaultIsDsbc ? '' : ' — not DSBC; deploying DSBC there would replace another live app'}`,
  { sitesInProject: siteIds });
if (!SITE) add('HOSTING_SITE', 'BLOCKED', 'config/environments.json production.hosting.site is null; the owner must create or choose a dedicated DSBC site');
else if (!siteIds.includes(SITE)) add('HOSTING_SITE', 'FAIL', `designated site "${SITE}" does not exist in ${PROJECT}`);
else if (SITE === PROJECT && !defaultIsDsbc) add('HOSTING_SITE', 'FAIL', `designated site "${SITE}" currently serves another app ("${defaultTitle}")`);
else add('HOSTING_SITE', 'PASS', `designated site "${SITE}" exists`);
add('PUBLIC_ORIGIN', ORIGIN ? 'PASS' : 'BLOCKED', ORIGIN ? `designated: ${ORIGIN}` : 'config/environments.json production.publicOrigin is null; share links and QR codes have no canonical origin');

// ---- 5. deployed Firestore rules on the named database -------------------------------------
const token = run('gcloud', ['auth', 'print-access-token']).out;
let rulesStatus = 'NOT_DEPLOYED';
let rulesDetail = 'unknown';
if (token) {
  const auth = { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT } };
  const rel = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore/${DATABASE}`, auth).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  if (rel.rulesetName) {
    const rs = await fetch(`https://firebaserules.googleapis.com/v1/${rel.rulesetName}`, auth).then((r) => r.json());
    const live = rs.source?.files?.[0]?.content ?? '';
    const local = readFileSync(join(root, 'firestore.rules'), 'utf8');
    const norm = (s) => s.replace(/\r\n/g, '\n').trim();
    const same = norm(live) === norm(local);
    rulesStatus = same ? 'PASS' : 'NOT_DEPLOYED';
    rulesDetail = `${rel.rulesetName.split('/').pop()} released ${rel.updateTime}; ${same ? 'matches firestore.rules at this commit' : 'differs from firestore.rules at this commit (legacy rules still live)'}${/request\.auth\.token\.email\s*==/.test(live) ? '; live rules still grant App Owner by email allow-list' : ''}`;
  } else {
    rulesStatus = 'FAIL';
    rulesDetail = `no release for cloud.firestore/${DATABASE}: ${JSON.stringify(rel.error ?? rel).slice(0, 200)}`;
  }
} else {
  rulesStatus = 'FAIL';
  rulesDetail = 'no gcloud access token';
}
add('FIRESTORE_RULES_DEPLOYED', rulesStatus, rulesDetail);

// ---- 6. deployed functions ----------------------------------------------------------------
const indexSrc = readFileSync(join(root, 'functions/src/index.ts'), 'utf8');
const expectedFns = [...indexSrc.matchAll(/^export const (\w+)/gm), ...indexSrc.matchAll(/^export \{ (\w+) \}/gm)].map((m) => m[1]).sort();
if (!enabled.has('cloudfunctions.googleapis.com')) {
  add('FUNCTIONS_DEPLOYED', 'NOT_DEPLOYED', `Cloud Functions API is disabled on ${PROJECT}; none of the ${expectedFns.length} DSBC functions exist`, { expected: expectedFns });
} else {
  const fnList = parse(firebase('functions:list').out)?.result ?? [];
  const live = new Set(fnList.filter((f) => (f.region ?? '') === REGION).map((f) => f.id ?? String(f.name).split('/').pop()));
  const missing = expectedFns.filter((f) => !live.has(f));
  add('FUNCTIONS_DEPLOYED', missing.length ? 'NOT_DEPLOYED' : 'PASS', missing.length ? `${expectedFns.length - missing.length}/${expectedFns.length} DSBC functions in ${REGION}` : `all ${expectedFns.length} DSBC functions in ${REGION}`, { missing });
}

// ---- 7. control plane bootstrap -------------------------------------------------------------
const boot = run('npx', ['tsx', 'scripts/admin/bootstrapProduction.ts', '--project', PROJECT, '--confirm-project', PROJECT, '--database', DATABASE,
  '--reason', 'liveProbe read-only dry run', '--dry-run', '--report', 'docs/overnight/evidence/bootstrap-dry-run-live.json']);
const bootReport = parse(existsSync(join(root, 'docs/overnight/evidence/bootstrap-dry-run-live.json')) ? readFileSync(join(root, 'docs/overnight/evidence/bootstrap-dry-run-live.json'), 'utf8') : 'null');
if (boot.code !== 0 || !bootReport?.dryRun) add('CONTROL_PLANE_BOOTSTRAPPED', 'FAIL', `dry run failed: ${(boot.err || boot.out).slice(-200)}`);
else {
  const missing = bootReport.items.filter((i) => i.state === 'WOULD_CREATE').length;
  add('CONTROL_PLANE_BOOTSTRAPPED', missing ? 'NOT_DEPLOYED' : bootReport.drift.length ? 'FAIL' : 'PASS',
    missing ? `${missing}/${bootReport.items.length} control-plane documents missing (plans, catalogue, policy, platform config)` : `all ${bootReport.items.length} present, drift ${bootReport.drift.length}`);
}

// ---- 8. hosting serves this commit ----------------------------------------------------------
if (!ORIGIN) add('HOSTING_DEPLOYED', 'NOT_DEPLOYED', 'no public origin designated, so there is no DSBC deployment to measure');
else {
  const info = parse((await http(`${ORIGIN}/build-info.json`)).body);
  const pricing = await http(`${ORIGIN}/pricing`);
  const unknown = await http(`${ORIGIN}/no-such-page-${Date.now()}`);
  const ok = info?.commit === commit && pricing.status === 200 && unknown.status === 404;
  add('HOSTING_DEPLOYED', ok ? 'PASS' : 'NOT_DEPLOYED', `build-info commit ${info?.commit?.slice(0, 7) ?? 'none'} (HEAD ${commit.slice(0, 7)}), /pricing ${pricing.status}, unknown path ${unknown.status}`);
}

// ---- 9. evidence that needs a deployed backend / signed-in App Owner -------------------------
const health = existsSync(join(root, HEALTH)) ? JSON.parse(readFileSync(join(root, HEALTH), 'utf8')) : null;
add('LIVE_PLATFORM_HEALTH', !health ? 'NOT_EXECUTED' : health.commit === commit && ['OK', 'DEGRADED'].includes(health.overall) ? (health.overall === 'OK' ? 'PASS' : 'FAIL') : 'FAIL',
  health ? `overall ${health.overall} at ${health.commit?.slice(0, 7)}` : `no ${HEALTH}: adminGetPlatformHealth must be called by the signed-in App Owner on the deployed backend`);
const acceptance = existsSync(join(root, ACCEPTANCE)) ? JSON.parse(readFileSync(join(root, ACCEPTANCE), 'utf8')) : null;
const acceptanceOk = !!acceptance && acceptance.commit === commit && acceptance.origin === ORIGIN && acceptance.customers?.length === 3 && acceptance.customers.every((c) => c.passed) && acceptance.isolation?.passed === true;
add('LIVE_ACCEPTANCE', !acceptance ? 'NOT_EXECUTED' : acceptanceOk ? 'PASS' : 'FAIL',
  acceptance ? `${acceptance.customers?.filter((c) => c.passed).length ?? 0}/3 customers, isolation ${acceptance.isolation?.passed ? 'PASS' : 'FAIL'} at ${acceptance.commit?.slice(0, 7)}` : `no ${ACCEPTANCE}: the three-customer journey has not been run against a live deployment`);

// ---- verdicts ---------------------------------------------------------------------------------
const st = (id) => checks.find((c) => c.id === id)?.status;
const deployedIds = ['FIRESTORE_RULES_DEPLOYED', 'FUNCTIONS_DEPLOYED', 'HOSTING_DEPLOYED', 'CONTROL_PLANE_BOOTSTRAPPED'];
const targetIds = ['TARGET_DATABASE', 'REQUIRED_APIS', 'FUNCTION_SECRETS', 'HOSTING_SITE', 'PUBLIC_ORIGIN'];
const report = {
  schema: 'dsbc.liveProbe/v1',
  generatedAt: new Date().toISOString(),
  commit,
  target: { projectId: PROJECT, databaseId: DATABASE, functionsRegion: REGION, hostingSite: SITE, publicOrigin: ORIGIN, storageBucket: registry.firebase.storageBucket },
  readOnly: true,
  targetVerified: targetIds.every((id) => st(id) === 'PASS'),
  liveDeployment: deployedIds.every((id) => st(id) === 'PASS') ? 'COMPLETE' : 'NOT_COMPLETE',
  liveHealth: st('LIVE_PLATFORM_HEALTH'),
  liveAcceptance: st('LIVE_ACCEPTANCE'),
  checks,
};
mkdirSync(dirname(join(root, OUT)), { recursive: true });
writeFileSync(join(root, OUT), JSON.stringify(report, null, 2) + '\n');
for (const c of checks) console.log(`${c.status.padEnd(12)} ${c.id}: ${c.detail}`);
console.log(`target verified: ${report.targetVerified} · live deployment: ${report.liveDeployment} · live health: ${report.liveHealth} · live acceptance: ${report.liveAcceptance} -> ${OUT}`);
