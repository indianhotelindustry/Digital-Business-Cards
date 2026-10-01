import { defineConfig } from 'vitest/config';

// Integration tests: Admin SDK scripts against the Auth + Firestore emulators.
//   npm run test:integration
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
