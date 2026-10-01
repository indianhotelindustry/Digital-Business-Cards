// Harness integrity: proves this suite cannot report PASS for a test that did
// not actually exercise the rules (Directive 24 Phase 16/17 requirement that a
// network or execution error is never counted as a security PASS).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { createRulesEnv, dbFor, fullWorld, ID, loadFixtures, RULES_FILE } from './support/rulesEnv';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createRulesEnv('harness');
  await loadFixtures(env, fullWorld());
});
afterAll(async () => env?.cleanup());

describe('harness integrity', () => {
  it('reports which rules file is under test', () => {
    expect(RULES_FILE.endsWith('.rules')).toBe(true);
  });

  it('assertFails does NOT pass on a network/unavailable error', async () => {
    const networkError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8180'), { code: 'unavailable' });
    await expect(assertFails(Promise.reject(networkError))).rejects.toThrow(/unexpected error/);
  });

  it('assertFails does NOT pass when the operation succeeds', async () => {
    await expect(assertFails(Promise.resolve('ok'))).rejects.toThrow(/succeeded/);
  });

  it('emulator is reachable and evaluates rules (positive control)', async () => {
    await assertSucceeds(getDoc(doc(dbFor(env, ID.adminA), 'users', 'uid_admin_a')));
  });
});
