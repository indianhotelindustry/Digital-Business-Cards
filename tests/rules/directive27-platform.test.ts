// Directive 27: platform configuration and the customer-migration ledger are
// Admin-SDK-only. No browser identity (App Owner included) may create, change
// or delete them; only a verified App Owner may read them.
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createRulesEnv, dbFor, ID, type Identity } from './support/rulesEnv';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createRulesEnv('d27-platform');
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'platformConfig', 'deployment'), { bootstrapVersion: 1, paymentsEnabled: false, reservedSlugs: ['admin'] });
    await setDoc(doc(db, 'platformConfig', 'reconciliation'), { examined: 3, changed: 0 });
    await setDoc(doc(db, 'migrationRuns', 'run_1'), { runId: 'run_1', status: 'COMPLETED', results: [] });
  });
});
afterAll(async () => env?.cleanup());

const everyone: Identity[] = Object.values(ID);
const writers: Array<[string, (db: ReturnType<typeof dbFor>) => Promise<unknown>]> = [
  ['create platformConfig', (db) => setDoc(doc(db, 'platformConfig', 'evil'), { paymentsEnabled: true })],
  ['overwrite deployment config', (db) => setDoc(doc(db, 'platformConfig', 'deployment'), { paymentsEnabled: true, reservedSlugs: [] })],
  ['update deployment config', (db) => updateDoc(doc(db, 'platformConfig', 'deployment'), { paymentsEnabled: true })],
  ['fake a reconciler heartbeat', (db) => setDoc(doc(db, 'platformConfig', 'reconciliation'), { lastRunAt: new Date() })],
  ['delete deployment config', (db) => deleteDoc(doc(db, 'platformConfig', 'deployment'))],
  ['forge a migration run', (db) => setDoc(doc(db, 'migrationRuns', 'run_forged'), { status: 'COMPLETED' })],
  ['rewrite a migration run', (db) => updateDoc(doc(db, 'migrationRuns', 'run_1'), { results: [{ outcome: 'GRANTED_COMPLIMENTARY' }] })],
  ['delete a migration run', (db) => deleteDoc(doc(db, 'migrationRuns', 'run_1'))],
];

describe('D27 RULES: platform configuration and migration ledger', () => {
  for (const who of everyone) {
    for (const [label, op] of writers) {
      it(`${who.label} cannot ${label}`, async () => {
        await assertFails(op(dbFor(env, who)));
      });
    }
  }

  it('the verified App Owner can read platform configuration and migration runs', async () => {
    const db = dbFor(env, ID.appOwner);
    await assertSucceeds(getDoc(doc(db, 'platformConfig', 'deployment')));
    await assertSucceeds(getDoc(doc(db, 'migrationRuns', 'run_1')));
  });

  for (const who of everyone.filter((w) => w !== ID.appOwner)) {
    it(`${who.label} cannot read platform configuration or migration runs`, async () => {
      const db = dbFor(env, who);
      await assertFails(getDoc(doc(db, 'platformConfig', 'deployment')));
      await assertFails(getDoc(doc(db, 'migrationRuns', 'run_1')));
    });
  }
});
