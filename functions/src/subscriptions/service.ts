// ============================================================================
// SubscriptionService — backend authority (Directive 25 Phase 9)
// ============================================================================
// Lifecycle: TRIAL ACTIVE PAST_DUE GRACE CANCELLED EXPIRED SUSPENDED COMPLIMENTARY
// Only three kinds of actor change a subscription:
//   * the App Owner (complimentary, trial, plan assignment, status changes);
//   * the payment pipeline after cryptographic verification (billing/);
//   * the scheduled reconciler (time-based transitions).
// A customer may only cancel. There is no code path by which a browser turns
// itself into ACTIVE/PAID. Nothing here deletes customer content.

import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { deny, fail, invalid } from '../shared/errors';
import { isoInDays, nowIso, nowMs, serverNow, ts } from '../shared/time';
import { bool, ID_PATTERN, num, obj, oneOf, PLAN_ID_PATTERN, reason, str } from '../shared/validate';
import {
  actorOf,
  requireAppOwner,
  resolveCommercialSubject,
  resolveCustomerTenant,
  SYSTEM_ACTOR,
  type Caller,
} from '../auth/identity';
import { appendAudit, type AuditActor } from '../audit/ledger';
import { loadControlPlane, subscriptionFromDoc } from '../entitlements/controlPlane';
import { commercialSnapshot } from '../entitlements/resolution';
import {
  ACCESS_GRANTING_STATUSES,
  isTransitionAllowed,
  SUBSCRIPTION_STATUSES,
  subscriptionDocId,
  timeAdjustedStatus,
} from '../../../shared/domain/subscriptionLifecycle';
import { fitsLimit, lockStateOf } from '../../../shared/domain/entitlementResolver';
import type { CustomerType, PaymentStatus, Subscription, SubscriptionStatus } from '../../../shared/domain/subscriptionTypes';
import type { Plan } from '../../../shared/domain/entitlementTypes';
import { buildResolutionContext } from '../entitlements/resolution';

export const subscriptionRef = (customerType: CustomerType, customerId: string) =>
  db().collection('subscriptions').doc(subscriptionDocId(customerType, customerId));

const DATE_FIELDS = ['startedAt', 'currentPeriodStart', 'currentPeriodEnd', 'trialEndsAt', 'graceEndsAt', 'cancelledAt'] as const;

/** Domain object -> Firestore document (business dates as Timestamps). */
function toDoc(sub: Partial<Subscription>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...sub };
  for (const k of DATE_FIELDS) {
    const v = sub[k];
    if (v !== undefined) out[k] = v ? ts(v) : null;
  }
  delete out.createdAt;
  delete out.updatedAt;
  return out;
}

export interface SubscriptionWrite {
  customerType: CustomerType;
  customerId: string;
  tenantId: string;
  customerName: string;
  next: Partial<Subscription>;
  action: string;
  actor: AuditActor;
  reason: string;
  source: string;
}

/**
 * Write a subscription change and its audit record in the caller's
 * transaction. `prev` must have been read in the same transaction.
 */
export function writeSubscription(tx: Transaction, prev: Subscription | null, w: SubscriptionWrite): Subscription {
  const ref = subscriptionRef(w.customerType, w.customerId);
  const base: Subscription = prev ?? {
    subscriptionId: ref.id,
    customerType: w.customerType,
    customerId: w.customerId,
    customerName: w.customerName,
    planId: '',
    status: 'ACTIVE',
    currency: 'INR',
    billingInterval: 'free',
    price: 0,
    startedAt: nowIso(),
    currentPeriodStart: nowIso(),
    currentPeriodEnd: isoInDays(365),
    trialEndsAt: null,
    graceEndsAt: null,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    paymentStatus: 'COMPLIMENTARY',
    provider: 'free',
    createdAt: '',
    updatedAt: '',
  };
  const merged: Subscription = { ...base, ...w.next, subscriptionId: ref.id, customerType: w.customerType, customerId: w.customerId, tenantId: w.tenantId };
  tx.set(ref, { ...toDoc(merged), createdAt: prev ? ts(prev.createdAt || nowIso()) : serverNow(), updatedAt: serverNow() });

  if (w.customerType === 'company' && merged.planId !== prev?.planId) {
    // Display mirror only; company admins cannot write planId (firestore.rules).
    tx.update(db().collection('companies').doc(w.customerId), { planId: merged.planId });
  }

  appendAudit(tx, 'commercialAuditLogs', {
    action: w.action, actor: w.actor, targetType: w.customerType, targetId: w.customerId, targetName: w.customerName,
    tenantId: w.tenantId,
    previousValue: prev ? { planId: prev.planId, status: prev.status, paymentStatus: prev.paymentStatus } : 'NONE',
    newValue: { planId: merged.planId, status: merged.status, paymentStatus: merged.paymentStatus, currentPeriodEnd: merged.currentPeriodEnd },
    reason: w.reason, source: w.source,
  });
  return merged;
}

async function readSub(tx: Transaction, customerType: CustomerType, customerId: string): Promise<Subscription | null> {
  const snap = await tx.get(subscriptionRef(customerType, customerId));
  return snap.exists ? subscriptionFromDoc(snap.data()!) : null;
}

function customerArgs(p: Record<string, unknown>) {
  return {
    customerType: oneOf(p, 'customerType', ['individual', 'company'] as const),
    customerId: str(p, 'customerId', { pattern: ID_PATTERN }),
  };
}

async function requirePlan(planId: string, customerType: CustomerType, allowInactive = true): Promise<Plan> {
  const cp = await loadControlPlane();
  const plan = cp.plans.get(planId);
  if (!plan) fail('not-found', `Plan ${planId} does not exist.`);
  if (plan!.targetType !== customerType) invalid(`Plan ${planId} is a ${plan!.targetType} plan.`);
  if (!allowInactive && (!plan!.isActive || plan!.archived)) fail('failed-precondition', `Plan ${planId} is not available.`);
  return plan!;
}

// ---------------------------------------------------------------------------
// Customer-facing reads
// ---------------------------------------------------------------------------
export async function getMyCommercialState(caller: Caller) {
  return commercialSnapshot(await resolveCommercialSubject(caller), nowMs());
}

/** "Can I perform this operation?" — the server decides. */
export async function checkEntitlement(caller: Caller, data: unknown) {
  const p = obj(data, ['featureId', 'amount']);
  const featureId = str(p, 'featureId', { pattern: ID_PATTERN });
  const amount = p.amount === undefined ? 1 : num(p, 'amount', { min: 0, max: 1_000_000, int: true });
  const subject = await resolveCommercialSubject(caller);
  const eff = (await buildResolutionContext(subject, nowMs())).resolve(featureId);
  const allowed = caller.isAppOwner || (eff.isGranted && fitsLimit(eff, amount));
  return { featureId, allowed, entitlement: eff, lock: lockStateOf(eff, !!subject.companyId) };
}

// ---------------------------------------------------------------------------
// Customer mutation: cancellation only
// ---------------------------------------------------------------------------
export async function cancelMySubscription(caller: Caller, data: unknown) {
  const p = obj(data ?? {}, ['atPeriodEnd', 'reason']);
  const atPeriodEnd = bool(p, 'atPeriodEnd', true) ?? true;
  const why = str(p, 'reason', { optional: true, max: 500 }) || 'Customer requested cancellation';
  const subject = await resolveCommercialSubject(caller);
  if (!subject.isBillingContact) deny('Only the billing contact may cancel this subscription.');
  return db().runTransaction(async (tx) => {
    const prev = await readSub(tx, subject.customerType, subject.customerId);
    if (!prev) fail('failed-precondition', 'No subscription to cancel.');
    const current = timeAdjustedStatus(prev!, nowIso()).status;
    if (!ACCESS_GRANTING_STATUSES.includes(current)) fail('failed-precondition', `Subscription is ${current}.`);
    const next: Partial<Subscription> = atPeriodEnd
      ? { cancelAtPeriodEnd: true, cancelledAt: nowIso() }
      : { status: 'CANCELLED', cancelAtPeriodEnd: false, cancelledAt: nowIso() };
    const sub = writeSubscription(tx, prev, {
      ...subject, customerName: prev!.customerName || subject.customerId, next,
      action: 'SUBSCRIPTION_CANCELLED', actor: actorOf(caller), reason: why, source: 'Customer Billing',
    });
    return { subscriptionId: sub.subscriptionId, status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd };
  });
}

// ---------------------------------------------------------------------------
// App Owner commercial controls
// ---------------------------------------------------------------------------
export async function adminGetCustomerCommercialState(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId']);
  const { customerType, customerId } = customerArgs(p);
  const { tenantId } = await resolveCustomerTenant(customerType, customerId);
  let companyId: string | null = customerType === 'company' ? customerId : null;
  let accountSuspended = false;
  if (customerType === 'individual') {
    const e = await db().collection('employees').doc(customerId).get();
    const u = await db().collection('users').doc(customerId).get();
    companyId = (e.get('companyId') as string) || (u.get('companyId') as string) || null;
    accountSuspended = u.exists && u.get('status') !== 'active';
  } else {
    accountSuspended = (await db().collection('companies').doc(customerId).get()).get('status') !== 'active';
  }
  return commercialSnapshot({
    uid: customerId, userIds: customerType === 'individual' ? [customerId] : [], primaryUserId: customerId,
    companyId, role: 'customer', customerType, customerId, tenantId, isBillingContact: false, accountSuspended,
  }, nowMs());
}

export async function adminGrantComplimentary(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'planId', 'durationDays', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const durationDays = num(p, 'durationDays', { min: 1, max: 3650, int: true });
  const why = reason(p);
  await requirePlan(planId, customerType);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  return db().runTransaction(async (tx) => {
    const prev = await readSub(tx, customerType, customerId);
    if (prev && prev.status === 'SUSPENDED') fail('failed-precondition', 'Reinstate the customer before granting access.');
    const sub = writeSubscription(tx, prev, {
      customerType, customerId, tenantId, customerName: name,
      next: {
        planId, status: 'COMPLIMENTARY', paymentStatus: 'COMPLIMENTARY', provider: 'manual', price: 0,
        currentPeriodStart: nowIso(), currentPeriodEnd: isoInDays(durationDays), trialEndsAt: null, graceEndsAt: null,
        cancelAtPeriodEnd: false, cancelledAt: null,
      },
      action: 'COMPLIMENTARY_GRANTED', actor: actorOf(caller), reason: why, source: 'App Owner Commercial Control',
    });
    return { subscriptionId: sub.subscriptionId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd };
  });
}

export async function adminGrantTrial(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'planId', 'trialDays', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const trialDays = num(p, 'trialDays', { min: 1, max: 365, int: true });
  const why = reason(p);
  const plan = await requirePlan(planId, customerType);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  return db().runTransaction(async (tx) => {
    const prev = await readSub(tx, customerType, customerId);
    if (prev && prev.status === 'SUSPENDED') fail('failed-precondition', 'Reinstate the customer before granting a trial.');
    const end = isoInDays(trialDays);
    const sub = writeSubscription(tx, prev, {
      customerType, customerId, tenantId, customerName: name,
      next: {
        planId, status: 'TRIAL', paymentStatus: 'PENDING', provider: 'manual', price: plan.price, currency: plan.currency,
        billingInterval: plan.billingCycle, currentPeriodStart: nowIso(), currentPeriodEnd: end, trialEndsAt: end,
        graceEndsAt: null, cancelAtPeriodEnd: false, cancelledAt: null,
      },
      action: 'TRIAL_STARTED', actor: actorOf(caller), reason: why, source: 'App Owner Commercial Control',
    });
    return { subscriptionId: sub.subscriptionId, status: sub.status, trialEndsAt: sub.trialEndsAt };
  });
}

export async function adminChangeCustomerPlan(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'planId', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const why = reason(p);
  const plan = await requirePlan(planId, customerType);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  return db().runTransaction(async (tx) => {
    const prev = await readSub(tx, customerType, customerId);
    if (prev && prev.status === 'SUSPENDED') fail('failed-precondition', 'Reinstate the customer before changing the plan.');
    const isFree = plan.price === 0;
    const sub = writeSubscription(tx, prev, {
      customerType, customerId, tenantId, customerName: name,
      next: {
        planId, status: 'ACTIVE', price: plan.price, currency: plan.currency, billingInterval: plan.billingCycle,
        paymentStatus: isFree ? 'COMPLIMENTARY' : 'PENDING', provider: isFree ? 'free' : 'manual',
        currentPeriodStart: nowIso(), currentPeriodEnd: isoInDays(365), trialEndsAt: null, graceEndsAt: null,
        cancelAtPeriodEnd: false, cancelledAt: null,
      },
      action: 'PLAN_ASSIGNED', actor: actorOf(caller), reason: why, source: 'App Owner Commercial Control',
    });
    return { subscriptionId: sub.subscriptionId, planId: sub.planId, status: sub.status };
  });
}

export async function adminSetSubscriptionStatus(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'status', 'graceDays', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const status = oneOf(p, 'status', SUBSCRIPTION_STATUSES);
  const graceDays = p.graceDays === undefined ? 7 : num(p, 'graceDays', { min: 1, max: 60, int: true });
  const why = reason(p);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  return db().runTransaction(async (tx) => {
    const prev = await readSub(tx, customerType, customerId);
    if (!prev) fail('failed-precondition', 'Customer has no subscription.');
    if (!isTransitionAllowed(prev!.status, status)) fail('failed-precondition', `Transition ${prev!.status} -> ${status} is not allowed.`);
    const next: Partial<Subscription> = { status };
    if (status === 'GRACE') next.graceEndsAt = isoInDays(graceDays);
    if (status === 'CANCELLED') next.cancelledAt = nowIso();
    if (status === 'SUSPENDED') next.statusBeforeSuspension = prev!.status;
    if (status === 'ACTIVE' && prev!.price > 0 && prev!.paymentStatus !== 'PAID') next.paymentStatus = 'PENDING' as PaymentStatus;
    const sub = writeSubscription(tx, prev, {
      customerType, customerId, tenantId, customerName: name, next,
      action: status === 'GRACE' ? 'GRACE_PERIOD_ENTERED' : 'SUBSCRIPTION_STATUS_CHANGED',
      actor: actorOf(caller), reason: why, source: 'App Owner Commercial Control',
    });
    return { subscriptionId: sub.subscriptionId, status: sub.status };
  });
}

// ---------------------------------------------------------------------------
// Reconciler: persists time-based transitions (read paths already apply them).
// ---------------------------------------------------------------------------
export async function reconcileSubscriptions(actor: AuditActor = SYSTEM_ACTOR) {
  const policy = (await loadControlPlane()).globalPolicy;
  const all = await db().collection('subscriptions').get();
  const changed: Array<{ id: string; from: SubscriptionStatus; to: SubscriptionStatus }> = [];
  for (const doc of all.docs) {
    const sub = subscriptionFromDoc(doc.data());
    const target = timeAdjustedStatus(sub, nowIso(), policy);
    if (target.status === sub.status) continue;
    await db().runTransaction(async (tx) => {
      const fresh = await readSub(tx, sub.customerType, sub.customerId);
      if (!fresh) return;
      const t = timeAdjustedStatus(fresh, nowIso(), policy);
      if (t.status === fresh.status) return;
      writeSubscription(tx, fresh, {
        customerType: fresh.customerType, customerId: fresh.customerId, tenantId: fresh.tenantId || fresh.customerId,
        customerName: fresh.customerName || fresh.customerId, next: { status: t.status },
        action: t.status === 'EXPIRED' && fresh.status === 'TRIAL' ? 'TRIAL_EXPIRED'
          : t.status === 'EXPIRED' && fresh.status === 'COMPLIMENTARY' ? 'COMPLIMENTARY_EXPIRED'
          : t.status === 'PAST_DUE' ? 'PAYMENT_FAILED' : 'SUBSCRIPTION_EXPIRED',
        actor, reason: `${t.reason} (content retained, paid features locked)`, source: 'SubscriptionReconciler',
      });
      changed.push({ id: doc.id, from: fresh.status, to: t.status });
    });
  }
  return { examined: all.size, changed };
}

export async function adminReconcileNow(caller: Caller) {
  requireAppOwner(caller);
  return reconcileSubscriptions(actorOf(caller));
}
