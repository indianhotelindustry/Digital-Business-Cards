// Bundles functions/src (plus the shared domain in ../shared) into lib/index.js.
// firebase-admin / firebase-functions stay external and are installed from
// functions/package.json at deploy time.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'],
  logLevel: 'info',
});
