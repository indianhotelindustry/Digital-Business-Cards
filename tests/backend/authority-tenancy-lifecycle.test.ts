// Directive 25 Phase 13 — tenant isolation, entitlement precedence/expiry,
// subscription expiry, downgrade without data loss.
// AUTH-012 AUTH-013 AUTH-014 AUTH-015
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  eventually,
  ok,
  outcome,
  seedWorld,
  sleep,
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
const check = (featureId: string, user: World[keyof World]) => ok('checkEntitlement', { featureId }, user);

beforeAll(async () => {
  w = await seedWorld();
});
afterAll(async () => {
  await Promise.all(sessions.map((s) => s.close()));
});

describe('AUTH-012 Company A cannot access Company B commercial state', () => {
  beforeAll(async () => {
    await ok('adminGrantComplimentary', { customerType: 'company', customerId: 'co_b', planId: 'company_pro', durationDays: 90, reason: 'Pilot' }, w.owner);
    await ok('adminCreateInvoice', { customerType: 'company', customerId: 'co_b', planId: 'company_pro', currency: 'INR', paymentStatus: 'COMPLIMENTARY', items: [{ description: 'Pilot', amount: 0, quantity: 1 }], reason: 'Pilot invoice' }, w.owner);
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.analytics', rule: { status: 'UNLIMITED' }, grantType: 'permanent', reason: 'Pilot' }, w.owner);
    await ok('adminSetCustomerClassification', { customerType: 'company', customerId: 'co_b', isPilot: true, reason: 'Pilot' }, w.owner);
  });

  it('rules deny Company A every read of Company B commercial records', async () => {
    const db = await browser(w.adminA);
    const invoiceId = (await adminDb.collection('invoices').where('customerId', '==', 'co_b').get()).docs[0].id;
    expect(await outcome(getDoc(doc(db, 'subscriptions', 'company_co_b')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(db, 'invoices', invoiceId)))).toBe('permission-denied');
    expect(await outcome(getDocs(query(collection(db, 'invoices'), where('customerType', '==', 'company'), where('customerId', '==', 'co_b'))))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(db, 'entitlementOverrides', 'company_co_b__company.analytics')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(db, 'customerClassifications', 'company_co_b')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(db, 'usageCounters', 'company_co_b__company.team_members__current')))).toBe('permission-denied');
  });

  it('Company B reads its own records with the exact queries the client uses', async () => {
    const db = await browser(w.adminB);
    expect(await outcome(getDoc(doc(db, 'subscriptions', 'company_co_b')))).toBe('ALLOWED');
    expect(await outcome(getDocs(query(collection(db, 'invoices'), where('customerType', '==', 'company'), where('customerId', '==', 'co_b'))))).toBe('ALLOWED');
  });

  it('the backend never serves another tenant', async () => {
    expect((await call('adminGetCustomerCommercialState', { customerType: 'company', customerId: 'co_b' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    const mine = await ok('getMyCommercialState', {}, w.adminA);
    expect(mine.subject.customerId).toBe('co_a');
    expect(mine.subscriptionState.planIdForAccess).toBe('company_free');
    expect((await call('getMyCommercialState', { customerId: 'co_b' }, w.adminA)).ok).toBe(true); // extra input is ignored here …
    expect((await ok('getMyCommercialState', { customerId: 'co_b' }, w.adminA)).subject.customerId).toBe('co_a'); // … and never used
    expect((await call('consumeQuota', { featureId: 'company.ai_assistance', operationId: 'op_cross_tenant_1', customerId: 'co_b' }, w.adminA)).status).toBe('INVALID_ARGUMENT');
    expect((await call('setPublishingState', { entityType: 'company', entityId: 'co_b', state: 'UNPUBLISHED' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('uploadAsset', { kind: 'employee_photo', employeeId: 'emp_b1', dataBase64: 'iVBORw0KGgo=', fileName: 'x.png' }, w.adminA)).status).toBe('PERMISSION_DENIED');
  });

  it('Company B entitlements do not leak into Company A', async () => {
    expect((await check('company.analytics', w.adminB)).entitlement.status).toBe('UNLIMITED');
    expect((await check('company.analytics', w.adminA)).entitlement.status).toBe('LIMITED');
  });
});

describe('AUTH-013 expired override falls back (Directive 18 precedence)', () => {
  it('individual > company > plan, and an expired individual grant falls back to the company override', async () => {
    // Plan (company_free): individual.ai_assistance DISABLED.
    expect((await check('individual.ai_assistance', w.employeeA)).allowed).toBe(false);
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_a', featureId: 'individual.ai_assistance', rule: { status: 'ENABLED' }, grantType: 'permanent', reason: 'Company grant' }, w.owner);
    let r = await check('individual.ai_assistance', w.employeeA);
    expect([r.allowed, r.entitlement.source]).toEqual([true, 'company_override']);

    const expiresAt = new Date(Date.now() + 6000).toISOString();
    await ok('upsertOverride', { targetType: 'individual', targetId: 'emp_a1', featureId: 'individual.ai_assistance', rule: { status: 'DISABLED' }, grantType: 'until_date', expiresAt, reason: 'Temporary block' }, w.owner);
    r = await check('individual.ai_assistance', w.employeeA);
    expect([r.allowed, r.entitlement.source]).toEqual([false, 'individual_override']);

    await sleep(Math.max(0, Date.parse(expiresAt) - Date.now()) + 1500);
    r = await check('individual.ai_assistance', w.employeeA);
    expect([r.allowed, r.entitlement.source]).toEqual([true, 'company_override']);

    await ok('deleteOverride', { overrideId: 'company_co_a__individual.ai_assistance', reason: 'Grant ended' }, w.owner);
    r = await check('individual.ai_assistance', w.employeeA);
    expect([r.allowed, r.entitlement.source]).toEqual([false, 'plan_policy']);
  });

  it('an expired temporary company grant falls back to the plan without any write', async () => {
    const expiresAt = new Date(Date.now() + 5000).toISOString();
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_a', featureId: 'company.ai_assistance', rule: { status: 'ENABLED' }, grantType: 'trial', expiresAt, reason: '5-second trial' }, w.owner);
    expect((await check('company.ai_assistance', w.adminA)).allowed).toBe(true);
    await sleep(Math.max(0, Date.parse(expiresAt) - Date.now()) + 1500);
    const r = await check('company.ai_assistance', w.adminA);
    expect([r.allowed, r.entitlement.source]).toEqual([false, 'plan_policy']);
    expect((await adminDb.doc('entitlementOverrides/company_co_a__company.ai_assistance').get()).exists).toBe(true); // retained for audit
  });

  it('feature dependencies still apply', async () => {
    expect((await check('company.services', w.adminA)).allowed).toBe(true);
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_a', featureId: 'company.mini_website', rule: { status: 'DISABLED' }, grantType: 'permanent', reason: 'Website off' }, w.owner);
    const r = await check('company.services', w.adminA);
    expect(r.allowed).toBe(false);
    expect(r.entitlement.sourceDescription).toContain('company.mini_website');
    await ok('deleteOverride', { overrideId: 'company_co_a__company.mini_website', reason: 'Website on' }, w.owner);
  });
});

describe('AUTH-014 expired subscription locks paid features', () => {
  it('an expired trial falls back to the free plan on the next read and the reconciler persists it', async () => {
    await ok('adminGrantTrial', { customerType: 'individual', customerId: w.individual.uid, planId: 'individual_pro', trialDays: 14, reason: 'Trial' }, w.owner);
    expect((await check('individual.ai_assistance', w.individual)).allowed).toBe(true);

    // Time passes: the trial ended yesterday (server data, as if 15 days later).
    await adminDb.doc(`subscriptions/individual_${w.individual.uid}`).update({ trialEndsAt: Timestamp.fromMillis(Date.now() - 86_400_000) });
    const state = await ok('getMyCommercialState', {}, w.individual);
    expect(state.subscriptionState.status).toBe('EXPIRED');
    expect(state.subscriptionState.planIdForAccess).toBe('individual_free');
    expect((await check('individual.ai_assistance', w.individual)).allowed).toBe(false);

    const recon = await ok('adminReconcileNow', {}, w.owner);
    expect(recon.changed).toContainEqual({ id: `individual_${w.individual.uid}`, from: 'TRIAL', to: 'EXPIRED' });
    expect((await adminDb.doc(`subscriptions/individual_${w.individual.uid}`).get()).get('status')).toBe('EXPIRED');
    const audit = await adminDb.collection('commercialAuditLogs').where('action', '==', 'TRIAL_EXPIRED').get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].get('reason')).toContain('content retained');
    expect((await adminDb.doc(`users/${w.individual.uid}`).get()).exists).toBe(true);
  });

  it('an expired complimentary grant locks the paid features of a company', async () => {
    expect((await check('company.ai_assistance', w.adminB)).allowed).toBe(true);
    await adminDb.doc('subscriptions/company_co_b').update({ currentPeriodEnd: Timestamp.fromMillis(Date.now() - 1000) });
    const r = await check('company.ai_assistance', w.adminB);
    expect(r.allowed).toBe(false);
    expect((await ok('getMyCommercialState', {}, w.adminB)).subscriptionState.status).toBe('EXPIRED');
  });

  it('a customer cannot reactivate an expired subscription', async () => {
    expect((await call('adminSetSubscriptionStatus', { customerType: 'company', customerId: 'co_b', status: 'ACTIVE', reason: 'x' }, w.adminB)).status).toBe('PERMISSION_DENIED');
    expect((await call('cancelMySubscription', { atPeriodEnd: false }, w.adminB)).status).toBe('FAILED_PRECONDITION');
  });
});

describe('AUTH-015 downgrade preserves data (DATA != DELETED, FEATURE = LOCKED)', () => {
  const extra = ['emp_a2', 'emp_a3', 'emp_a4', 'emp_a5'];
  const locked = async () => (await adminDb.collection('employees').where('companyId', '==', 'co_a').get()).docs.filter((d) => d.get('seatState') === 'locked').map((d) => d.id).sort();

  beforeAll(async () => {
    await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', reason: 'Upgrade' }, w.owner);
    const batch = adminDb.batch();
    extra.forEach((id, i) => {
      batch.set(adminDb.doc(`employees/${id}`), { id, companyId: 'co_a', displayName: id, status: 'active', createdAt: `2026-0${i + 2}-01T00:00:00.000Z` });
      batch.set(adminDb.doc(`cards/card_${id}`), { id: `card_${id}`, companyId: 'co_a', employeeId: id, templateId: 'classic', publicSlug: id.replace('_', '-'), status: 'active' });
    });
    await batch.commit();
    const counter = await eventually(
      async () => Number((await adminDb.doc('usageCounters/company_co_a__company.team_members__current').get()).get('currentValue') ?? 0),
      (v) => v === 5
    );
    expect(counter).toBe(5);
    expect(await locked()).toEqual([]);
  });

  it('downgrading locks seats beyond the new limit without deleting anything', async () => {
    await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_free', reason: 'Downgrade' }, w.owner);
    expect(await eventually(locked, (ids) => ids.length === 2)).toEqual(['emp_a4', 'emp_a5']); // newest seats lock first
    expect((await adminDb.collection('employees').where('companyId', '==', 'co_a').get()).size).toBe(5);
    expect((await adminDb.collection('cards').where('companyId', '==', 'co_a').get()).size).toBe(5);
  });

  it('locked content is hidden from the public, still visible to the tenant, and cannot be published', async () => {
    const pub = await browser(null);
    expect(await outcome(getDoc(doc(pub, 'employees', 'emp_a5')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(pub, 'employees', 'emp_a1')))).toBe('ALLOWED');
    expect(await outcome(getDoc(doc(await browser(w.adminA), 'employees', 'emp_a5')))).toBe('ALLOWED');
    const r = await call('setPublishingState', { entityType: 'card', entityId: 'card_emp_a5', state: 'PUBLISHED', slug: 'emp-a5' }, w.adminA);
    expect(r.status).toBe('RESOURCE_EXHAUSTED');
  });

  it('upgrading again unlocks the same records', async () => {
    await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', reason: 'Upgrade again' }, w.owner);
    expect(await eventually(locked, (ids) => ids.length === 0)).toEqual([]);
    expect((await adminDb.doc('employees/emp_a5').get()).get('displayName')).toBe('emp_a5');
  });
});
