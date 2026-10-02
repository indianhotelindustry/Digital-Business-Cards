// ============================================================================
// Checkout, payment confirmation, webhook processing, invoices (Phase 12)
// ============================================================================
// Paid access is granted ONLY by activatePaidOrder(), which runs only after
//   (a) a Razorpay webhook whose HMAC over the raw body verified, or
//   (b) a checkout callback whose HMAC verified AND whose payment the provider
//       API confirms as captured for the exact order amount.
// The amount always comes from the server-side paymentOrders record, which
// was priced from plans/{planId}; the browser never supplies a price.

import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { deny, fail, invalid } from '../shared/errors';
import { isoInDays, nowIso, serverNow } from '../shared/time';
import { ID_PATTERN, num, obj, oneOf, PLAN_ID_PATTERN, reason, str } from '../shared/validate';
import { actorOf, PROVIDER_ACTOR, requireAppOwner, resolveCommercialSubject, resolveCustomerTenant, type Caller } from '../auth/identity';
import { appendAudit, type AuditActor } from '../audit/ledger';
import { loadControlPlane, subscriptionFromDoc } from '../entitlements/controlPlane';
import { subscriptionRef, writeSubscription } from '../subscriptions/service';
import { MalformedWebhookError, type PaymentProvider, type ProviderPayment } from './paymentProvider';
import type { CustomerType, Invoice, InvoiceItem } from '../../../shared/domain/subscriptionTypes';

export const toMinor = (amount: number) => Math.round(amount * 100);

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
const counterRef = () => db().collection('counters').doc('invoices');

/** Must be called in the read phase of the transaction. */
export async function reserveInvoiceNumber(tx: Transaction): Promise<{ number: string; next: number }> {
  const snap = await tx.get(counterRef());
  const next = ((snap.exists ? Number(snap.get('next')) : 0) || 0) + 1;
  return { number: `INV-${new Date().getUTCFullYear()}-${String(next).padStart(6, '0')}`, next };
}

export function writeInvoice(tx: Transaction, reserved: { number: string; next: number }, inv: Omit<Invoice, 'invoiceId' | 'issuedAt'>, actor: AuditActor, why: string): string {
  tx.set(counterRef(), { next: reserved.next, updatedAt: serverNow() });
  const ref = db().collection('invoices').doc(reserved.number);
  tx.create(ref, { ...JSON.parse(JSON.stringify(inv)), invoiceId: reserved.number, issuedAt: serverNow(), paidAt: inv.paymentStatus === 'PAID' ? serverNow() : null });
  appendAudit(tx, 'commercialAuditLogs', {
    action: 'INVOICE_ISSUED', actor, targetType: inv.customerType, targetId: inv.customerId, targetName: inv.customerName, tenantId: inv.tenantId,
    previousValue: null, newValue: { invoiceId: reserved.number, amount: inv.amount, currency: inv.currency, paymentStatus: inv.paymentStatus },
    reason: why, source: 'Billing',
  });
  return reserved.number;
}

// ---------------------------------------------------------------------------
// Activation (shared by webhook and confirmPayment)
// ---------------------------------------------------------------------------
export interface ActivationResult {
  outcome: 'ACTIVATED' | 'ALREADY_APPLIED' | 'AMOUNT_MISMATCH' | 'ORDER_NOT_FOUND' | 'NOT_CAPTURED';
  orderId?: string;
  invoiceId?: string;
}

/**
 * Transactional: reads order, subscription and invoice counter, then writes.
 * Idempotent per order: an order that is already PAID is never applied twice.
 */
async function activatePaidOrder(
  tx: Transaction,
  orderRef: FirebaseFirestore.DocumentReference,
  payment: ProviderPayment,
  actor: AuditActor,
  source: string
): Promise<ActivationResult> {
  const orderSnap = await tx.get(orderRef);
  if (!orderSnap.exists) return { outcome: 'ORDER_NOT_FOUND' };
  const order = orderSnap.data()!;
  if (order.status === 'PAID') return { outcome: 'ALREADY_APPLIED', orderId: orderRef.id };
  if (payment.status !== 'captured') return { outcome: 'NOT_CAPTURED', orderId: orderRef.id };
  if (payment.amountMinor !== order.amountMinor || payment.currency !== order.currency || payment.orderId !== order.providerOrderId) {
    tx.update(orderRef, { status: 'AMOUNT_MISMATCH', lastPaymentId: payment.paymentId, updatedAt: serverNow() });
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'PAYMENT_REJECTED', actor, targetType: order.customerType, targetId: order.customerId, tenantId: order.tenantId,
      previousValue: { amountMinor: order.amountMinor, currency: order.currency }, newValue: { amountMinor: payment.amountMinor, currency: payment.currency, paymentId: payment.paymentId },
      reason: 'Captured amount/currency/order does not match the server-priced order', source,
    });
    return { outcome: 'AMOUNT_MISMATCH', orderId: orderRef.id };
  }

  const subSnap = await tx.get(subscriptionRef(order.customerType, order.customerId));
  const prev = subSnap.exists ? subscriptionFromDoc(subSnap.data()!) : null;
  const reserved = await reserveInvoiceNumber(tx);

  // ---- writes ----
  const periodDays = order.billingCycle === 'monthly' ? 31 : order.billingCycle === 'lifetime' ? 36500 : 365;
  const sub = writeSubscription(tx, prev, {
    customerType: order.customerType, customerId: order.customerId, tenantId: order.tenantId, customerName: order.customerName,
    next: {
      planId: order.planId, status: 'ACTIVE', paymentStatus: 'PAID', provider: 'razorpay', price: order.amountMinor / 100,
      currency: order.currency, billingInterval: order.billingCycle, currentPeriodStart: nowIso(), currentPeriodEnd: isoInDays(periodDays),
      trialEndsAt: null, graceEndsAt: null, cancelAtPeriodEnd: false, cancelledAt: null, statusBeforeSuspension: null,
    },
    action: 'PAYMENT_RECEIVED', actor, reason: `Verified payment ${payment.paymentId} for order ${order.providerOrderId}`, source,
  });
  const invoiceId = writeInvoice(tx, reserved, {
    customerId: order.customerId, customerType: order.customerType, customerName: order.customerName, tenantId: order.tenantId,
    subscriptionId: sub.subscriptionId, planId: order.planId, planName: order.planName, amount: order.amountMinor / 100,
    currency: order.currency, billingInterval: order.billingCycle, paymentStatus: 'PAID', provider: 'Razorpay',
    paymentReference: payment.paymentId, items: [{ description: `${order.planName} subscription`, amount: order.amountMinor / 100, quantity: 1 }],
  }, actor, `Payment ${payment.paymentId}`);
  tx.update(orderRef, { status: 'PAID', paymentId: payment.paymentId, invoiceId, paidAt: serverNow(), updatedAt: serverNow() });
  return { outcome: 'ACTIVATED', orderId: orderRef.id, invoiceId };
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
export async function createCheckoutOrder(caller: Caller, data: unknown, provider: PaymentProvider, paymentsEnabled: boolean, keyId: string) {
  const p = obj(data, ['planId']);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const subject = await resolveCommercialSubject(caller);
  if (!subject.isBillingContact) deny('Only the billing contact may purchase a plan for this account.');
  const plan = (await loadControlPlane()).plans.get(planId);
  if (!plan || !plan.isActive || plan.archived) fail('not-found', `Plan ${planId} is not available.`);
  if (plan!.targetType !== subject.customerType) invalid(`Plan ${planId} is not a ${subject.customerType} plan.`);
  if (plan!.price <= 0) fail('failed-precondition', 'Free plans are not purchased.');
  if (!paymentsEnabled) fail('failed-precondition', 'PAYMENTS_NOT_ENABLED: online payments are not active yet. Contact the platform owner.');

  const amountMinor = toMinor(plan!.price);
  const ref = db().collection('paymentOrders').doc();
  const order = await provider.createOrder({
    amountMinor, currency: plan!.currency, receipt: ref.id,
    notes: { dsbcOrderId: ref.id, customerType: subject.customerType, customerId: subject.customerId, planId },
  });
  await ref.create({
    id: ref.id, provider: provider.name, providerOrderId: order.providerOrderId, status: 'CREATED',
    customerType: subject.customerType, customerId: subject.customerId, tenantId: subject.tenantId,
    customerName: caller.profile?.displayName || subject.customerId, planId, planName: plan!.name,
    billingCycle: plan!.billingCycle, amountMinor, currency: plan!.currency, createdByUid: caller.uid,
    createdAt: serverNow(), updatedAt: serverNow(),
  });
  return { orderId: ref.id, providerOrderId: order.providerOrderId, amountMinor, currency: plan!.currency, keyId };
}

export async function confirmPayment(caller: Caller, data: unknown, provider: PaymentProvider, paymentsEnabled: boolean) {
  const p = obj(data, ['orderId', 'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature']);
  const orderId = str(p, 'orderId', { pattern: ID_PATTERN });
  const razorpayOrderId = str(p, 'razorpayOrderId', { max: 64 });
  const razorpayPaymentId = str(p, 'razorpayPaymentId', { max: 64 });
  const signature = str(p, 'razorpaySignature', { max: 128 });
  const subject = await resolveCommercialSubject(caller);

  const orderRef = db().collection('paymentOrders').doc(orderId);
  const order = await orderRef.get();
  if (!order.exists) fail('not-found', 'Order not found.');
  if (order.get('customerType') !== subject.customerType || order.get('customerId') !== subject.customerId) deny('Order belongs to another customer.');
  if (order.get('providerOrderId') !== razorpayOrderId) deny('Order mismatch.');
  if (!provider.verifyPayment({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature })) {
    deny('INVALID_PAYMENT_SIGNATURE');
  }
  if (!paymentsEnabled) fail('failed-precondition', 'PAYMENTS_NOT_ENABLED');

  // Never trust the callback alone: confirm the captured amount with the provider.
  const payment = await provider.reconcilePayment(razorpayPaymentId);
  const result = await db().runTransaction((tx) => activatePaidOrder(tx, orderRef, payment, actorOf(caller), 'Checkout confirmation (verified)'));
  if (result.outcome !== 'ACTIVATED' && result.outcome !== 'ALREADY_APPLIED') fail('failed-precondition', result.outcome);
  return result;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
export interface WebhookRequest {
  method: string;
  rawBody: Buffer | undefined;
  signature: string | undefined;
  eventId: string | undefined;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

const EVENT_ID = /^[A-Za-z0-9_\-]{1,128}$/;

export async function processWebhook(req: WebhookRequest, provider: PaymentProvider): Promise<WebhookResponse> {
  if (req.method !== 'POST') return { status: 405, body: { error: 'METHOD_NOT_ALLOWED' } };
  if (!req.rawBody || !req.rawBody.length) return { status: 400, body: { error: 'EMPTY_BODY' } };
  if (!provider.verifyWebhookSignature(req.rawBody, req.signature)) {
    return { status: 401, body: { error: 'INVALID_SIGNATURE' } };
  }
  let event;
  try {
    event = provider.parseWebhookEvent(req.rawBody);
  } catch (err) {
    if (err instanceof MalformedWebhookError) return { status: 400, body: { error: 'MALFORMED_PAYLOAD', detail: err.message } };
    throw err;
  }
  if (!req.eventId || !EVENT_ID.test(req.eventId)) return { status: 400, body: { error: 'MISSING_EVENT_ID' } };

  const eventRef = db().collection('webhookEvents').doc(`${provider.name}_${req.eventId}`);
  const result = await db().runTransaction(async (tx) => {
    const seen = await tx.get(eventRef);
    if (seen.exists) return { duplicate: true, outcome: seen.get('outcome') as string };

    let outcome = 'IGNORED';
    let orderId: string | null = null;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && event.payment && event.orderId) {
      const orders = await tx.get(db().collection('paymentOrders').where('providerOrderId', '==', event.orderId).limit(1));
      if (orders.empty) {
        outcome = 'ORDER_NOT_FOUND';
      } else {
        orderId = orders.docs[0].id;
        outcome = (await activatePaidOrder(tx, orders.docs[0].ref, event.payment, PROVIDER_ACTOR, 'Razorpay webhook (HMAC verified)')).outcome;
      }
    } else if (event.event === 'payment.failed' && event.orderId) {
      const orders = await tx.get(db().collection('paymentOrders').where('providerOrderId', '==', event.orderId).limit(1));
      if (!orders.empty && orders.docs[0].get('status') !== 'PAID') {
        orderId = orders.docs[0].id;
        const o = orders.docs[0].data();
        tx.update(orders.docs[0].ref, { status: 'FAILED', updatedAt: serverNow() });
        appendAudit(tx, 'commercialAuditLogs', {
          action: 'PAYMENT_FAILED', actor: PROVIDER_ACTOR, targetType: o.customerType, targetId: o.customerId, tenantId: o.tenantId,
          previousValue: { orderStatus: o.status }, newValue: { orderStatus: 'FAILED', paymentId: event.payment?.paymentId ?? null },
          reason: 'Provider reported payment failure', source: 'Razorpay webhook (HMAC verified)',
        });
        outcome = 'ORDER_FAILED';
      } else {
        outcome = 'ORDER_NOT_FOUND';
      }
    }
    tx.create(eventRef, {
      provider: provider.name, eventId: req.eventId, event: event.event, orderId, providerOrderId: event.orderId,
      paymentId: event.payment?.paymentId ?? null, outcome, receivedAt: serverNow(),
    });
    return { duplicate: false, outcome };
  });
  return { status: 200, body: { received: true, ...result } };
}

// ---------------------------------------------------------------------------
// App Owner invoice controls
// ---------------------------------------------------------------------------
export async function adminCreateInvoice(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'planId', 'items', 'currency', 'paymentStatus', 'reason']);
  const customerType = oneOf(p, 'customerType', ['individual', 'company'] as const) as CustomerType;
  const customerId = str(p, 'customerId', { pattern: ID_PATTERN });
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const currency = str(p, 'currency', { pattern: /^[A-Z]{3}$/ });
  const paymentStatus = oneOf(p, 'paymentStatus', ['PENDING', 'COMPLIMENTARY'] as const);
  const why = reason(p);
  if (!Array.isArray(p.items) || !p.items.length || p.items.length > 50) invalid('items must be a non-empty array.');
  const items: InvoiceItem[] = (p.items as unknown[]).map((raw) => {
    const it = obj(raw, ['description', 'amount', 'quantity']);
    return { description: str(it, 'description', { max: 200 }), amount: num(it, 'amount', { min: 0, max: 100_000_000 }), quantity: num(it, 'quantity', { min: 1, max: 10_000, int: true }) };
  });
  const plan = (await loadControlPlane()).plans.get(planId);
  if (!plan) fail('not-found', `Plan ${planId} does not exist.`);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  const amount = Math.round(items.reduce((s, i) => s + i.amount * i.quantity, 0) * 100) / 100;
  return db().runTransaction(async (tx) => {
    const reserved = await reserveInvoiceNumber(tx);
    const invoiceId = writeInvoice(tx, reserved, {
      customerId, customerType, customerName: name, tenantId, subscriptionId: subscriptionRef(customerType, customerId).id,
      planId, planName: plan!.name, amount, currency, billingInterval: plan!.billingCycle, paymentStatus, provider: 'manual', items,
    }, actorOf(caller), why);
    return { invoiceId, amount };
  });
}

/** Records an offline (bank transfer) payment against a PENDING manual invoice. */
export async function adminRecordInvoicePayment(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['invoiceId', 'paymentReference', 'reason']);
  const invoiceId = str(p, 'invoiceId', { pattern: /^INV-\d{4}-\d{6}$/ });
  const paymentReference = str(p, 'paymentReference', { max: 120 });
  const why = reason(p);
  const ref = db().collection('invoices').doc(invoiceId);
  return db().runTransaction(async (tx) => {
    const inv = await tx.get(ref);
    if (!inv.exists) fail('not-found', 'Invoice not found.');
    if (inv.get('paymentStatus') !== 'PENDING') fail('failed-precondition', `Invoice is ${inv.get('paymentStatus')}.`);
    tx.update(ref, { paymentStatus: 'PAID', paymentReference, paidAt: serverNow() });
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'INVOICE_PAYMENT_RECORDED', actor: actorOf(caller), targetType: inv.get('customerType'), targetId: inv.get('customerId'),
      tenantId: inv.get('tenantId'), previousValue: { paymentStatus: 'PENDING' }, newValue: { paymentStatus: 'PAID', paymentReference },
      reason: why, source: 'App Owner Billing',
    });
    return { invoiceId, paymentStatus: 'PAID' };
  });
}
