import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {copyFileSync} from 'fs';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {resolveEnvironment} from './src/lib/environmentResolver';

export default defineConfig(({command, mode}) => {
  // Directive 27: a bundle is built for exactly one designated environment,
  // chosen by the committed .env.<mode> file (VITE_DSBC_ENV). A missing,
  // unknown or undesignated environment fails the build here, and the
  // production build may not be pointed at the emulators.
  const env = {...loadEnv(mode, process.cwd(), 'VITE_DSBC_'), ...pickDsbc(process.env)};
  const target = resolveEnvironment(env);
  if (command === 'build') {
    console.log(`[dsbc] building for ${target.environment}: ${target.firebase.projectId} / ${target.firestoreDatabaseId || '(default)'}${target.useEmulators ? ' [emulators]' : ''}`);
  }
  return {
    plugins: [react(), tailwindcss(), notFoundPage()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

function pickDsbc(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(source).filter((e): e is [string, string] => e[0].startsWith('VITE_DSBC_') && typeof e[1] === 'string'));
}

/**
 * Directive 27 Phase 5: Firebase Hosting answers paths that are neither files
 * nor public routes (firebase.production.json rewrites) with 404.html and HTTP
 * 404. Emitting the app shell as 404.html lets that response still render the
 * in-app "Page not found" view.
 */
function notFoundPage(): Plugin {
  let outDir = 'dist';
  return {
    name: 'dsbc-404-page',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}
