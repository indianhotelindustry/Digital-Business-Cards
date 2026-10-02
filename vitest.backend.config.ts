import { defineConfig } from 'vitest/config';

// Backend-authority tests (Directive 25 Phase 13): Cloud Functions + Auth +
// Firestore + Storage emulators, project demo-dsbc. Never a real project.
//   npm run test:backend
export default defineConfig({
  test: {
    include: ['tests/backend/**/*.test.ts'],
    environment: 'node',
    // Some tests call several functions for the first time; each first call
    // starts an emulator worker (seconds on Windows). Timing only, not logic.
    testTimeout: 180000,
    hookTimeout: 120000,
    // One emulator suite, one shared world per file: run files sequentially.
    fileParallelism: false,
    // Client modules loaded by AUTH-019/020 talk to the emulators, never the live project.
    env: { VITE_DSBC_USE_EMULATORS: 'true' },
  },
});
