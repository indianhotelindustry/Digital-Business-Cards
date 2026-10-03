// Integration: App Owner grant/revoke and controlled demo bootstrap, executed
// with the real Admin SDK against the Auth + Firestore emulators
// (npm run test:integration). Never touches a real project.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { setAppOwner, APP_OWNER_CLAIM } from '../../scripts/admin/setAppOwner';
import { seedDemoData } from '../../scripts/admin/seedDemoData';

let app: App;
let auth: Auth;
let db: Firestore;
const PROJECT = 'demo-dsbc';

async function clearEmulators() {
  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const r1 = await fetch(`http://${fsHost}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const r2 = await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  if (!r1.ok || !r2.ok) throw new Error(`Failed to clear emulators (${r1.status}/${r2.status})`);
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Integration tests require the Auth and Firestore emulators (npm run test:integration).');
  }
  app = initializeApp({ projectId: PROJECT }, 'integration');
  auth = getAuth(app);
  db = getFirestore(app);
});
afterAll(async () => app && deleteApp(app));
beforeEach(clearEmulators);

describe('setAppOwner (Phase 2 authoritative App Owner mechanism)', () => {
  it('grants the claim, records the profile role and writes a security audit entry', async () => {
    const user = await auth.createUser({ email: 'owner@dsbc.test', emailVerified: true, password: 'secret123' });
    const result = await setAppOwner({ auth, db, email: 'owner@dsbc.test', actor: 'test', projectId: PROJECT });

    expect(result.action).toBe('APP_OWNER_GRANTED');
    expect((await auth.getUser(user.uid)).customClaims?.[APP_OWNER_CLAIM]).toBe('app_owner');
    expect((await db.collection('users').doc(user.uid).get()).data()?.role).toBe('app_owner');
    const audit = await db.collection('securityAuditLogs').where('targetUid', '==', user.uid).get();
    expect(audit.docs.map((d) => d.data().action)).toEqual(['APP_OWNER_GRANTED']);
  });

  it('REG-owner: marks a pre-existing pending_approval profile active on grant', async () => {
    const user = await auth.createUser({ email: 'pending-owner@dsbc.test', emailVerified: true, password: 'secret123' });
    await db.collection('users').doc(user.uid).set({
      id: user.uid, email: 'pending-owner@dsbc.test', displayName: 'Pending Owner',
      role: 'company_owner', companyId: null, employeeId: null,
      status: 'pending_approval', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await setAppOwner({ auth, db, uid: user.uid, actor: 'test', projectId: PROJECT });
    const profile = (await db.collection('users').doc(user.uid).get()).data();
    expect(profile?.role).toBe('app_owner');
    expect(profile?.status).toBe('active');
  });

  it('REG-owner: a brand-new owner profile is created active', async () => {
    const user = await auth.createUser({ email: 'fresh-owner@dsbc.test', emailVerified: true, password: 'secret123' });
    await setAppOwner({ auth, db, uid: user.uid, actor: 'test', projectId: PROJECT });
    const profile = (await db.collection('users').doc(user.uid).get()).data();
    expect(profile?.role).toBe('app_owner');
    expect(profile?.status).toBe('active');
  });

  it('refuses an identity whose email is not verified', async () => {
    const user = await auth.createUser({ email: 'unverified@dsbc.test', emailVerified: false, password: 'secret123' });
    await expect(setAppOwner({ auth, db, uid: user.uid, actor: 'test', projectId: PROJECT })).rejects.toThrow(/not verified/);
    expect((await auth.getUser(user.uid)).customClaims?.[APP_OWNER_CLAIM]).toBeUndefined();
    expect((await db.collection('users').doc(user.uid).get()).exists).toBe(false);
  });

  it('preserves unrelated claims and revokes cleanly', async () => {
    const user = await auth.createUser({ email: 'owner2@dsbc.test', emailVerified: true, password: 'secret123' });
    await auth.setCustomUserClaims(user.uid, { betaTester: true });
    await setAppOwner({ auth, db, uid: user.uid, actor: 'test', projectId: PROJECT });
    expect((await auth.getUser(user.uid)).customClaims).toEqual({ betaTester: true, platformRole: 'app_owner' });

    const revoked = await setAppOwner({ auth, db, uid: user.uid, revoke: true, actor: 'test', projectId: PROJECT });
    expect(revoked.action).toBe('APP_OWNER_REVOKED');
    expect((await auth.getUser(user.uid)).customClaims).toEqual({ betaTester: true });
  });

  it('fails for an unknown account instead of creating one', async () => {
    await expect(setAppOwner({ auth, db, email: 'nobody@dsbc.test', actor: 'test', projectId: PROJECT })).rejects.toThrow();
  });
});

describe('seedDemoData (Phase 3 controlled bootstrap)', () => {
  it('writes the demo tenants through the Admin SDK', async () => {
    const result = await seedDemoData(db);
    expect(result.success).toBe(true);
    expect(result.documents).toBeGreaterThan(20);
    expect((await db.collection('companies').doc('company_acme').get()).exists).toBe(true);
    expect((await db.collection('companies').doc('company_nexus').get()).exists).toBe(true);
  });

  it('does not grant any App Owner claim (demo owner profile is not authority)', async () => {
    await seedDemoData(db);
    const owners = await db.collection('users').where('role', '==', 'app_owner').get();
    expect(owners.size).toBeGreaterThan(0); // demo profile exists...
    const list = await auth.listUsers();
    expect(list.users.filter((u) => u.customClaims?.[APP_OWNER_CLAIM])).toHaveLength(0); // ...but no claim anywhere
  });
});
