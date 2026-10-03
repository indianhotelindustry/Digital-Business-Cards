// ============================================================================
// Directive 27 Phase 4 — secrets audit
// ============================================================================
//   node scripts/directive27/secretsAudit.mjs [--bundle dist] [--bundle dist-e2e]
// Scans (1) every tracked source file, (2) the built client bundles and
// (3) the full git history for secret material. Verdicts:
//   SECRET IN SOURCE         -> FAIL
//   SECRET IN CLIENT BUNDLE  -> FAIL
//   SECRET IN GIT HISTORY    -> INVESTIGATE (reported with commit + file)
//   SERVER SECRET (Secret Manager param, never in code) -> PASS
// The Firebase WEB apiKey is a public project identifier (it ships to every
// browser by design and is protected by Auth, rules and the backend). It is the
// only Google API key allowed, and only in the files listed in PUBLIC_IDENTIFIERS.
// Writes docs/directive-27/evidence/secrets-audit.json. Exit 1 on any FAIL.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(root, 'docs/directive-27/evidence/secrets-audit.json');
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }).stdout;

// Read from the registry (never written here, so this file cannot leak or match it).
const FIREBASE_WEB_API_KEY = JSON.parse(readFileSync(join(root, 'config/environments.json'), 'utf8')).environments.production.firebase.apiKey;
/** Files allowed to carry the public Firebase web configuration. */
const PUBLIC_IDENTIFIERS = ['config/environments.json'];

// [id, description, regex]. Regexes are built from strings so this file never matches itself.
const RULES = [
  ['PRIVATE_KEY', 'PEM private key', new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----')],
  ['SERVICE_ACCOUNT', 'Google service-account credential JSON', new RegExp('"type"\\s*:\\s*"service' + '_account"')],
  ['SA_PRIVATE_KEY_ID', 'service-account private_key_id', new RegExp('"private' + '_key_id"\\s*:\\s*"[0-9a-f]{20,}"')],
  ['GOOGLE_API_KEY', 'Google API key (Gemini / Maps / other) other than the public Firebase web key', new RegExp('AI' + 'za[0-9A-Za-z_-]{35}', 'g')],
  ['RAZORPAY_LIVE_KEY', 'Razorpay live key id', new RegExp('rzp_' + 'live_[0-9A-Za-z]{10,}')],
  ['RAZORPAY_TEST_KEY', 'Razorpay test key id', new RegExp('rzp_' + 'test_[0-9A-Za-z]{10,}')],
  // A literal value (quoted, or a dotenv line) - not the defineSecret('NAME') declaration.
  ['RAZORPAY_SECRET_ASSIGN', 'Razorpay key / webhook secret value', new RegExp('RAZORPAY_(?:KEY_SECRET|WEBHOOK_SECRET)\\s*[=:]\\s*(?:["\'][0-9A-Za-z_-]{12,}["\']|[0-9A-Za-z_-]{12,}\\s*$)', 'm')],
  ['GEMINI_KEY_ASSIGN', 'Gemini API key value', new RegExp('GEMINI_API_KEY\\s*[=:]\\s*["\']?AI' + 'za')],
  ['EMAIL_PROVIDER_KEY', 'email provider API key (SendGrid / Resend / Postmark)', new RegExp('(?:SG\\.[0-9A-Za-z_-]{20,}\\.[0-9A-Za-z_-]{20,}|re_[0-9A-Za-z]{24,}|POSTMARK_[A-Z_]*TOKEN\\s*[=:]\\s*["\']?[0-9a-f-]{30,})')],
  ['GITHUB_TOKEN', 'GitHub token', new RegExp('gh[pousr]_[0-9A-Za-z]{36}')],
  ['OAUTH_CLIENT_SECRET', 'OAuth client secret', new RegExp('GOCSPX-[0-9A-Za-z_-]{20,}')],
];

function scanText(text, file, origin) {
  const hits = [];
  for (const [id, desc, re] of RULES) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of text.matchAll(r)) {
      if (id === 'GOOGLE_API_KEY' && m[0] === FIREBASE_WEB_API_KEY) {
        if (origin === 'source' && !PUBLIC_IDENTIFIERS.includes(file)) hits.push({ id: 'FIREBASE_WEB_KEY_OUTSIDE_CONFIG', desc: 'public Firebase web key outside the designated config files', file, sample: redact(m[0]) });
        continue;
      }
      hits.push({ id, desc, file, sample: redact(m[0]) });
    }
  }
  return hits;
}
const redact = (s) => (s.length <= 10 ? '***' : `${s.slice(0, 6)}…${s.slice(-2)} (${s.length} chars)`);

// ---- 1. tracked source ----------------------------------------------------------
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf|lockb)$/i;
const sourceHits = [];
for (const f of tracked) {
  if (BINARY.test(f) || !existsSync(join(root, f))) continue;
  if (f.startsWith('docs/') && f.endsWith('.json') && statSync(join(root, f)).size > 2_000_000) continue; // large test reports
  sourceHits.push(...scanText(readFileSync(join(root, f), 'utf8'), f, 'source'));
}
// Files that must never be tracked.
const forbiddenTracked = tracked.filter((f) => /(^|\/)\.secret\.local$|(^|\/)\.runtimeconfig\.json$|serviceAccount.*\.json$|-firebase-adminsdk-.*\.json$|(^|\/)\.env\.local$/.test(f));
// Committed env files may hold only non-secret selectors.
const envFiles = tracked.filter((f) => /(^|\/)\.env\.[\w.-]+$/.test(f) && !f.endsWith('.env.example'));
const envViolations = [];
for (const f of envFiles) {
  for (const line of readFileSync(join(root, f), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    if (!m) continue;
    if (/SECRET|PASSWORD|TOKEN|PRIVATE|API_KEY|CREDENTIAL/.test(m[1])) envViolations.push({ file: f, key: m[1] });
  }
}

// ---- 2. client bundles -----------------------------------------------------------
const bundleDirs = [];
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--bundle') bundleDirs.push(process.argv[++i]);
if (!bundleDirs.length) bundleDirs.push('dist');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const bundles = [];
for (const dir of bundleDirs) {
  const abs = join(root, dir);
  if (!existsSync(abs)) {
    bundles.push({ dir, scanned: false, reason: 'not built' });
    continue;
  }
  const files = walk(abs).filter((p) => /\.(js|mjs|css|html|json|map|txt)$/.test(p));
  const hits = [];
  const markers = [];
  for (const p of files) {
    const text = readFileSync(p, 'utf8');
    hits.push(...scanText(text, relative(root, p).split('\\').join('/'), 'bundle'));
    // Server-only identifiers must never be referenced by the browser bundle.
    for (const marker of ['RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'private_key', 'firebase-admin']) {
      if (text.includes(marker)) markers.push({ file: relative(root, p).split('\\').join('/'), marker });
    }
  }
  bundles.push({ dir, scanned: true, files: files.length, hits, serverOnlyMarkers: markers });
}

// ---- 3. git history ----------------------------------------------------------------
const history = [];
const log = git('log', '--all', '-p', '--no-color', '--unified=0', '--format=__COMMIT__ %H %ad', '--date=short');
let commit = '';
let file = '';
for (const line of log.split('\n')) {
  if (line.startsWith('__COMMIT__ ')) commit = line.slice(11, 30);
  else if (line.startsWith('+++ b/')) file = line.slice(6);
  else if (line.startsWith('+') && !line.startsWith('+++')) {
    if (BINARY.test(file)) continue;
    for (const h of scanText(line, file, 'history')) {
      if (h.id === 'FIREBASE_WEB_KEY_OUTSIDE_CONFIG') continue;
      history.push({ ...h, commit });
    }
  }
}
const uniqueHistory = [...new Map(history.map((h) => [`${h.id}|${h.file}|${h.sample}`, h])).values()];

// ---- server secrets ----------------------------------------------------------------
const configTs = readFileSync(join(root, 'functions/src/shared/config.ts'), 'utf8');
const serverSecrets = ['RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].map((name) => ({
  name,
  mechanism: 'Cloud Secret Manager (firebase-functions defineSecret)',
  declaredAsSecret: configTs.includes(`defineSecret('${name}')`),
}));

const sourceFail = sourceHits.length + forbiddenTracked.length + envViolations.length;
const bundleFail = bundles.reduce((n, b) => n + (b.hits?.length || 0) + (b.serverOnlyMarkers?.length || 0), 0);
const report = {
  schema: 'dsbc.directive27.secretsAudit/v1',
  generatedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD').trim(),
  publicIdentifiers: {
    firebaseWebApiKey: `${FIREBASE_WEB_API_KEY.slice(0, 6)}… (public by design; allowed only in ${PUBLIC_IDENTIFIERS.join(', ')} and the client bundle)`,
  },
  source: { trackedFiles: tracked.length, verdict: sourceFail ? 'FAIL' : 'PASS', hits: sourceHits, forbiddenTracked, envFileViolations: envViolations },
  clientBundles: { verdict: bundleFail ? 'FAIL' : bundles.every((b) => b.scanned) ? 'PASS' : 'INCOMPLETE', bundles },
  gitHistory: { verdict: uniqueHistory.length ? 'INVESTIGATE' : 'PASS', findings: uniqueHistory },
  serverSecrets: { verdict: serverSecrets.every((s) => s.declaredAsSecret) ? 'PASS' : 'FAIL', secrets: serverSecrets },
};
report.status = report.source.verdict === 'PASS' && report.clientBundles.verdict === 'PASS' && report.serverSecrets.verdict === 'PASS' ? 'PASS' : 'FAIL';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(`secrets audit: ${report.status} (source ${report.source.verdict}, bundles ${report.clientBundles.verdict}, history ${report.gitHistory.verdict}, server ${report.serverSecrets.verdict})`);
for (const h of [...sourceHits, ...bundles.flatMap((b) => [...(b.hits || []), ...(b.serverOnlyMarkers || [])])]) console.log('  FAIL', JSON.stringify(h));
for (const h of uniqueHistory) console.log('  INVESTIGATE', JSON.stringify(h));
process.exit(report.status === 'PASS' ? 0 : 1);
