// ============================================================================
// Customer controls (Directive 25 Phase 8)
// ============================================================================
// Suspension / reinstatement, pilot & customer classification, and the
// account-deletion request lifecycle. Replaces the localStorage pilot registry
// (dsbc_pilot_registry_v1). Suspension never deletes content: it locks the
// account (status 'suspended', which firestore.rules already treat as
// inactive) and moves the subscription to SUSPENDED.

import { db } from '../shared/firebase';
import { fail, invalid } from '../shared/errors';
import { isoInDays, serverNow, ts } from '../shared/time';
import { bool, ID_PATTERN, obj, oneOf, reason, str } from '../shared/validate';
import { actorOf, requireActiveProfile, requireAppOwner, resolveCommercialSubject, resolveCustomerTenant, type Caller } from '../auth/identity';
import { appendAudit } from '../audit/ledger';
import { subscriptionFromDoc } from '../entitlements/controlPlane';
import { subscriptionRef, writeSubscription } from '../subscriptions/service';
import type { CustomerType, SubscriptionStatus } from '../../../shared/domain/subscriptionTypes';

const PILOT_STAGES = ['REGISTERED', 'ONBOARDING', 'ACTIVE_PILOT', 'PAID_ACTIVE', 'DOWNGRADED', 'GRADUATED'] as const;

function customerArgs(p: Record<string, unknown>) {
  return {
    customerType: oneOf(p, 'customerType', ['individual', 'company'] as const) as CustomerType,
    customerId: str(p, 'customerId', { pattern: ID_PATTERN }),
  };
}

function accountRef(customerType: CustomerType, customerId: string) {
  return customerType === 'company' ? db().collection('companies').doc(customerId) : db().collection('users').doc(customerId);
}

export async function adminSetCustomerSuspension(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'suspended', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const suspended = bool(p, 'suspended') as boolean;
  const why = reason(p);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  const ref = accountRef(customerType, customerId);
  return db().runTransaction(async (tx) => {
    const [acct, subSnap] = await Promise.all([tx.get(ref), tx.get(subscriptionRef(customerType, customerId))]);
    if (!acct.exists) fail('not-found', 'Only self-registered individuals (users/{uid}) and companies can be suspended.');
    const prevStatus = acct.get('status');
    if (suspended && prevStatus === 'suspended') fail('failed-precondition', 'Already suspended.');
    if (!suspended && prevStatus !== 'suspended') fail('failed-precondition', 'Not suspended.');
    tx.update(ref, { status: suspended ? 'suspended' : 'active', updatedAt: new Date().toISOString() });
    if (subSnap.exists) {
      const prev = subscriptionFromDoc(subSnap.data()!);
      const next = suspended
        ? { status: 'SUSPENDED' as SubscriptionStatus, statusBeforeSuspension: prev.status === 'SUSPENDED' ? prev.statusBeforeSuspension ?? null : prev.status }
        : { status: (prev.statusBeforeSuspension || 'ACTIVE') as SubscriptionStatus, statusBeforeSuspension: null };
      writeSubscription(tx, prev, {
        customerType, customerId, tenantId, customerName: name, next,
        action: suspended ? 'CUSTOMER_SUSPENDED' : 'CUSTOMER_REINSTATED', actor: actorOf(caller), reason: why, source: 'App Owner Customer Control',
      });
    }
    appendAudit(tx, 'platformAuditLogs', {
      action: suspended ? 'CUSTOMER_SUSPENDED' : 'CUSTOMER_REINSTATED', actor: actorOf(caller), targetType: customerType, targetId: customerId,
      targetName: name, tenantId, previousValue: { status: prevStatus }, newValue: { status: suspended ? 'suspended' : 'active' },
      reason: why, source: 'App Owner Customer Control',
    });
    return { customerId, status: suspended ? 'suspended' : 'active' };
  });
}

export async function adminSetCustomerClassification(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'isPilot', 'stage', 'notes', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const isPilot = bool(p, 'isPilot') as boolean;
  const stage = p.stage === undefined ? undefined : oneOf(p, 'stage', PILOT_STAGES);
  const notes = str(p, 'notes', { optional: true, max: 1000 });
  const why = reason(p);
  const { tenantId, name } = await resolveCustomerTenant(customerType, customerId);
  const ref = db().collection('customerClassifications').doc(`${customerType}_${customerId}`);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const d = prev.data();
    const next = {
      customerType, customerId, customerName: name, tenantId, isPilot,
      stage: stage ?? d?.stage ?? 'REGISTERED', accountStatus: d?.accountStatus ?? 'ACTIVE',
      notes: notes || d?.notes || '', designatedAt: d?.designatedAt ?? serverNow(), designatedBy: d?.designatedBy ?? caller.uid,
      updatedAt: serverNow(), updatedBy: caller.uid,
    };
    tx.set(ref, next, { merge: true });
    appendAudit(tx, 'platformAuditLogs', {
      action: 'CUSTOMER_CLASSIFIED', actor: actorOf(caller), targetType: customerType, targetId: customerId, targetName: name, tenantId,
      previousValue: d ? { isPilot: d.isPilot, stage: d.stage } : null, newValue: { isPilot, stage: next.stage }, reason: why, source: 'Pilot Control',
    });
    return { customerId, isPilot, stage: next.stage };
  });
}

/** Self-service: request or cancel deletion of the caller's own account (30-day retention review). */
export async function setMyDeletionRequest(caller: Caller, data: unknown) {
  const p = obj(data, ['requested', 'reason']);
  const requested = bool(p, 'requested') as boolean;
  const why = str(p, 'reason', { optional: true, max: 500 }) || (requested ? 'Customer requested account closure' : 'Customer withdrew deletion request');
  requireActiveProfile(caller);
  const subject = await resolveCommercialSubject(caller);
  if (!subject.isBillingContact) fail('permission-denied', 'Only the account owner may request deletion.');
  const ref = db().collection('customerClassifications').doc(`${subject.customerType}_${subject.customerId}`);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const status = prev.get('accountStatus') ?? 'ACTIVE';
    if (requested && status !== 'ACTIVE') fail('failed-precondition', `Account is ${status}.`);
    if (!requested && status !== 'DELETION_REQUESTED') fail('failed-precondition', 'No pending deletion request.');
    tx.set(ref, {
      customerType: subject.customerType, customerId: subject.customerId, tenantId: subject.tenantId,
      isPilot: prev.get('isPilot') ?? false, stage: prev.get('stage') ?? 'REGISTERED',
      accountStatus: requested ? 'DELETION_REQUESTED' : 'ACTIVE',
      deletionRequestedAt: requested ? serverNow() : null, deletionReason: requested ? why : null,
      retentionExpiresAt: requested ? ts(isoInDays(30)) : null, updatedAt: serverNow(), updatedBy: caller.uid,
    }, { merge: true });
    appendAudit(tx, 'platformAuditLogs', {
      action: requested ? 'DELETION_REQUESTED' : 'DELETION_REQUEST_WITHDRAWN', actor: actorOf(caller), targetType: subject.customerType,
      targetId: subject.customerId, tenantId: subject.tenantId, previousValue: status, newValue: requested ? 'DELETION_REQUESTED' : 'ACTIVE',
      reason: why, source: 'Customer Account',
    });
    return { accountStatus: requested ? 'DELETION_REQUESTED' : 'ACTIVE' };
  });
}

/** App Owner review. CONFIRM_PURGE only marks the record; data purge is a separate, manual, audited operation. */
export async function adminReviewDeletion(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'action', 'reason']);
  const { customerType, customerId } = customerArgs(p);
  const action = oneOf(p, 'action', ['APPROVE_RETENTION', 'CONFIRM_PURGE', 'REJECT_RESTORE'] as const);
  const why = reason(p);
  const ref = db().collection('customerClassifications').doc(`${customerType}_${customerId}`);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) fail('not-found', 'Customer record not found.');
    const status = prev.get('accountStatus');
    if (!['DELETION_REQUESTED', 'RETENTION_REVIEW'].includes(status)) invalid(`Account is ${status}.`);
    const next = action === 'APPROVE_RETENTION' ? 'RETENTION_REVIEW' : action === 'CONFIRM_PURGE' ? 'PURGE_APPROVED' : 'ACTIVE';
    tx.update(ref, { accountStatus: next, updatedAt: serverNow(), updatedBy: caller.uid });
    appendAudit(tx, 'platformAuditLogs', {
      action: `DELETION_${action}`, actor: actorOf(caller), targetType: customerType, targetId: customerId, tenantId: prev.get('tenantId'),
      previousValue: status, newValue: next, reason: why, source: 'Pilot Control',
    });
    return { accountStatus: next };
  });
}
