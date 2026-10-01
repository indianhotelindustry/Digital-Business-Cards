// Directive 24 / Phase 0 — machine-readable baseline report generator.
//
// Every value is read from the frozen baseline commit (not the working tree),
// so the report describes the codebase exactly as it was before Directive 24.
// Build/typecheck results are passed in from commands actually executed.
//
// Usage:
//   node scripts/directive24/generateBaselineReport.mjs <baselineSha> <tscExit> <buildExit> <buildBundleLine>

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const [baselineSha, tscExit, buildExit, buildBundleLine = ''] = process.argv.slice(2);
if (!baselineSha || tscExit === undefined || buildExit === undefined) {
  console.error('usage: generateBaselineReport.mjs <baselineSha> <tscExit> <buildExit> [bundleLine]');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const show = (path) => git('show', `${baselineSha}:${path}`);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const files = git('ls-tree', '-r', '--name-only', baselineSha).split('\n').filter(Boolean);
const pkg = JSON.parse(show('package.json'));
const lock = show('bun.lock');

const resolved = (name) => {
  const escaped = name.replace(/[/.]/g, (c) => `\\${c}`);
  const m = lock.match(new RegExp(`^    "${escaped}": \\["${escaped}@([^"]+)"`, 'm'));
  return m ? m[1] : null;
};
const depTable = (deps) =>
  Object.fromEntries(Object.entries(deps || {}).map(([n, range]) => [n, { range, resolved: resolved(n) }]));

const firestoreRules = show('firestore.rules');
const storageRules = show('storage.rules');
const rulesLines = firestoreRules.split('\n');
const bootstrapLines = rulesLines
  .map((l, i) => ({ line: i + 1, text: l.trim() }))
  .filter((l) => l.text.includes('company_acme'));
const ownerEmails = [...new Set([...firestoreRules.matchAll(/token\.email == '([^']+)'/g)].map((m) => m[1]))];
const matchBlocks = [...firestoreRules.matchAll(/match \/([a-zA-Z]+)\/\{/g)].map((m) => m[1]);

const servicePaths = files.filter((f) => f.startsWith('src/services/') && f.endsWith('.ts'));
const localStorageServices = servicePaths
  .map((path) => {
    const src = show(path);
    const keys = [...new Set([...src.matchAll(/['"`](dsbc_[a-z0-9_]+|dbc_[a-z0-9_]+)['"`]/g)].map((m) => m[1]))];
    const uses = (src.match(/localStorage\./g) || []).length;
    const firestoreUses = (src.match(/\b(getDoc|getDocs|setDoc|addDoc|updateDoc|deleteDoc|onSnapshot)\(/g) || []).length;
    return { path, localStorageCalls: uses, storageKeys: keys, firestoreCalls: firestoreUses };
  })
  .filter((s) => s.localStorageCalls > 0);

const testArtefacts = [
  {
    path: 'scripts/verifyRules.ts',
    declaredTests: (show('scripts/verifyRules.ts').match(/\/\/ \d+\. /g) || []).length,
    target: 'LIVE Firebase project v-nexus-lite (no emulator)',
    authenticatedIdentities: false,
    networkErrorCountsAsPass: true,
    executedInBaseline: false,
  },
  {
    path: 'src/components/security/SecurityTestRunnerModal.tsx',
    declaredTests: (show('src/components/security/SecurityTestRunnerModal.tsx').match(/^\s+id: '[A-Z]+-[0-9A-Z-]+',$/gm) || []).length,
    target: 'Browser; mixes live Firestore writes and localStorage-only checks',
    labelledExecutionType: 'LIVE_FIRESTORE_SDK (all tests)',
    containsTautologicalTests: true,
    executedInBaseline: false,
  },
];

const report = {
  schema: 'dsbc.directive24.baseline/v1',
  generatedAt: new Date().toISOString(),
  baseline: { commit: git('rev-parse', baselineSha).trim(), branch: 'main', fileCount: files.length },
  toolchain: { node: process.version },
  packages: {
    name: pkg.name,
    version: pkg.version,
    scripts: pkg.scripts,
    dependencies: depTable(pkg.dependencies),
    devDependencies: depTable(pkg.devDependencies),
    lockfile: { path: 'bun.lock', sha256: sha256(lock) },
  },
  results: {
    typecheck: { command: 'node node_modules/typescript/bin/tsc --noEmit', exitCode: Number(tscExit), errors: Number(tscExit) === 0 ? 0 : null },
    lint: { command: 'npm run lint', note: 'lint script is "tsc --noEmit"; no ESLint configured', realLinter: false },
    build: { command: 'node node_modules/vite/bin/vite.js build', exitCode: Number(buildExit), mainBundle: buildBundleLine.trim(), warnings: ['single JS chunk > 500 kB'] },
    automatedTestRunner: null,
  },
  testArtefacts,
  firebase: {
    clientConfigSource: 'hard-coded in src/lib/firebase.ts and firebase-applet-config.json',
    projectId: 'v-nexus-lite',
    firestoreDatabaseId: 'ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5',
    perEnvironmentConfig: false,
    environmentConfigTsReportsProduction: { projectId: 'dsbc-production', wiredToClient: false },
    firebaseRc: files.includes('.firebaserc'),
    functions: files.some((f) => f.startsWith('functions/')),
    indexesDefined: JSON.parse(show('firestore.indexes.json')).indexes.length,
  },
  firestoreRules: {
    path: 'firestore.rules',
    sha256: sha256(firestoreRules),
    lines: rulesLines.length,
    collections: matchBlocks,
    appOwnerEmailAllowList: ownerEmails,
    appOwnerChecksEmailVerified: firestoreRules.includes('email_verified'),
    bootstrapBackdoorLineCount: bootstrapLines.length,
    bootstrapBackdoorLines: bootstrapLines,
  },
  storageRules: {
    path: 'storage.rules',
    sha256: sha256(storageRules),
    tenantScopedWrites: false,
    note: 'any authenticated user may write companies/{anyCompany}/branding/** and companies/{anyCompany}/employees/**',
  },
  localStorageBackedServices: localStorageServices,
  externalIntegrations: [
    { name: 'Razorpay', status: 'SIMULATED', evidence: 'src/services/paymentProvider.ts (format-only signature checks, hard-coded webhook secret line 30)' },
    { name: 'Email/notifications', status: 'SIMULATED', evidence: 'src/services/notificationService.ts DefaultNotificationAdapter marks SENT without delivery' },
    { name: 'Gemini/AI', status: 'SIMULATED', evidence: 'src/services/aiProviderService.ts MockAIProvider; @google/genai unused; no UI caller' },
    { name: 'Backend (Functions/Cloud Run)', status: 'ABSENT', evidence: 'no functions/ or server code' },
    { name: 'Firebase Auth', status: 'REAL (optional)', evidence: 'demo personas bypass it' },
    { name: 'Cloud Firestore', status: 'REAL', evidence: 'tenant data only; commercial state in localStorage' },
    { name: 'Cloud Storage', status: 'REAL', evidence: 'src/services/storageService.ts' },
  ],
  knownSecurityFindings: [
    { id: 'SEC-01', severity: 'CRITICAL', title: 'Self-assignable company_admin/companyId at registration', evidence: ['firestore.rules:49-58', 'src/services/authService.ts registerWithEmail(role, companyId)'] },
    { id: 'SEC-02', severity: 'CRITICAL', title: 'Bootstrap backdoor: !exists(companies/company_acme) grants unauthenticated writes', evidence: bootstrapLines.map((l) => `firestore.rules:${l.line}`) },
    { id: 'SEC-03', severity: 'CRITICAL', title: 'App Owner granted by email string without email_verified', evidence: ['firestore.rules:14-21'] },
    { id: 'SEC-04', severity: 'CRITICAL', title: 'App Owner UI reachable by any visitor via demo persona switch; default visitor persona is Acme company_admin', evidence: ['src/components/navigation/Header.tsx:220', 'src/context/AuthContext.tsx:111-115'] },
    { id: 'SEC-05', severity: 'CRITICAL', title: 'Commercial authority (plans, subscriptions, entitlements, payments) in client localStorage', evidence: localStorageServices.map((s) => s.path) },
    { id: 'SEC-06', severity: 'CRITICAL', title: 'Client-side upgrade marks PAID without payment; webhook secret shipped in bundle', evidence: ['src/services/subscriptionService.ts:433', 'src/services/paymentProvider.ts:30'] },
    { id: 'SEC-07', severity: 'HIGH', title: 'Storage rules allow cross-tenant writes', evidence: ['storage.rules'] },
    { id: 'SEC-08', severity: 'HIGH', title: 'Live security tests (writes to live DB) exposed to all visitors', evidence: ['src/components/navigation/Header.tsx:164-172'] },
    { id: 'SEC-09', severity: 'MEDIUM', title: 'Unauthenticated connectionEvents creation (timeline injection)', evidence: ['firestore.rules:311-313'] },
    { id: 'SEC-10', severity: 'HIGH', title: 'Registration fabricates a signed-in profile when Firebase sign-up fails', evidence: ['src/components/auth/AuthModal.tsx:74-89', 'src/components/auth/CustomerRegistrationModal.tsx:91-105'] },
    { id: 'SEC-11', severity: 'HIGH', title: 'Client auto-seeds demo tenants into Firestore on app load in every environment', evidence: ['src/context/AuthContext.tsx:94-99'] },
    { id: 'SEC-12', severity: 'MEDIUM', title: 'Users may change their own status field (self-unsuspend)', evidence: ['firestore.rules:60-66'] },
  ],
};

mkdirSync('docs/directive-24', { recursive: true });
writeFileSync('docs/directive-24/phase-0-baseline.json', JSON.stringify(report, null, 2) + '\n');
console.log(`wrote docs/directive-24/phase-0-baseline.json (${files.length} files, ${bootstrapLines.length} bootstrap lines, ${localStorageServices.length} localStorage services)`);
