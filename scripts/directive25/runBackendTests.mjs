// Runs the Directive 25 backend-authority suite inside the Firebase Emulator
// Suite (project demo-dsbc: Auth, Firestore, Cloud Functions, Storage).
//   node scripts/directive25/runBackendTests.mjs [extra vitest args...]
// Exit code is vitest's. Nothing here can reach a real Firebase project.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = join(root, 'node_modules', '.bin');
const env = {
  ...process.env,
  PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  // Windows process start-up in paths with spaces can exceed the 10 s default.
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '120',
};

const vitestArgs = ['vitest', 'run', '--config', 'vitest.backend.config.ts', ...process.argv.slice(2)]
  .map((a) => (/\s/.test(a) ? `'${a}'` : a))
  .join(' ');

const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });

let r = run('node', ['scripts/directive25/prepareEmulatorSecrets.mjs']);
if (r.status !== 0) process.exit(r.status ?? 1);
r = run('npm', ['--prefix', 'functions', 'run', 'build']);
if (r.status !== 0) process.exit(r.status ?? 1);
r = run('firebase', ['emulators:exec', '--only', 'auth,firestore,functions,storage', '--project', 'demo-dsbc', `"${vitestArgs}"`]);
process.exit(r.status ?? 1);
