// Directive 25 Phase 13 — identity, plan control, App Owner audit, safety.
// AUTH-001 AUTH-002 AUTH-003 AUTH-016 AUTH-017 AUTH-018 AUTH-025
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  ok,
  outcome,
  seedWorld,
  Timestamp,
  type BrowserSession,
  type World,
} from './support/backendEnv';

let w: World;
const sessions: BrowserSession[] = [];
async function browser(user: World[keyof World] | null) {
  const s = await browserSession(user);
  sessions.push(s);
  return s.db;
}

beforeAll(async () => {
  w = await seedWorld();
});
afterAll(async () => {
  await Promise.all(sessions.map((s) => s.close()));
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString('base64');

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
const AUDIT_KEYS = ['action', 'actor', 'targetType', 'targetId', 'targetName', 'tenantId', 'featureId', 'previousValue', 'newValue', 'reason', 'source'];
function recomputeHash(d: Record<string, unknown>): string {
  const entry = Object.fromEntries(AUDIT_KEYS.filter((k) => k in d).map((k) => [k, d[k]]));
  return createHash('sha256').update(canonical(entry)).digest('hex');
}

describe('AUTH-001 browser cannot assign itself company_admin', () => {
  it('rules reject a self-promotion of users/{uid}.role', async () => {
    const db = await browser(w.employeeA);
    expect(await outcome(updateDoc(doc(db, 'users', w.employeeA.uid), { role: 'company_admin' }))).toBe('permission-denied');
  });

  it('rules reject an individual attaching itself to another company as admin', async () => {
    const db = await browser(w.individual);
    expect(await outcome(updateDoc(doc(db, 'users', w.individual.uid), { role: 'company_admin', companyId: 'co_a' }))).toBe('permission-denied');
  });

  it('backend rejects a payload that claims a role', async () => {
    const r = await call('checkEntitlement', { featureId: 'company.analytics', role: 'company_admin' }, w.employeeA);
    expect(r.status).toBe('INVALID_ARGUMENT');
  });

  it('company-admin operations stay denied to an employee (role comes from server records)', async () => {
    const r = await call('uploadAsset', { kind: 'company_logo', dataBase64: PNG, fileName: 'logo.png' }, w.employeeA);
    expect(r.status).toBe('PERMISSION_DENIED');
  });
});

describe('AUTH-002 browser cannot assign itself app_owner', () => {
  it('rules reject users/{uid}.role = app_owner', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'users', w.adminA.uid), { role: 'app_owner' }))).toBe('permission-denied');
  });

  it('a profile that says app_owner without the verified claim is not the App Owner', async () => {
    const r = await call('setPlanPricing', { planId: 'company_pro', price: 1, currency: 'INR', billingCycle: 'yearly', reason: 'forged' }, w.docRoleImpostor);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('the claim on an unverified email is not the App Owner', async () => {
    const r = await call('updateGlobalPolicy', { updates: { maintenanceMode: true }, reason: 'forged' }, w.unverifiedOwner);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('a payload claiming platformRole is rejected', async () => {
    const r = await call('upsertOverride', { platformRole: 'app_owner' }, w.adminA);
    expect(['INVALID_ARGUMENT', 'PERMISSION_DENIED']).toContain(r.status);
    const plan = (await adminDb.doc('plans/company_pro').get()).data()!;
    expect(plan.price).toBe(500);
  });
});

describe('AUTH-003 browser cannot change its own plan', () => {
  it('rules reject writing companies/{id}.planId and subscriptions', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'companies', 'co_a'), { planId: 'company_pro' }))).toBe('permission-denied');
    expect(
      await outcome(setDoc(doc(db, 'subscriptions', 'company_co_a'), { customerType: 'company', customerId: 'co_a', planId: 'company_pro', status: 'ACTIVE' }))
    ).toBe('permission-denied');
  });

  it('the App Owner plan-assignment callable is denied to a company admin', async () => {
    const r = await call('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', reason: 'self upgrade' }, w.adminA);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('checkout cannot grant a plan while payments are disabled, and nothing changes', async () => {
    const r = await call('createCheckoutOrder', { planId: 'company_pro' }, w.adminA);
    expect(r.status).toBe('FAILED_PRECONDITION');
    expect(r.message).toContain('PAYMENTS_NOT_ENABLED');
    const state = await ok('getMyCommercialState', {}, w.adminA);
    expect(state.subscription).toBeNull();
    expect(state.subscriptionState.planIdForAccess).toBe('company_free');
    expect((await adminDb.collection('paymentOrders').get()).size).toBe(0);
  });

  it('checkout refuses a plan for the wrong customer type and a non-billing employee', async () => {
    expect((await call('createCheckoutOrder', { planId: 'individual_pro' }, w.adminA)).status).toBe('INVALID_ARGUMENT');
    expect((await call('createCheckoutOrder', { planId: 'company_pro' }, w.employeeA)).status).toBe('PERMISSION_DENIED');
  });

  it('a payload cannot name the customer or price', async () => {
    const r = await call('createCheckoutOrder', { planId: 'company_pro', customerId: 'co_b', price: 0 }, w.adminA);
    expect(r.status).toBe('INVALID_ARGUMENT');
  });
});

describe('AUTH-016 App Owner can modify plans', () => {
  it('changes pricing with server timestamps and a version bump', async () => {
    const before = (await adminDb.doc('plans/company_pro').get()).data()!;
    await ok('setPlanPricing', { planId: 'company_pro', price: 600, currency: 'INR', billingCycle: 'yearly', reason: 'Price review 2026' }, w.owner);
    const after = (await adminDb.doc('plans/company_pro').get()).data()!;
    expect(after.price).toBe(600);
    expect(after.version).toBe((before.version ?? 0) + 1);
    expect(after.updatedAt).toBeInstanceOf(Timestamp);
    expect(after.updatedBy).toBe(w.owner.uid);
  });

  it('creates, edits the matrix of, duplicates and archives a plan; standard plans cannot be deleted', async () => {
    const plan = {
      id: 'company_growth', name: 'Company Growth', targetType: 'company', description: 'Test plan', price: 250, currency: 'INR',
      billingCycle: 'yearly', isActive: true, isPopular: false,
      features: { 'company.team_members': { status: 'LIMITED', limit: 10, limitUnit: 'EMPLOYEES' } },
    };
    expect((await ok('upsertPlan', { plan, reason: 'New tier' }, w.owner)).action).toBe('PLAN_CREATED');
    await ok('setPlanFeature', { planId: 'company_growth', featureId: 'company.analytics', rule: { status: 'ENABLED' }, reason: 'Matrix edit' }, w.owner);
    const dup = await ok('duplicatePlan', { sourcePlanId: 'company_growth', newPlanId: 'company_growth_v2', reason: 'Variant' }, w.owner);
    expect(dup.planId).toBe('company_growth_v2');
    expect((await adminDb.doc('plans/company_growth_v2').get()).get('isActive')).toBe(false);
    await ok('deletePlan', { planId: 'company_growth_v2', reason: 'Not needed' }, w.owner);
    const archived = (await adminDb.doc('plans/company_growth_v2').get()).data()!;
    expect(archived.archived).toBe(true); // archived, never hard-deleted
    expect((await call('deletePlan', { planId: 'company_pro', reason: 'x' }, w.owner)).status).toBe('FAILED_PRECONDITION');
    // Customers cannot do any of it.
    expect((await call('upsertPlan', { plan, reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('setPlanFeature', { planId: 'company_free', featureId: 'company.analytics', rule: { status: 'UNLIMITED' }, reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('duplicatePlan', { sourcePlanId: 'custom', reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
  });

  it('browser writes to the control plane are denied even for the App Owner', async () => {
    const db = await browser(w.owner);
    expect(await outcome(updateDoc(doc(db, 'plans', 'company_pro'), { price: 1 }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'featureCatalogue', 'x.feature'), { id: 'x.feature' }))).toBe('permission-denied');
  });
});

describe('AUTH-017 App Owner modifications create audit records', () => {
  it('pricing change is recorded with actor, previous/new value, reason and a content hash', async () => {
    const logs = await adminDb.collection('entitlementAuditLogs').where('action', '==', 'PLAN_PRICING_CHANGED').where('targetId', '==', 'company_pro').get();
    expect(logs.size).toBe(1);
    const d = logs.docs[0].data();
    expect(d.actor).toEqual({ uid: w.owner.uid, name: expect.any(String), role: 'app_owner' });
    expect(d.previousValue.price).toBe(500);
    expect(d.newValue.price).toBe(600);
    expect(d.reason).toBe('Price review 2026');
    expect(d.timestamp).toBeInstanceOf(Timestamp);
    expect(d.contentHash).toBe(recomputeHash(d));
  });

  it('every control-plane mutation in this file wrote exactly one audit record', async () => {
    const actions = (await adminDb.collection('entitlementAuditLogs').get()).docs.map((d) => d.get('action')).sort();
    expect(actions).toEqual(
      ['CONTROL_PLANE_BOOTSTRAPPED', 'PLAN_ARCHIVED', 'PLAN_CREATED', 'PLAN_DUPLICATED', 'PLAN_FEATURES_CHANGED', 'PLAN_PRICING_CHANGED'].sort()
    );
  });
});

describe('AUTH-018 audit records cannot be modified', () => {
  it('nobody can update, delete or forge an audit record from a browser (App Owner included)', async () => {
    const id = (await adminDb.collection('entitlementAuditLogs').where('action', '==', 'PLAN_PRICING_CHANGED').get()).docs[0].id;
    for (const user of [w.owner, w.adminA, null]) {
      const db = await browser(user);
      expect(await outcome(updateDoc(doc(db, 'entitlementAuditLogs', id), { reason: 'rewritten' }))).toBe('permission-denied');
      expect(await outcome(deleteDoc(doc(db, 'entitlementAuditLogs', id)))).toBe('permission-denied');
      expect(await outcome(setDoc(doc(collection(db, 'commercialAuditLogs')), { action: 'PAYMENT_RECEIVED' }))).toBe('permission-denied');
    }
  });

  it('customers cannot even read the ledger; the App Owner can', async () => {
    const id = (await adminDb.collection('entitlementAuditLogs').limit(1).get()).docs[0].id;
    expect(await outcome(getDoc(doc(await browser(w.adminA), 'entitlementAuditLogs', id)))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(await browser(w.owner), 'entitlementAuditLogs', id)))).toBe('ALLOWED');
  });

  it('out-of-band tampering is detectable through the content hash', async () => {
    const ref = (await adminDb.collection('entitlementAuditLogs').where('action', '==', 'PLAN_PRICING_CHANGED').get()).docs[0].ref;
    const original = (await ref.get()).data()!;
    await ref.update({ 'newValue.price': 1 }); // console-level tampering (Admin SDK)
    const tampered = (await ref.get()).data()!;
    expect(recomputeHash(tampered)).not.toBe(tampered.contentHash);
    await ref.set(original); // restore for later assertions
    expect(recomputeHash((await ref.get()).data()!)).toBe(original.contentHash);
  });
});

describe('AUTH-025 unauthorized platform safety mutations are rejected', () => {
  it('company admin cannot switch maintenance mode or self-registration', async () => {
    expect((await call('updateGlobalPolicy', { updates: { maintenanceMode: true }, reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('updateGlobalPolicy', { updates: { allowSelfRegistration: false }, reason: 'x' }, w.individual)).status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc('globalPolicies/platform').get()).get('maintenanceMode')).toBe(false);
  });

  it('browser writes to globalPolicies are denied', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(setDoc(doc(db, 'globalPolicies', 'platform'), { maintenanceMode: true }, { merge: true }))).toBe('permission-denied');
  });

  it('unauthenticated callers are rejected', async () => {
    expect((await call('updateGlobalPolicy', { updates: { maintenanceMode: true }, reason: 'x' }, null)).status).toBe('UNAUTHENTICATED');
  });

  it('the App Owner can change safety controls; unknown fields are rejected; the change is audited', async () => {
    expect((await call('updateGlobalPolicy', { updates: { superUser: true }, reason: 'x' }, w.owner)).status).toBe('INVALID_ARGUMENT');
    await ok('updateGlobalPolicy', { updates: { maintenanceMode: true }, reason: 'Planned maintenance' }, w.owner);
    expect((await adminDb.doc('globalPolicies/platform').get()).get('maintenanceMode')).toBe(true);
    const audit = await adminDb.collection('entitlementAuditLogs').where('action', '==', 'PLATFORM_SAFETY_CHANGED').get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].get('previousValue')).toEqual({ maintenanceMode: false });
    await ok('updateGlobalPolicy', { updates: { maintenanceMode: false }, reason: 'Maintenance over' }, w.owner);
  });

  it('REG-031 customerActivationMode is validated and App Owner editable', async () => {
    expect((await call('updateGlobalPolicy', { updates: { customerActivationMode: 'whenever' }, reason: 'x' }, w.owner)).status).toBe('INVALID_ARGUMENT');
    expect((await call('updateGlobalPolicy', { updates: { customerActivationMode: 'auto' }, reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    await ok('updateGlobalPolicy', { updates: { customerActivationMode: 'auto' }, reason: 'Test activation mode' }, w.owner);
    expect((await adminDb.doc('globalPolicies/platform').get()).get('customerActivationMode')).toBe('auto');
    await ok('updateGlobalPolicy', { updates: { customerActivationMode: 'manual_approval' }, reason: 'Restore default' }, w.owner);
    expect((await adminDb.doc('globalPolicies/platform').get()).get('customerActivationMode')).toBe('manual_approval');
  });
});
