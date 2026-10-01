import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Must run inside the Firebase Emulator Suite:
//   npm run test:rules
// They never touch a real Firebase project (project id is "demo-*").
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    // Files share one emulator; run them one at a time so fixtures don't race.
    fileParallelism: false,
  },
});
