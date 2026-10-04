// ============================================================================
// Trusted identity (Directive 25 Phase 8)
// ============================================================================
// Authority is derived ONLY from:
//   * the verified Firebase ID token (uid, email_verified, custom claims), and
//   * server-side records (users/{uid}, companies/{id}, subscriptions).
// Nothing in a request payload (role, companyId, planId, status, entitlement)
// is ever used to decide what the caller may do.

import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../shared/firebase';
import { deny, fail } from '../shared/errors';
import type { AuditActor } from '../audit/ledger';
import type { CustomerType } from '../../../shared/domain/subscriptionTypes';

export interface ProfileDoc {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  companyId?: string | null;
  employeeId?: string | null;
  tenantId?: string | null;
  accountType?: string | null;
  status?: string;
}

export interface Caller {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** Verified token's firebase.sign_in_provider (e.g. google.com, password); null if absent. */
  signInProvider: string | null;
  isAppOwner: boolean;
  profile: ProfileDoc | null;
}

export const APP_OWNER_CLAIM = 'platformRole';

/** auth is supplied by the Functions framework after verifying the ID token. */
export async function loadCaller(auth: CallableRequest['auth']): Promise<Caller> {
  if (!auth || !auth.uid) fail('unauthenticated', 'Sign in required.');
  const token = auth!.token as Record<string, unknown>;
  const emailVerified = token.email_verified === true;
  const firebaseClaims = (token.firebase as { sign_in_provider?: string } | undefined) || undefined;
  const snap = await db().collection('users').doc(auth!.uid).get();
  return {
    uid: auth!.uid,
    email: (token.email as string) || null,
    emailVerified,
    signInProvider: firebaseClaims?.sign_in_provider || null,
    isAppOwner: token[APP_OWNER_CLAIM] === 'app_owner' && emailVerified,
    profile: snap.exists ? ({ id: snap.id, ...snap.data() } as ProfileDoc) : null,
  };
}

export function requireAppOwner(caller: Caller): void {
  if (!caller.isAppOwner) deny('Only the App Owner may perform this operation.');
}

export function requireActiveProfile(caller: Caller): ProfileDoc {
  if (!caller.profile) deny('No DSBC profile for this account.');
  if (caller.profile!.status !== 'active') deny('Account is not active.');
  return caller.profile!;
}

export function actorOf(caller: Caller): AuditActor {
  const role = caller.isAppOwner
    ? 'app_owner'
    : caller.profile?.accountType === 'individual'
      ? 'individual'
      : caller.profile?.role || 'unknown';
  return { uid: caller.uid, name: caller.profile?.displayName || caller.email || caller.uid, role };
}

export const SYSTEM_ACTOR: AuditActor = { uid: 'system', name: 'DSBC Backend', role: 'system' };
export const PROVIDER_ACTOR: AuditActor = { uid: 'razorpay_webhook', name: 'Razorpay (verified webhook)', role: 'payment_provider' };

// ---------------------------------------------------------------------------
// Commercial subject: who the caller is, commercially.
// ---------------------------------------------------------------------------
export interface CommercialSubject {
  uid: string;
  /** Ids an individual override may target, in priority order. */
  userIds: string[];
  /** Primary individual id (employeeId for company employees, uid otherwise). */
  primaryUserId: string;
  companyId: string | null;
  role: string;
  customerType: CustomerType;
  customerId: string;
  tenantId: string;
  /** May see invoices and manage cancellation for this customer. */
  isBillingContact: boolean;
  accountSuspended: boolean;
}

export async function resolveCommercialSubject(caller: Caller): Promise<CommercialSubject> {
  const profile = requireActiveProfile(caller);
  const companyId = profile.companyId || null;
  const userIds = [profile.employeeId, caller.uid].filter((v): v is string => !!v);
  const primaryUserId = userIds[0];

  if (companyId) {
    const company = await db().collection('companies').doc(companyId).get();
    if (!company.exists) deny('Company not found for this profile.');
    const accountSuspended = company.get('status') !== 'active';
    const isAdmin = profile.role === 'company_admin';
    if (!isAdmin) {
      // An employee may hold a personal subscription (Directive 19 behaviour).
      for (const id of userIds) {
        const personal = await db().collection('subscriptions').doc(`individual_${id}`).get();
        if (personal.exists) {
          return {
            uid: caller.uid, userIds, primaryUserId, companyId, role: profile.role || 'employee',
            customerType: 'individual', customerId: id, tenantId: companyId, isBillingContact: true, accountSuspended,
          };
        }
      }
    }
    return {
      uid: caller.uid, userIds, primaryUserId, companyId, role: profile.role || 'employee',
      customerType: 'company', customerId: companyId, tenantId: companyId, isBillingContact: isAdmin, accountSuspended,
    };
  }

  return {
    uid: caller.uid, userIds, primaryUserId, companyId: null, role: 'individual',
    customerType: 'individual', customerId: caller.uid, tenantId: profile.tenantId || `ind_${caller.uid}`,
    isBillingContact: true, accountSuspended: false,
  };
}

/**
 * Resolve an App-Owner-supplied customer reference to the tenant that owns it.
 * Fails if the customer does not exist, so overrides/subscriptions can never be
 * created for phantom targets.
 */
export async function resolveCustomerTenant(customerType: CustomerType, customerId: string): Promise<{ tenantId: string; name: string }> {
  if (customerType === 'company') {
    const c = await db().collection('companies').doc(customerId).get();
    if (!c.exists) fail('not-found', `Company ${customerId} does not exist.`);
    return { tenantId: customerId, name: (c.get('name') as string) || customerId };
  }
  // Individual: a Firebase uid (self-registered) or an employee id.
  const u = await db().collection('users').doc(customerId).get();
  if (u.exists) {
    return { tenantId: (u.get('tenantId') as string) || u.get('companyId') || `ind_${customerId}`, name: (u.get('displayName') as string) || customerId };
  }
  const e = await db().collection('employees').doc(customerId).get();
  if (e.exists) return { tenantId: e.get('companyId') as string, name: (e.get('displayName') as string) || customerId };
  return fail('not-found', `Individual ${customerId} does not exist.`);
}
