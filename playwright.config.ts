import { defineConfig } from '@playwright/test';

// Directive 26 Phase 10 — production-like browser test.
// The app is the PRODUCTION build (no demo personas) wired to the Firebase
// Emulator Suite, served by `vite preview`. Run through
//   node scripts/directive26/runBrowserTests.mjs
// which builds the app, starts the emulators and then this config.
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: process.env.DSBC_BROWSER_OUT || 'docs/directive-26/evidence/browser/results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/e2e',
  webServer: {
    command: `npx vite preview --outDir dist-e2e --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
