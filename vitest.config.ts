import { defineConfig } from 'vitest/config';

// Unit tests: pure logic only, no network, no emulator.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
