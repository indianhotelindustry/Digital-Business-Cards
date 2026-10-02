// Directive 25 Phase 13 — browser storage, payment webhooks, publishing.
// AUTH-019 AUTH-020 AUTH-021 AUTH-022 AUTH-023 AUTH-024
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  emulatorSecret,
  hmacHex,
  ok,
  outcome,
  PASSWORD,
  postWebhook,
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

// ---------------------------------------------------------------------------
// Browser storage
// ---------------------------------------------------------------------------
class FakeStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

const storage = new FakeStorage();
const FORGED = {
  dsbc_entitlement_plans_v1: [{ id: 'individual_free', targetType: 'individual', price: 0, features: { 'individual.ai_assistance': { status: 'UNLIMITED' } } }],
  dsbc_entitlement_overrides_v1: [{ id: 'forged', targetType: 'individual', targetId: 'u_ind', featureId: 'individual.ai_assistance', rule: { status: 'UNLIMITED' }, grantType: 'permanent', expiresAt: null }],
  dsbc_entitlement_policy_v1: { maintenanceMode: false, globalFeatureOverrides: { 'individual.ai_assistance': { status: 'UNLIMITED' } } },
  dsbc_entitlement_usage_v1: [{ targetId: 'u_ind', featureId: 'individual.ai_assistance', currentValue: 0 }],
  dsbc_subscriptions_v1: [{ subscriptionId: 'sub_forged', customerType: 'individual', customerId: 'u_ind', planId: 'individual_pro', status: 'ACTIVE', paymentStatus: 'PAID', price: 100 }],
  dsbc_invoices_v1: [{ invoiceId: 'INV-FORGED', customerId: 'u_ind', paymentStatus: 'PAID', amount: 100 }],
  dsbc_publishing_records_v1: [{ id: 'card_b1', publishingState: 'PUBLISHED' }],
  dsbc_pilot_registry_v1: [{ customerId: 'u_ind', isPilot: true, stage: 'PAID_ACTIVE' }],
};

type ClientModules = {
  entitlementService: typeof import('../../src/services/entitlementService').entitlementService;
  subscriptionService: typeof import('../../src/services/subscriptionService').subscriptionService;
  commercialStore: typeof import('../../src/services/commercialStore').commercialStore;
  purge: typeof import('../../src/services/commercialStore').purgeLegacyAuthorityKeys;
  keys: readonly string[];
  signIn: () => Promise<void>;
};
let client: ClientModules;

async function loadClient(): Promise<ClientModules> {
  for (const [k, v] of Object.entries(FORGED)) storage.setItem(k, JSON.stringify(v));
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  const ent = await import('../../src/services/entitlementService');
  const subs = await import('../../src/services/subscriptionService');
  const store = await import('../../src/services/commercialStore');
  const fb = await import('../../src/lib/firebase');
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  expect(fb.USE_EMULATORS).toBe(true); // the client under test is wired to the emulator suite
  return {
    entitlementService: ent.entitlementService,
    subscriptionService: subs.subscriptionService,
    commercialStore: store.commercialStore,
    purge: store.purgeLegacyAuthorityKeys,
    keys: store.LEGACY_AUTHORITY_KEYS,
    signIn: async () => {
      await signInWithEmailAndPassword(fb.auth, w.individual.email, PASSWORD);
    },
  };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe('AUTH-019 localStorage entitlement manipulation has no effect', () => {
  beforeAll(async () => {
    client = await loadClient();
  });

  it('with forged storage and no server answer, the client shows the feature locked (fail closed)', () => {
    const eff = client.entitlementService.getEffectiveEntitlement({ userId: w.individual.uid }, 'individual.ai_assistance');
    expect(eff.isGranted).toBe(false);
    expect(client.entitlementService.getPlans()).toEqual([]); // forged plans are never loaded
    expect(client.entitlementService.getOverrides()).toEqual([]);
  });

  it('after sign-in the client shows exactly what the server resolved, ignoring forged storage', async () => {
    await client.signIn();
    client.commercialStore.setSession({ uid: w.individual.uid, isAppOwner: false, userIds: [w.individual.uid], companyId: null });
    await client.commercialStore.refreshSnapshot();
    const shown = client.entitlementService.getEffectiveEntitlement({ userId: w.individual.uid }, 'individual.ai_assistance');
    const server = await ok('checkEntitlement', { featureId: 'individual.ai_assistance' }, w.individual);
    expect(server.allowed).toBe(false);
    expect(shown).toEqual(server.entitlement);
    expect(client.entitlementService.can({ userId: w.individual.uid }, 'individual.ai_assistance')).toBe(false);
  });

  it('the forged values are ignored by the backend and nothing is ever read from the legacy keys', () => {
    const codeOf = (f: string) => readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const offenders = sourceFiles('src')
      .filter((f) => !f.endsWith('commercialStore.ts')) // holds the purge list
      .filter((f) => client.keys.some((k) => codeOf(f).includes(k)));
    expect(offenders).toEqual([]);
  });

  it('legacy authority keys are purged from browser storage', () => {
    client.purge(storage);
    for (const k of client.keys) expect(storage.getItem(k)).toBeNull();
  });
});

describe('AUTH-020 localStorage subscription manipulation has no effect', () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(FORGED)) storage.setItem(k, JSON.stringify(v));
  });

  it('the displayed subscription is the server one (free), not the forged ACTIVE/PAID record', () => {
    const current = client.subscriptionService.getCurrentSubscription()!;
    expect(current.planId).toBe('individual_free');
    expect(current.paymentStatus).not.toBe('PAID');
    expect(client.subscriptionService.getInvoices()).toEqual([]);
  });

  it('an upgrade request from the client is refused by the backend and changes nothing', async () => {
    const res = await client.subscriptionService.upgradeSubscription('individual', w.individual.uid, 'individual_pro');
    expect(res.success).toBe(false);
    expect(res.message).toContain('payments are not active');
    expect((await adminDb.doc(`subscriptions/individual_${w.individual.uid}`).get()).exists).toBe(false);
    const state = await ok('getMyCommercialState', {}, w.individual);
    expect(state.subscriptionState.planIdForAccess).toBe('individual_free');
  });

  it('the client has no code path that writes a subscription', () => {
    const offenders = sourceFiles('src').filter((f) => /(setDoc|updateDoc|addDoc)\([^)]*['"](subscriptions|invoices|paymentOrders|entitlementOverrides|plans|usageCounters)['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  afterAll(() => {
    client.commercialStore.setSession(null);
  });
});

// ---------------------------------------------------------------------------
// Payment webhooks
// ---------------------------------------------------------------------------
const ORDER = 'order_WEBHOOK01';
function paymentEvent(opts: { event?: string; orderId?: string; amount?: number; paymentId?: string } = {}) {
  return JSON.stringify({
    entity: 'event',
    event: opts.event ?? 'payment.captured',
    payload: { payment: { entity: { id: opts.paymentId ?? 'pay_WEBHOOK01', order_id: opts.orderId ?? ORDER, amount: opts.amount ?? 60000, currency: 'INR', status: 'captured' } } },
    created_at: Math.floor(Date.now() / 1000),
  });
}
const signed = (body: string, eventId: string) => ({ 'x-razorpay-signature': hmacHex(body, emulatorSecret('RAZORPAY_WEBHOOK_SECRET')), 'x-razorpay-event-id': eventId });
const coA = async () => (await adminDb.doc('subscriptions/company_co_a').get()).data();

describe('webhooks', () => {
  beforeAll(async () => {
    for (const [id, providerOrderId] of [['ord_w1', ORDER], ['ord_w2', 'order_WEBHOOK02']] as const) {
      await adminDb.doc(`paymentOrders/${id}`).set({
        id, provider: 'razorpay', providerOrderId, status: 'CREATED', customerType: 'company', customerId: 'co_a', tenantId: 'co_a',
        customerName: 'Company co_a', planId: 'company_pro', planName: 'Company Pro', billingCycle: 'yearly', amountMinor: 60000, currency: 'INR',
        createdByUid: w.adminA.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
    }
  });

  describe('AUTH-021 forged webhook rejected', () => {
    it('wrong secret, missing signature, legacy format and a re-signed tampered body are all 401', async () => {
      const body = paymentEvent();
      const attempts: Array<Record<string, string>> = [
        { 'x-razorpay-signature': hmacHex(body, 'rzp_sec_dsbc_production_webhook_secret_2026'), 'x-razorpay-event-id': 'evt_f1' }, // the old bundled "secret"
        { 'x-razorpay-event-id': 'evt_f2' },
        { 'x-razorpay-signature': 'sig_rzp_forged_signature_value', 'x-razorpay-event-id': 'evt_f3' },
      ];
      for (const headers of attempts) expect((await postWebhook(body, headers)).status).toBe(401);
      // Signature of the genuine body, body amount changed in transit.
      const tampered = paymentEvent({ amount: 100 });
      expect((await postWebhook(tampered, signed(body, 'evt_f4'))).status).toBe(401);
    });

    it('nothing was recorded or activated', async () => {
      expect((await adminDb.collection('webhookEvents').get()).size).toBe(0);
      expect(await coA()).toBeUndefined();
      expect((await adminDb.doc('paymentOrders/ord_w1').get()).get('status')).toBe('CREATED');
    });

    it('browsers cannot write the webhook ledger', async () => {
      const db = await browser(w.adminA);
      expect(await outcome(setDoc(doc(db, 'webhookEvents', 'razorpay_evt_x'), { outcome: 'ACTIVATED' }))).toBe('permission-denied');
    });
  });

  describe('AUTH-022 malformed webhook rejected', () => {
    it('validly signed but malformed requests are 400 and nothing is written', async () => {
      const cases: Array<[string, Record<string, string> | null]> = [
        ['not json at all', null],
        [JSON.stringify({ payload: {} }), null], // no event
        [JSON.stringify({ event: 'payment.captured' }), null], // no payload
        [JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'p', amount: '600', currency: 'INR' } } } }), null], // amount not integer
        [paymentEvent(), { 'x-razorpay-event-id': '' }], // missing event id
      ];
      for (const [body, override] of cases) {
        const headers = { ...signed(body, 'evt_malformed'), ...(override ?? {}) };
        if (override && override['x-razorpay-event-id'] === '') delete (headers as Record<string, string>)['x-razorpay-event-id'];
        expect((await postWebhook(body, headers)).status).toBe(400);
      }
      expect((await adminDb.collection('webhookEvents').get()).size).toBe(0);
      expect(await coA()).toBeUndefined();
    });

    it('non-POST requests are refused', async () => {
      const res = await fetch(`http://127.0.0.1:5481/${process.env.GCLOUD_PROJECT || 'demo-dsbc'}/us-central1/razorpayWebhook`);
      expect(res.status).toBe(405);
    });
  });

  describe('AUTH-023 duplicate webhook is idempotent', () => {
    it('a verified capture activates the server-priced plan once', async () => {
      const body = paymentEvent();
      const first = await postWebhook(body, signed(body, 'evt_ok_1'));
      expect(first.status).toBe(200);
      expect(first.body.outcome).toBe('ACTIVATED');
      const s = (await coA())!;
      expect([s.planId, s.status, s.paymentStatus, s.provider]).toEqual(['company_pro', 'ACTIVE', 'PAID', 'razorpay']);
      expect((await adminDb.collection('invoices').get()).size).toBe(1);
    });

    it('the same event delivered again changes nothing', async () => {
      const body = paymentEvent();
      const again = await postWebhook(body, signed(body, 'evt_ok_1'));
      expect(again.status).toBe(200);
      expect(again.body.duplicate).toBe(true);
      expect((await adminDb.collection('invoices').get()).size).toBe(1);
      expect((await adminDb.collection('commercialAuditLogs').where('action', '==', 'PAYMENT_RECEIVED').get()).size).toBe(1);
    });

    it('a second event for the same order (order.paid) is ALREADY_APPLIED', async () => {
      const body = paymentEvent({ event: 'order.paid' });
      const res = await postWebhook(body, signed(body, 'evt_ok_2'));
      expect(res.body.outcome).toBe('ALREADY_APPLIED');
      expect((await adminDb.collection('invoices').get()).size).toBe(1);
    });

    it('a capture whose amount differs from the server-priced order is rejected', async () => {
      const body = paymentEvent({ orderId: 'order_WEBHOOK02', amount: 100, paymentId: 'pay_UNDERPAID' });
      const res = await postWebhook(body, signed(body, 'evt_underpaid'));
      expect(res.body.outcome).toBe('AMOUNT_MISMATCH');
      expect((await adminDb.doc('paymentOrders/ord_w2').get()).get('status')).toBe('AMOUNT_MISMATCH');
      expect((await adminDb.collection('invoices').get()).size).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------
describe('AUTH-024 unauthorized publishing mutations are rejected', () => {
  it('the owner (employee of the card) can publish; the slug is claimed server-side and audited', async () => {
    const res = await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED', slug: 'employee-a1' }, w.employeeA);
    expect(res.publishingState).toBe('PUBLISHED');
    expect((await adminDb.doc('slugs/employee-a1').get()).get('entityId')).toBe('card_a1');
    expect((await adminDb.collection('platformAuditLogs').where('action', '==', 'PUBLISHING_PUBLISHED').get()).size).toBe(1);
  });

  it('another tenant cannot publish, unpublish or take the slug', async () => {
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'UNPUBLISHED' }, w.adminB)).status).toBe('PERMISSION_DENIED');
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_b1', state: 'PUBLISHED', slug: 'employee-a1' }, w.adminB)).status).toBe('ALREADY_EXISTS');
    expect((await call('setPublishingState', { entityType: 'company', entityId: 'co_a', state: 'PUBLISHED', slug: 'company-a' }, w.employeeA)).status).toBe('PERMISSION_DENIED');
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_b1', state: 'PUBLISHED', slug: 'admin' }, w.adminB)).status).toBe('INVALID_ARGUMENT');
  });

  it('browsers cannot write publishing records, slugs or backend visibility flags', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(setDoc(doc(db, 'publishingRecords', 'card_b1'), { publishingState: 'PUBLISHED', tenantId: 'co_b' }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'slugs', 'employee-b1'), { entityId: 'card_a1' }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(db, 'cards', 'card_a1'), { publicationHidden: true }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(db, 'cards', 'card_a1'), { platformSuspended: true }))).toBe('permission-denied');
  });

  it('unpublishing hides the card from the public (rule-enforced, not a URL flag)', async () => {
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'UNPUBLISHED' }, w.adminA);
    expect(await outcome(getDoc(doc(await browser(null), 'cards', 'card_a1')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(await browser(w.adminA), 'cards', 'card_a1')))).toBe('ALLOWED');
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED' }, w.adminA);
    expect(await outcome(getDoc(doc(await browser(null), 'cards', 'card_a1')))).toBe('ALLOWED');
  });

  it('a platform suspension can only be set or lifted by the App Owner', async () => {
    expect((await call('adminSetPublishingSuspension', { entityType: 'card', entityId: 'card_b1', suspended: true, reason: 'x' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    await ok('adminSetPublishingSuspension', { entityType: 'card', entityId: 'card_a1', suspended: true, reason: 'Policy violation' }, w.owner);
    expect(await outcome(getDoc(doc(await browser(null), 'cards', 'card_a1')))).toBe('permission-denied');
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'cards', 'card_a1'), { platformSuspended: deleteField() }))).toBe('permission-denied');
    expect((await call('adminSetPublishingSuspension', { entityType: 'card', entityId: 'card_a1', suspended: false, reason: 'self' }, w.adminA)).status).toBe('PERMISSION_DENIED');
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED' }, w.employeeA)).status).toBe('PERMISSION_DENIED');
    await ok('adminSetPublishingSuspension', { entityType: 'card', entityId: 'card_a1', suspended: false, reason: 'Resolved' }, w.owner);
    expect((await adminDb.doc('cards/card_a1').get()).get('platformSuspended')).toBeUndefined();
  });

  it('a released slug is quarantined against takeover; only its previous owner may reclaim it', async () => {
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED', slug: 'employee-a1-renamed' }, w.employeeA);
    const released = (await adminDb.doc('slugs/employee-a1').get()).data()!;
    expect(released.entityId).toBe('card_a1');
    expect(released.quarantinedUntil.toMillis()).toBeGreaterThan(Date.now() + 89 * 86_400_000);
    expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_b1', state: 'PUBLISHED', slug: 'employee-a1' }, w.adminB)).status).toBe('ALREADY_EXISTS');

    // After the quarantine window another tenant may take it.
    await adminDb.doc('slugs/employee-a1').update({ quarantinedUntil: Timestamp.fromMillis(Date.now() - 1000) });
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_b1', state: 'PUBLISHED', slug: 'employee-a1' }, w.adminB);
    expect((await adminDb.doc('slugs/employee-a1').get()).data()).toMatchObject({ entityId: 'card_b1', quarantinedUntil: null });

    // The previous owner reclaims its own quarantined slug.
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED', slug: 'employee-a1-final' }, w.employeeA);
    await ok('setPublishingState', { entityType: 'card', entityId: 'card_a1', state: 'PUBLISHED', slug: 'employee-a1-renamed' }, w.employeeA);
    expect((await adminDb.doc('slugs/employee-a1-renamed').get()).data()).toMatchObject({ entityId: 'card_a1', quarantinedUntil: null });
  });
});
