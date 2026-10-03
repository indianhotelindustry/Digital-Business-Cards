import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('REG-leak uploads.ts does not interpolate raw error into client message', () => {
  const src = readFileSync('functions/src/usage/uploads.ts', 'utf8');
  expect(src).not.toMatch(/Upload failed: \$\{/);
  expect(src).toMatch(/fail\('internal', 'Upload failed\.'\)/);
});
