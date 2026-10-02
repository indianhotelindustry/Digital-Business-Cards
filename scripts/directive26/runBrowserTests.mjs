// Directive 26 Phase 10 — production-like browser test runner.
//   node scripts/directive26/runBrowserTests.mjs [extra playwright args]
// 1. builds the Cloud Functions bundle;
// 2. builds the PRODUCTION app (no demo personas) wired to the emulators
//    (VITE_DSBC_USE_EMULATORS=true) into dist-e2e/;
// 3. starts Auth, Firestore, Functions and Storage emulators (demo-dsbc) and
//    runs Playwright against `vite preview` in real Chrome.
// Nothing here can reach a real Firebase project.
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = join(root, 'node_modules', '.bin');
const env = {
  ...process.env,
  PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '120',
};
const run = (cmd, args, extraEnv = {}) =>
  spawnSync(cmd, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit', shell: process.platform === 'win32' });

mkdirSync(join(root, 'docs/directive-26/evidence/browser'), { recursive: true });
let r = run('node', ['scripts/directive25/prepareEmulatorSecrets.mjs']);
if (r.status !== 0) process.exit(r.status ?? 1);
r = run('npm', ['--prefix', 'functions', 'run', 'build']);
if (r.status !== 0) process.exit(r.status ?? 1);
r = run('npx', ['vite', 'build', '--outDir', 'dist-e2e', '--emptyOutDir'], { VITE_DSBC_USE_EMULATORS: 'true' });
if (r.status !== 0) process.exit(r.status ?? 1);
const pw = ['playwright', 'test', ...process.argv.slice(2)].join(' ');
r = run('firebase', ['emulators:exec', '--only', 'auth,firestore,functions,storage', '--project', 'demo-dsbc', `"${pw}"`]);
process.exit(r.status ?? 1);
