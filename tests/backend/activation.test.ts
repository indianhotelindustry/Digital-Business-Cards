// Directive 30 Task 5 — customer activation gate (emulator).
// REG-010 .. REG-021, REG-033
import { beforeAll, describe, expect, it } from 'vitest';
import { PRODUCTION_TARGET, parseArgs, resolveAdminTarget } from '../../scripts/admin/adminTarget';
import { adminAuth, adminDb, call, createUser, eventually, ok, seedWorld, sleep, type TestUser, type World } from './support/backendEnv';

let w: World;

async function seedPending(uid: string, opts: { verified?: boolean; company?: boolean; status?: string } = {}): Promise<TestUser> {
  const user = await createUser(uid, { verified: opts.verified ?? true });
  const now = new Date().toISOString();
  const status = opts.status ?? 'pending_approval';
  const base = { id: uid, uid, email: user.email, displayName: `Name ${uid}`, status, createdAt: now, updatedAt: now };
  if (opts.company) {
    const companyId = `co_${uid}`;
    await adminDb.doc(`users/${uid}`).set({ ...base, role: 'company_admin', accountType: 'company', companyId, tenantId: companyId });
    await adminDb.doc(`companies/${companyId}`).set({ id: companyId, name: `Company ${uid}`, status, kind: 'company', ownerUid: uid, createdAt: now, updatedAt: now });
    await adminDb.doc(`tenants/${companyId}`).set({ id: companyId, status });
  } else {
    await adminDb.doc(`users/${uid}`).set({ ...base, role: 'employee', accountType: 'individual', companyId: null, tenantId: `ind_${uid}` });
    await adminDb.doc(`tenants/ind_${uid}`).set({ id: `ind_${uid}`, status });
  }
  return user;
}

const approve = (who: TestUser, data: Record<string, unknown>) => call('approveCustomer', data, who);
const countOf = async (collection: string) => (await adminDb.collection(collection).get()).size;
const activationAudits = async (targetId: string) =>
  (await adminDb.collection('commercialAuditLogs').where('action', '==', 'ACCOUNT_ACTIVATED').where('targetId', '==', targetId).get()).docs.map((d) => d.data());

beforeAll(async () => {
  w = await seedWorld();
});

describe('REG: approveCustomer authority', () => {
  it('REG-010 a non-App-Owner (the customer itself) cannot approve', async () => {
    const cust = await seedPending('c10');
    const r = await approve(cust, { customerType: 'individual', customerId: 'c10', reason: 'self approve' });
    expect(r.status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc('users/c10').get()).get('status')).toBe('pending_approval');
  });

  it('REG-010b a company admin cannot approve another customer', async () => {
    await seedPending('c10b');
    const r = await approve(w.adminA, { customerType: 'individual', customerId: 'c10b', reason: 'x' });
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('REG-011 an unverified App Owner cannot approve', async () => {
    await seedPending('c11');
    const r = await approve(w.unverifiedOwner, { customerType: 'individual', customerId: 'c11', reason: 'x' });
    expect(r.status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc('users/c11').get()).get('status')).toBe('pending_approval');
  });

  it('REG-011b an unauthenticated caller cannot approve', async () => {
    const r = await call('approveCustomer', { customerType: 'individual', customerId: 'c11', reason: 'x' }, null);
    expect(r.status).toBe('UNAUTHENTICATED');
  });
});

describe('REG: approveCustomer behaviour', () => {
  it('REG-033 refuses an account whose email is not verified', async () => {
    await seedPending('c33', { verified: false });
    const r = await approve(w.owner, { customerType: 'individual', customerId: 'c33', reason: 'x' });
    expect(r.ok).toBe(false);
    expect(r.status).toBe('FAILED_PRECONDITION');
    expect(r.message).toContain('EMAIL_NOT_VERIFIED');
    expect((await adminDb.doc('users/c33').get()).get('status')).toBe('pending_approval');
    expect(await activationAudits('c33')).toHaveLength(0);
  });

  it('REG-033b refuses a disabled Auth account', async () => {
    await seedPending('c33b');
    await adminAuth.updateUser('c33b', { disabled: true });
    const r = await approve(w.owner, { customerType: 'individual', customerId: 'c33b', reason: 'x' });
    expect(r.status).toBe('FAILED_PRECONDITION');
    expect(r.message).toContain('ACCOUNT_DISABLED');
    expect((await adminDb.doc('users/c33b').get()).get('status')).toBe('pending_approval');
  });

  it('REG-013/020 a verified pending individual is activated (user + tenant)', async () => {
    await seedPending('c13');
    const res = await ok('approveCustomer', { customerType: 'individual', customerId: 'c13', reason: 'verified real customer' }, w.owner);
    expect(res).toMatchObject({ customerType: 'individual', customerId: 'c13', status: 'active', alreadyActive: false });
    expect((await adminDb.doc('users/c13').get()).get('status')).toBe('active');
    expect((await adminDb.doc('tenants/ind_c13').get()).get('status')).toBe('active');
  });

  it('REG-013b a verified pending company is activated (user + tenant + company)', async () => {
    await seedPending('c13c', { company: true });
    const res = await ok('approveCustomer', { customerType: 'company', customerId: 'co_c13c', reason: 'verified company' }, w.owner);
    expect(res).toMatchObject({ customerType: 'company', customerId: 'co_c13c', status: 'active', alreadyActive: false });
    expect((await adminDb.doc('users/c13c').get()).get('status')).toBe('active');
    expect((await adminDb.doc('tenants/co_c13c').get()).get('status')).toBe('active');
    expect((await adminDb.doc('companies/co_c13c').get()).get('status')).toBe('active');
  });

  it('REG-014 approval requires a reason', async () => {
    await seedPending('c14');
    const r = await approve(w.owner, { customerType: 'individual', customerId: 'c14' });
    expect(r.status).toBe('INVALID_ARGUMENT');
    expect((await adminDb.doc('users/c14').get()).get('status')).toBe('pending_approval');
  });

  it('REG-014b unknown payload fields are rejected', async () => {
    await seedPending('c14b');
    const r = await approve(w.owner, { customerType: 'individual', customerId: 'c14b', reason: 'x', status: 'active' });
    expect(r.status).toBe('INVALID_ARGUMENT');
  });

  it('REG-015 approval writes an immutable ACCOUNT_ACTIVATED audit record', async () => {
    await seedPending('c15');
    await ok('approveCustomer', { customerType: 'individual', customerId: 'c15', reason: 'ok' }, w.owner);
    const logs = await activationAudits('c15');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'ACCOUNT_ACTIVATED',
      actor: { uid: w.owner.uid, role: 'app_owner' },
      targetType: 'individual',
      targetId: 'c15',
      tenantId: 'ind_c15',
      reason: 'ok',
      previousValue: { status: 'pending_approval' },
      newValue: { status: 'active' },
      source: 'App Owner Activation',
    });
    expect(typeof logs[0].contentHash).toBe('string');
  });

  it('REG-016/017/018/019 approval is idempotent: no second write, no duplicate or commercial records', async () => {
    await seedPending('c16', { company: true });
    const first = await ok('approveCustomer', { customerType: 'company', customerId: 'co_c16', reason: 'ok' }, w.owner);
    expect(first.alreadyActive).toBe(false);

    const subs = await countOf('subscriptions');
    const overrides = await countOf('entitlementOverrides');
    const companies = await countOf('companies');
    const cards = await countOf('cards');
    const before = (await adminDb.doc('users/c16').get()).get('updatedAt');

    const second = await ok('approveCustomer', { customerType: 'company', customerId: 'co_c16', reason: 'again' }, w.owner);
    expect(second).toMatchObject({ status: 'active', alreadyActive: true });

    expect(await activationAudits('co_c16')).toHaveLength(1); // no second audit
    expect((await adminDb.doc('users/c16').get()).get('updatedAt')).toEqual(before); // no write
    expect(await countOf('subscriptions')).toBe(subs);
    expect(await countOf('entitlementOverrides')).toBe(overrides);
    expect(await countOf('companies')).toBe(companies);
    expect(await countOf('cards')).toBe(cards);
    expect((await adminDb.collection('subscriptions').where('customerId', '==', 'co_c16').get()).size).toBe(0);
  });

  it('REG-018 first approval creates no subscription, entitlement override or content', async () => {
    await seedPending('c18');
    const before = { s: await countOf('subscriptions'), o: await countOf('entitlementOverrides'), c: await countOf('cards'), e: await countOf('employees') };
    await ok('approveCustomer', { customerType: 'individual', customerId: 'c18', reason: 'ok' }, w.owner);
    expect({ s: await countOf('subscriptions'), o: await countOf('entitlementOverrides'), c: await countOf('cards'), e: await countOf('employees') }).toEqual(before);
  });

  it('suspended and cancelled accounts are not re-activated by approval', async () => {
    await seedPending('c_susp', { status: 'suspended' });
    await seedPending('c_canc', { status: 'cancelled' });
    for (const id of ['c_susp', 'c_canc']) {
      const r = await approve(w.owner, { customerType: 'individual', customerId: id, reason: 'x' });
      expect(r.status).toBe('FAILED_PRECONDITION');
    }
    expect((await adminDb.doc('users/c_susp').get()).get('status')).toBe('suspended');
    expect((await adminDb.doc('users/c_canc').get()).get('status')).toBe('cancelled');
  });

  it('an unknown customer is not-found', async () => {
    const r = await approve(w.owner, { customerType: 'individual', customerId: 'nobody_here', reason: 'x' });
    expect(r.status).toBe('NOT_FOUND');
  });
});

describe('REG: adminListPendingCustomers', () => {
  it('REG-012 a verified App Owner lists real pending customers with real fields', async () => {
    await seedPending('p_ind', { verified: true });
    await seedPending('p_co', { verified: false, company: true });
    await seedPending('p_active', { status: 'active' });
    const res = await ok('adminListPendingCustomers', {}, w.owner);
    const ids = res.pending.map((p: { uid: string }) => p.uid);
    expect(ids).toContain('p_ind');
    expect(ids).toContain('p_co');
    expect(ids).not.toContain('p_active');
    const ind = res.pending.find((p: { uid: string }) => p.uid === 'p_ind');
    expect(ind).toMatchObject({ uid: 'p_ind', displayName: 'Name p_ind', email: 'p_ind@dsbc.test', accountType: 'individual', companyName: null, emailVerified: true, status: 'pending_approval' });
    expect(typeof ind.createdAt).toBe('string');
    const co = res.pending.find((p: { uid: string }) => p.uid === 'p_co');
    expect(co).toMatchObject({ accountType: 'company', companyName: 'Company p_co', emailVerified: false, status: 'pending_approval' });
  });

  it('REG-012b a non-owner and an unverified owner cannot list', async () => {
    expect((await call('adminListPendingCustomers', {}, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('adminListPendingCustomers', {}, w.unverifiedOwner)).status).toBe('PERMISSION_DENIED');
  });
});

describe('REG: onUserCreated registration audit', () => {
  const registrationAudits = async (targetId: string) =>
    (await adminDb.collection('commercialAuditLogs').where('action', '==', 'ACCOUNT_REGISTERED').where('targetId', '==', targetId).get()).docs;

  it('REG-015b a new user doc yields exactly one ACCOUNT_REGISTERED audit, idempotent on re-create', async () => {
    await seedPending('newreg');
    const first = await eventually(() => registrationAudits('newreg'), (d) => d.length >= 1);
    expect(first).toHaveLength(1);
    expect(first[0].id).toBe('ACCOUNT_REGISTERED_newreg');
    expect(first[0].data()).toMatchObject({
      action: 'ACCOUNT_REGISTERED',
      actor: { uid: 'newreg', name: 'Name newreg', role: 'individual' },
      targetType: 'individual',
      targetId: 'newreg',
      tenantId: 'ind_newreg',
      previousValue: null,
      newValue: { status: 'pending_approval' },
      reason: 'Self-registration',
      source: 'Registration',
    });
    expect(typeof first[0].data().contentHash).toBe('string');

    // A later update does not fire onCreate; delete + re-create fires it again and must not duplicate.
    await adminDb.doc('users/newreg').update({ updatedAt: new Date().toISOString() });
    await adminDb.doc('users/newreg').delete();
    await adminDb.doc('users/newreg').set({ id: 'newreg', uid: 'newreg', displayName: 'Name newreg', status: 'pending_approval', accountType: 'individual', tenantId: 'ind_newreg' });
    await sleep(3000); // give the (guarded) second trigger delivery time to run
    expect(await registrationAudits('newreg')).toHaveLength(1);
  });
});

describe('REG: getMyAccountState', () => {
  it('REG-021 works for a pending user and leaks nothing else', async () => {
    const pend = await seedPending('c21');
    const res = await ok('getMyAccountState', {}, pend);
    expect(res).toEqual({ status: 'pending_approval', emailVerified: true });
  });

  it('REG-021b reports an unverified email truthfully', async () => {
    const pend = await seedPending('c21b', { verified: false });
    expect(await ok('getMyAccountState', {}, pend)).toEqual({ status: 'pending_approval', emailVerified: false });
  });

  it('REG-021c reports active after approval', async () => {
    const pend = await seedPending('c21c');
    await ok('approveCustomer', { customerType: 'individual', customerId: 'c21c', reason: 'ok' }, w.owner);
    expect(await ok('getMyAccountState', {}, pend)).toEqual({ status: 'active', emailVerified: true });
  });

  it('REG-021d requires sign-in', async () => {
    expect((await call('getMyAccountState', {}, null)).status).toBe('UNAUTHENTICATED');
  });
});

describe('REG: customer callables require an active account', () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 5)]).toString('base64');

  it('REG-007 a pending user cannot consumeQuota; an active user passes the gate', async () => {
    const pend = await seedPending('c07');
    const denied = await call('consumeQuota', { featureId: 'individual.ai_assistance', operationId: 'reg007_pending_op' }, pend);
    expect(denied.status).toBe('PERMISSION_DENIED');
    expect(await countOf('usageLedger')).toBe(0);
    // An active user clears the gate and reaches the (unentitled) quota check, not the activation denial.
    const active = await call('consumeQuota', { featureId: 'individual.ai_assistance', operationId: 'reg007_active_op' }, w.individual);
    expect(active.status).not.toBe('PERMISSION_DENIED');
    expect(active.message).toContain('QUOTA_EXCEEDED');
  });

  it('REG-008 a pending user cannot uploadAsset', async () => {
    const pend = await seedPending('c08');
    const r = await call('uploadAsset', { kind: 'individual_photo', dataBase64: PNG, fileName: 'p.png' }, pend);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('REG-008b a pending user cannot setPublishingState or setMyDeletionRequest', async () => {
    const pend = await seedPending('c08b');
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_x', state: 'PUBLISHED' }, pend)).status).toBe('PERMISSION_DENIED');
    expect((await call('setMyDeletionRequest', { requested: true }, pend)).status).toBe('PERMISSION_DENIED');
  });
});

describe('REG: data-safety and payment-gate regressions (Task 12)', () => {
  // REG-027/028 (bootstrap creates control-plane only, zero customer records) run on a
  // fresh emulator DB in tests/integration/productionOps.test.ts.

  it('REG-029 the demo seeder target guard refuses production-like and unconfirmed real projects', () => {
    const real: Record<string, string | undefined> = {}; // no FIRESTORE_EMULATOR_HOST: a real-project target
    const named = (project: string, extra: Record<string, string | boolean> = {}) =>
      parseArgs(['--project', project, '--confirm-project', project, '--database', '(default)', ...Object.entries(extra).flatMap(([k, v]) => (v === true ? [`--${k}`] : [`--${k}`, String(v)]))]);
    // production-like ids are refused even with every override flag
    expect(() => resolveAdminTarget(named('dsbc-prod', { 'allow-non-emulator': true }), 'seed-demo', real)).toThrow(/production-like/);
    expect(() => resolveAdminTarget(named('customer-live', { 'allow-non-emulator': true }), 'seed-demo', { DSBC_PRODUCTION_PROJECT_IDS: 'customer-live' })).toThrow(/production-like/);
    // the registry production project is refused even at its own database
    expect(() => resolveAdminTarget(parseArgs(['--project', PRODUCTION_TARGET.projectId, '--confirm-project', PRODUCTION_TARGET.projectId, '--database', PRODUCTION_TARGET.databaseId, '--allow-non-emulator']), 'seed-demo', real)).toThrow(/production-like/);
    // a real non-demo project is refused unless explicitly opted in
    expect(() => resolveAdminTarget(named('dsbc-dev'), 'seed-demo', real)).toThrow(/allow-non-emulator/);
    // a real project without a confirmation is refused outright
    expect(() => resolveAdminTarget(parseArgs(['--project', 'dsbc-dev']), 'seed-demo', real)).toThrow(/confirm-project/);
    // an emulator target that is not demo-* needs an explicit confirmation
    expect(() => resolveAdminTarget(parseArgs(['--project', 'dsbc-dev']), 'seed-demo', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(/not a demo-\* project/);
    // the sanctioned target: the demo-* emulator project
    expect(resolveAdminTarget({}, 'seed-demo', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-dsbc' })).toMatchObject({ projectId: 'demo-dsbc', emulator: true });
  });

  it('REG-030 approveCustomer succeeds with payments disabled (emulator default)', async () => {
    // Prove payments really are off in this environment, then approve.
    const co = await call('createCheckoutOrder', { planId: 'individual_pro' }, w.individual);
    expect(co.message).toContain('PAYMENTS_NOT_ENABLED');
    await seedPending('c30');
    const res = await ok('approveCustomer', { customerType: 'individual', customerId: 'c30', reason: 'payments-off approval' }, w.owner);
    expect(res).toMatchObject({ customerId: 'c30', status: 'active', alreadyActive: false });
  });

  it('REG-031 createCheckoutOrder fails closed (payments disabled)', async () => {
    const before = await countOf('paymentOrders');
    const r = await call('createCheckoutOrder', { planId: 'individual_pro' }, w.individual);
    expect(r.ok).toBe(false);
    expect(r.status).toBe('FAILED_PRECONDITION');
    expect(r.message).toContain('PAYMENTS_NOT_ENABLED');
    expect(await countOf('paymentOrders')).toBe(before);
  });

  it('REG-032 manual/offline entitlement stays App-Owner-only', async () => {
    const subsBefore = await countOf('subscriptions');
    const grant = { customerType: 'individual', customerId: w.individual.uid, planId: 'individual_pro', durationDays: 30, reason: 'manual path probe' };
    expect((await call('adminGrantComplimentary', grant, w.individual)).status).toBe('PERMISSION_DENIED');
    expect((await call('adminGrantComplimentary', grant, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('adminGrantComplimentary', grant, w.unverifiedOwner)).status).toBe('PERMISSION_DENIED');
    expect((await call('adminChangeCustomerPlan', { customerType: 'individual', customerId: w.individual.uid, planId: 'individual_pro', reason: 'probe' }, w.individual)).status).toBe('PERMISSION_DENIED');
    expect(await countOf('subscriptions')).toBe(subsBefore);
  });
});
