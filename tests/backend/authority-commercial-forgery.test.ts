// Directive 25 Phase 13 — commercial forgery attempts.
// AUTH-004 AUTH-005 AUTH-006 AUTH-007 AUTH-008 AUTH-009 AUTH-010 AUTH-011
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  emulatorSecret,
  hmacHex,
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
const sub = async (id: string) => (await adminDb.doc(`subscriptions/${id}`).get()).data();
const counterValue = async (id: string) => Number((await adminDb.doc(`usageCounters/${id}`).get()).get('currentValue') ?? 0);
const month = () => new Date().toISOString().slice(0, 7);
let opSeq = 0;
const opId = () => `op_${Date.now().toString(36)}_${(++opSeq).toString().padStart(4, '0')}`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 7)]).toString('base64');

beforeAll(async () => {
  w = await seedWorld();
  // co_a is on a TRIAL of company_pro (App Owner grant).
  await ok('adminGrantTrial', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', trialDays: 14, reason: 'Sales trial' }, w.owner);
});
afterAll(async () => {
  await Promise.all(sessions.map((s) => s.close()));
});

describe('AUTH-004 browser cannot forge subscription ACTIVE', () => {
  it('rules reject creating or editing a subscription document', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'subscriptions', 'company_co_a'), { status: 'ACTIVE', paymentStatus: 'PAID' }))).toBe('permission-denied');
    const dbB = await browser(w.adminB);
    expect(
      await outcome(setDoc(doc(dbB, 'subscriptions', 'company_co_b'), { customerType: 'company', customerId: 'co_b', planId: 'company_pro', status: 'ACTIVE', paymentStatus: 'PAID' }))
    ).toBe('permission-denied');
    expect((await sub('company_co_a'))!.status).toBe('TRIAL');
  });

  it('status changes are App Owner only; the customer path can only cancel', async () => {
    expect((await call('adminSetSubscriptionStatus', { customerType: 'company', customerId: 'co_a', status: 'ACTIVE', reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('cancelMySubscription', { status: 'ACTIVE' }, w.adminA)).status).toBe('INVALID_ARGUMENT');
    expect((await call('cancelMySubscription', { atPeriodEnd: true }, w.employeeA)).status).toBe('PERMISSION_DENIED');
    const state = await ok('getMyCommercialState', {}, w.adminA);
    expect(state.subscriptionState.status).toBe('TRIAL');
    expect(state.subscription.paymentStatus).toBe('PENDING');
  });
});

describe('AUTH-005 browser cannot forge payment success', () => {
  const orderId = 'ord_test_co_a';
  const providerOrderId = 'order_TEST000001';

  beforeAll(async () => {
    // A server-priced order as createCheckoutOrder would have written it.
    await adminDb.doc(`paymentOrders/${orderId}`).set({
      id: orderId, provider: 'razorpay', providerOrderId, status: 'CREATED', customerType: 'company', customerId: 'co_a', tenantId: 'co_a',
      customerName: 'Company co_a', planId: 'company_pro', planName: 'Company Pro', billingCycle: 'yearly', amountMinor: 60000, currency: 'INR',
      createdByUid: w.adminA.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  });

  it('fabricated, legacy-format and wrong-secret signatures are rejected', async () => {
    const forged = [
      'sig_rzp_anything_goes_here_123456', // Directive 19 browser check accepted this
      'x'.repeat(64),
      hmacHex(`${providerOrderId}|pay_FAKE1`, 'not-the-secret'),
    ];
    for (const razorpaySignature of forged) {
      const r = await call('confirmPayment', { orderId, razorpayOrderId: providerOrderId, razorpayPaymentId: 'pay_FAKE1', razorpaySignature }, w.adminA);
      expect(r.status).toBe('PERMISSION_DENIED');
      expect(r.message).toContain('INVALID_PAYMENT_SIGNATURE');
    }
  });

  it('a correctly signed callback still cannot activate while payments are disabled', async () => {
    const razorpaySignature = hmacHex(`${providerOrderId}|pay_REAL1`, emulatorSecret('RAZORPAY_KEY_SECRET'));
    const r = await call('confirmPayment', { orderId, razorpayOrderId: providerOrderId, razorpayPaymentId: 'pay_REAL1', razorpaySignature }, w.adminA);
    expect(r.status).toBe('FAILED_PRECONDITION');
  });

  it('another tenant cannot confirm the order (even with a valid signature); a missing order is not found', async () => {
    const razorpaySignature = hmacHex(`${providerOrderId}|pay_REAL2`, emulatorSecret('RAZORPAY_KEY_SECRET'));
    const r = await call('confirmPayment', { orderId, razorpayOrderId: providerOrderId, razorpayPaymentId: 'pay_REAL2', razorpaySignature }, w.adminB);
    expect(r.status).toBe('PERMISSION_DENIED');
    expect(r.message).toContain('another customer');
    expect((await call('confirmPayment', { orderId: 'nope', razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' }, w.adminA)).status).toBe('NOT_FOUND');
  });

  it('rules reject marking an order or subscription paid from the browser', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'paymentOrders', orderId), { status: 'PAID' }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(db, 'subscriptions', 'company_co_a'), { paymentStatus: 'PAID' }))).toBe('permission-denied');
  });

  it('nothing changed: order CREATED, subscription TRIAL/PENDING, no invoice', async () => {
    expect((await adminDb.doc(`paymentOrders/${orderId}`).get()).get('status')).toBe('CREATED');
    const s = (await sub('company_co_a'))!;
    expect([s.status, s.paymentStatus]).toEqual(['TRIAL', 'PENDING']);
    expect((await adminDb.collection('invoices').get()).size).toBe(0);
  });
});

describe('AUTH-006 browser cannot forge an entitlement', () => {
  it('rules reject creating an override document', async () => {
    const db = await browser(w.adminB);
    const forged = { targetType: 'company', targetId: 'co_b', featureId: 'company.ai_assistance', rule: { status: 'UNLIMITED' }, grantType: 'permanent' };
    expect(await outcome(setDoc(doc(db, 'entitlementOverrides', 'company_co_b__company.ai_assistance'), forged))).toBe('permission-denied');
  });

  it('override callables are App Owner only', async () => {
    const r = await call('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.ai_assistance', rule: { status: 'UNLIMITED' }, grantType: 'permanent', reason: 'self' }, w.adminB);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('the client may ask, never tell: an entitlement in the payload is rejected and the server answer stands', async () => {
    expect((await call('checkEntitlement', { featureId: 'company.ai_assistance', entitlement: { status: 'UNLIMITED', isGranted: true } }, w.adminB)).status).toBe('INVALID_ARGUMENT');
    const answer = await ok('checkEntitlement', { featureId: 'company.ai_assistance' }, w.adminB);
    expect(answer.allowed).toBe(false);
    expect(answer.entitlement.source).toBe('plan_policy');
  });
});

describe('AUTH-007 browser cannot create an invoice', () => {
  it('rules reject writing invoices; the callable is App Owner only', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(setDoc(doc(db, 'invoices', 'INV-2026-999999'), { customerType: 'company', customerId: 'co_a', amount: 0, paymentStatus: 'PAID' }))).toBe('permission-denied');
    const r = await call('adminCreateInvoice', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', currency: 'INR', paymentStatus: 'PENDING', items: [{ description: 'x', amount: 1, quantity: 1 }], reason: 'x' }, w.adminA);
    expect(r.status).toBe('PERMISSION_DENIED');
  });

  it('the App Owner can issue a PENDING invoice but cannot issue one as PAID', async () => {
    const base = { customerType: 'company', customerId: 'co_a', planId: 'company_pro', currency: 'INR', items: [{ description: 'Company Pro (bank transfer)', amount: 600, quantity: 1 }], reason: 'Offline billing' };
    expect((await call('adminCreateInvoice', { ...base, paymentStatus: 'PAID' }, w.owner)).status).toBe('INVALID_ARGUMENT');
    const inv = await ok('adminCreateInvoice', { ...base, paymentStatus: 'PENDING' }, w.owner);
    expect(inv.invoiceId).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(inv.amount).toBe(600);
  });
});

describe('AUTH-008 browser cannot change invoice status', () => {
  it('the billing contact can read but not edit their invoice', async () => {
    const id = (await adminDb.collection('invoices').limit(1).get()).docs[0].id;
    const db = await browser(w.adminA);
    expect(await outcome(getDoc(doc(db, 'invoices', id)))).toBe('ALLOWED');
    expect(await outcome(updateDoc(doc(db, 'invoices', id), { paymentStatus: 'PAID' }))).toBe('permission-denied');
    expect(await outcome(deleteDoc(doc(db, 'invoices', id)))).toBe('permission-denied');
    expect((await call('adminRecordInvoicePayment', { invoiceId: id, paymentReference: 'self', reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc(`invoices/${id}`).get()).get('paymentStatus')).toBe('PENDING');
  });

  it('the App Owner records a payment once; it is audited', async () => {
    const id = (await adminDb.collection('invoices').limit(1).get()).docs[0].id;
    await ok('adminRecordInvoicePayment', { invoiceId: id, paymentReference: 'NEFT-123', reason: 'Bank transfer received' }, w.owner);
    expect((await adminDb.doc(`invoices/${id}`).get()).get('paymentStatus')).toBe('PAID');
    expect((await call('adminRecordInvoicePayment', { invoiceId: id, paymentReference: 'NEFT-124', reason: 'again' }, w.owner)).status).toBe('FAILED_PRECONDITION');
    expect((await adminDb.collection('commercialAuditLogs').where('action', '==', 'INVOICE_PAYMENT_RECORDED').get()).size).toBe(1);
  });
});

describe('AUTH-009 browser cannot grant complimentary access', () => {
  it('customers cannot call complimentary / trial / override grants', async () => {
    for (const user of [w.adminB, w.individual]) {
      const customerType = user === w.adminB ? 'company' : 'individual';
      const customerId = user === w.adminB ? 'co_b' : w.individual.uid;
      const planId = user === w.adminB ? 'company_pro' : 'individual_pro';
      expect((await call('adminGrantComplimentary', { customerType, customerId, planId, durationDays: 365, reason: 'self' }, user)).status).toBe('PERMISSION_DENIED');
      expect((await call('adminGrantTrial', { customerType, customerId, planId, trialDays: 30, reason: 'self' }, user)).status).toBe('PERMISSION_DENIED');
      expect(
        (await call('upsertOverride', { targetType: customerType, targetId: customerId, featureId: 'individual.ai_assistance', rule: { status: 'ENABLED' }, grantType: 'complimentary', expiresAt: '2030-01-01T00:00:00.000Z', reason: 'self' }, user)).status
      ).toBe('PERMISSION_DENIED');
    }
  });

  it('rules reject a COMPLIMENTARY subscription written from the browser', async () => {
    const db = await browser(w.individual);
    expect(
      await outcome(setDoc(doc(db, 'subscriptions', `individual_${w.individual.uid}`), { customerType: 'individual', customerId: w.individual.uid, planId: 'individual_pro', status: 'COMPLIMENTARY' }))
    ).toBe('permission-denied');
    expect(await sub(`individual_${w.individual.uid}`)).toBeUndefined();
  });

  it('the App Owner grant works and is audited', async () => {
    await ok('adminGrantComplimentary', { customerType: 'individual', customerId: w.individual.uid, planId: 'individual_pro', durationDays: 30, reason: 'Speaker pass' }, w.owner);
    expect((await sub(`individual_${w.individual.uid}`))!.status).toBe('COMPLIMENTARY');
    const audit = await adminDb.collection('commercialAuditLogs').where('action', '==', 'COMPLIMENTARY_GRANTED').get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].get('actor.uid')).toBe(w.owner.uid);
  });
});

describe('AUTH-010 browser cannot modify quota', () => {
  beforeAll(async () => {
    // App Owner meters AI for co_b at 3 units and for the individual at 5.
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.ai_assistance', rule: { status: 'LIMITED', limit: 3, limitUnit: 'AI_USAGE' }, grantType: 'permanent', reason: 'AI pilot' }, w.owner);
    await ok('upsertOverride', { targetType: 'individual', targetId: w.individual.uid, featureId: 'individual.ai_assistance', rule: { status: 'LIMITED', limit: 5, limitUnit: 'AI_USAGE' }, grantType: 'permanent', reason: 'AI pilot' }, w.owner);
  });

  it('metered usage stops at the limit', async () => {
    for (let i = 0; i < 3; i++) await ok('consumeQuota', { featureId: 'company.ai_assistance', operationId: opId() }, w.adminB);
    const r = await call('consumeQuota', { featureId: 'company.ai_assistance', operationId: opId() }, w.adminB);
    expect(r.status).toBe('RESOURCE_EXHAUSTED');
    expect(await counterValue(`company_co_b__company.ai_assistance__${month()}`)).toBe(3);
  });

  it('concurrent requests cannot overspend (no TOCTOU)', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => call('consumeQuota', { featureId: 'individual.ai_assistance', operationId: opId() }, w.individual))
    );
    const granted = results.filter((r) => r.ok).length;
    const counter = await counterValue(`individual_${w.individual.uid}__individual.ai_assistance__${month()}`);
    expect(granted).toBeLessThanOrEqual(5);
    expect(counter).toBe(granted);
    for (const r of results.filter((x) => !x.ok)) expect(['RESOURCE_EXHAUSTED', 'ABORTED']).toContain(r.status);
    // Whatever contention happened, the counter can never pass the limit.
    for (let i = 0; i < 10; i++) await call('consumeQuota', { featureId: 'individual.ai_assistance', operationId: opId() }, w.individual);
    expect(await counterValue(`individual_${w.individual.uid}__individual.ai_assistance__${month()}`)).toBe(5);
  });

  it('rules reject writing usage counters or the usage ledger', async () => {
    const db = await browser(w.adminB);
    const id = `company_co_b__company.ai_assistance__${month()}`;
    expect(await outcome(updateDoc(doc(db, 'usageCounters', id), { currentValue: 0 }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'usageCounters', 'company_co_b__company.team_members__current'), { currentValue: 0 }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(collection(db, 'usageLedger')), { amount: -100 }))).toBe('permission-denied');
  });

  it('customers cannot raise their limits or forge measured usage', async () => {
    expect(
      (await call('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.ai_assistance', rule: { status: 'LIMITED', limit: 9999, limitUnit: 'AI_USAGE' }, grantType: 'permanent', reason: 'self' }, w.adminB)).status
    ).toBe('PERMISSION_DENIED');
    // Seats / storage / content counts are measured by the backend, never reported.
    expect((await call('consumeQuota', { featureId: 'company.team_members', operationId: opId() }, w.adminB)).status).toBe('INVALID_ARGUMENT');
    expect((await call('consumeQuota', { featureId: 'company.storage', operationId: opId() }, w.adminB)).status).toBe('INVALID_ARGUMENT');
    // Seat state is backend-owned.
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'employees', 'emp_a1'), { seatState: 'locked' }))).toBe('permission-denied');
  });

  it('storage is reserved by the backend upload path and refused beyond the limit', async () => {
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.storage', rule: { status: 'LIMITED', limit: 0, limitUnit: 'STORAGE_MB' }, grantType: 'permanent', reason: 'No storage' }, w.owner);
    const r = await call('uploadAsset', { kind: 'company_logo', dataBase64: PNG, fileName: 'logo.png' }, w.adminB);
    expect(r.status).toBe('RESOURCE_EXHAUSTED');
    const fake = await call('uploadAsset', { kind: 'company_logo', dataBase64: Buffer.from('MZ-not-an-image').toString('base64'), fileName: 'x.exe' }, w.adminA);
    expect(fake.status).toBe('INVALID_ARGUMENT');
  });
});

describe('AUTH-011 browser cannot reset usage', () => {
  const id = () => `company_co_b__company.ai_assistance__${month()}`;

  it('rules reject deleting or zeroing a counter', async () => {
    const db = await browser(w.adminB);
    expect(await outcome(deleteDoc(doc(db, 'usageCounters', id())))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'usageCounters', id()), { currentValue: 0 }, { merge: true }))).toBe('permission-denied');
    expect(await counterValue(id())).toBe(3);
  });

  it('negative or zero consumption is rejected', async () => {
    expect((await call('consumeQuota', { featureId: 'company.ai_assistance', amount: -3, operationId: opId() }, w.adminB)).status).toBe('INVALID_ARGUMENT');
    expect((await call('consumeQuota', { featureId: 'company.ai_assistance', amount: 0, operationId: opId() }, w.adminB)).status).toBe('INVALID_ARGUMENT');
  });

  it('replaying an operation id is idempotent (no double count, no reset)', async () => {
    await ok('upsertOverride', { targetType: 'company', targetId: 'co_b', featureId: 'company.ai_assistance', rule: { status: 'LIMITED', limit: 10, limitUnit: 'AI_USAGE' }, grantType: 'permanent', reason: 'Raise AI limit' }, w.owner);
    const op = opId();
    const first = await ok('consumeQuota', { featureId: 'company.ai_assistance', operationId: op }, w.adminB);
    const replay = await ok('consumeQuota', { featureId: 'company.ai_assistance', operationId: op }, w.adminB);
    expect(first.used).toBe(4);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.used).toBe(4);
    expect(await counterValue(id())).toBe(4);
  });
});
