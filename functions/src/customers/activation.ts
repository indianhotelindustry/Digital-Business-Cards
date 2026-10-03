// ============================================================================
// Customer activation gate (Directive 30)
// ============================================================================
// Self-registered accounts start `pending_approval`. Only a verified App Owner
// may activate one, and only when the account's own email is verified.
// Activation flips status ONLY: it creates no subscription, no entitlement
// and no content. Every activation is an immutable ACCOUNT_ACTIVATED audit.

import { getAuth } from 'firebase-admin/auth';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { deny, fail } from '../shared/errors';
import { serverNow } from '../shared/time';
import { ID_PATTERN, obj, oneOf, reason, str } from '../shared/validate';
import { actorOf, requireAppOwner, type Caller } from '../auth/identity';
import { appendAudit, type AuditActor } from '../audit/ledger';
import { ACTIVE_ACCOUNT_STATUS, INITIAL_ACCOUNT_STATUS } from '../../../shared/domain/accountStatus';

interface Target {
  uid: string;
  userRef: DocumentReference;
  tenantRef: DocumentReference;
  companyRef?: DocumentReference;
  tenantId: string;
}

async function resolveTarget(customerType: 'individual' | 'company', customerId: string): Promise<Target> {
  if (customerType === 'company') {
    const companyRef = db().collection('companies').doc(customerId);
    const company = await companyRef.get();
    if (!company.exists) fail('not-found', `Company ${customerId} does not exist.`);
    const ownerUid = (company.get('ownerUid') as string) || customerId.replace(/^co_/, '');
    return {
      uid: ownerUid,
      userRef: db().collection('users').doc(ownerUid),
      tenantRef: db().collection('tenants').doc(customerId),
      companyRef,
      tenantId: customerId,
    };
  }
  const userRef = db().collection('users').doc(customerId);
  const user = await userRef.get();
  if (!user.exists) fail('not-found', `Individual ${customerId} does not exist.`);
  const tenantId = (user.get('tenantId') as string) || `ind_${customerId}`;
  return { uid: customerId, userRef, tenantRef: db().collection('tenants').doc(tenantId), tenantId };
}

/**
 * Flip the account to active (users/{uid}, plus tenants/companies where they
 * exist) and append the audit record. Status only: nothing commercial.
 * `tenantExists` / `companyExists` come from reads made before any write.
 */
export function activateAccount(
  tx: Transaction,
  t: Target & { tenantExists: boolean; companyExists: boolean },
  actor: AuditActor,
  why: string,
  prevStatus: string,
): void {
  tx.update(t.userRef, { status: ACTIVE_ACCOUNT_STATUS, updatedAt: serverNow() });
  if (t.tenantExists) tx.update(t.tenantRef, { status: ACTIVE_ACCOUNT_STATUS });
  if (t.companyRef && t.companyExists) tx.update(t.companyRef, { status: ACTIVE_ACCOUNT_STATUS, updatedAt: serverNow() });
  appendAudit(tx, 'commercialAuditLogs', {
    action: 'ACCOUNT_ACTIVATED',
    actor,
    targetType: t.companyRef ? 'company' : 'individual',
    targetId: t.companyRef ? t.tenantId : t.uid,
    tenantId: t.tenantId,
    previousValue: { status: prevStatus },
    newValue: { status: ACTIVE_ACCOUNT_STATUS },
    reason: why,
    source: 'App Owner Activation',
  });
}

export async function approveCustomer(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['customerType', 'customerId', 'reason']);
  const customerType = oneOf(p, 'customerType', ['individual', 'company'] as const);
  const customerId = str(p, 'customerId', { pattern: ID_PATTERN });
  const why = reason(p);
  const t = await resolveTarget(customerType, customerId);

  // Email-verified precondition: read the owning Auth account directly (the
  // caller's token says nothing about the customer's own verification).
  let authUser;
  try {
    authUser = await getAuth().getUser(t.uid);
  } catch {
    return fail('failed-precondition', 'AUTH_ACCOUNT_NOT_FOUND');
  }
  if (authUser.disabled) fail('failed-precondition', 'ACCOUNT_DISABLED');
  if (authUser.emailVerified !== true) fail('failed-precondition', 'EMAIL_NOT_VERIFIED');

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(t.userRef);
    if (!snap.exists) fail('not-found', 'Account not found.');
    const status = snap.get('status') as string;
    if (status === ACTIVE_ACCOUNT_STATUS) {
      return { customerType, customerId, status: ACTIVE_ACCOUNT_STATUS, alreadyActive: true };
    }
    if (status !== INITIAL_ACCOUNT_STATUS) {
      fail('failed-precondition', `Account is ${status}; approval only activates pending accounts.`);
    }
    const tenantExists = (await tx.get(t.tenantRef)).exists;
    const companyExists = t.companyRef ? (await tx.get(t.companyRef)).exists : false;
    activateAccount(tx, { ...t, tenantExists, companyExists }, actorOf(caller), why, status);
    return { customerType, customerId, status: ACTIVE_ACCOUNT_STATUS, alreadyActive: false };
  });
}

function isoOf(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate(): Date }).toDate().toISOString();
  return null;
}

export async function adminListPendingCustomers(caller: Caller, _data: unknown) {
  requireAppOwner(caller);
  const snap = await db().collection('users').where('status', '==', INITIAL_ACCOUNT_STATUS).limit(200).get();
  const pending = await Promise.all(
    snap.docs.map(async (d) => {
      let emailVerified = false;
      try {
        emailVerified = (await getAuth().getUser(d.id)).emailVerified === true;
      } catch {
        emailVerified = false;
      }
      let companyName: string | null = null;
      const companyId = d.get('companyId') as string | null | undefined;
      if (companyId) {
        const c = await db().collection('companies').doc(companyId).get();
        companyName = (c.get('name') as string) || null;
      }
      return {
        uid: d.id,
        displayName: (d.get('displayName') as string) || '',
        email: (d.get('email') as string) || '',
        accountType: (d.get('accountType') as string) || 'individual',
        companyName,
        createdAt: isoOf(d.get('createdAt')),
        emailVerified,
        status: d.get('status') as string,
      };
    }),
  );
  return { pending };
}

/** Auth required; deliberately NOT gated on active status. Leaks nothing else. */
export async function getMyAccountState(caller: Caller) {
  if (!caller.uid) deny('Sign in required.');
  const status = caller.profile?.status ?? INITIAL_ACCOUNT_STATUS;
  return { status, emailVerified: caller.emailVerified };
}
