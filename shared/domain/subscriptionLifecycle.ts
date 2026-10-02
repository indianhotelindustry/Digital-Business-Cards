// ============================================================================
// DSBC SUBSCRIPTION LIFECYCLE (Directive 19 semantics, Directive 25 authority)
// ============================================================================
// Pure functions. The backend evaluates them on every read, so an expired
// trial / complimentary grant / grace period locks paid features immediately,
// even before the scheduled reconciler has persisted the transition.
//
//   DATA != DELETED, FEATURE = LOCKED
// A subscription that no longer grants access falls back to the customer
// type's free plan. Nothing here deletes or edits customer content.

import type { GlobalPlatformPolicy } from './entitlementTypes';
import type { CustomerType, Subscription, SubscriptionStatus } from './subscriptionTypes';
import { defaultPlanIdFor } from './catalogue';

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'COMPLIMENTARY',
];

export const ACCESS_GRANTING_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'COMPLIMENTARY'];

/** Allowed lifecycle transitions (App Owner / system). Same-state writes are not transitions. */
export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'COMPLIMENTARY', 'SUSPENDED'],
  ACTIVE: ['PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED', 'COMPLIMENTARY'],
  PAST_DUE: ['ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'],
  GRACE: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
  CANCELLED: ['ACTIVE', 'TRIAL', 'COMPLIMENTARY', 'SUSPENDED'],
  EXPIRED: ['ACTIVE', 'TRIAL', 'COMPLIMENTARY', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'COMPLIMENTARY', 'TRIAL', 'PAST_DUE', 'GRACE'],
  COMPLIMENTARY: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'TRIAL'],
};

export function isTransitionAllowed(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface EffectiveSubscriptionState {
  /** Status after applying time-based expiry at `now`. */
  status: SubscriptionStatus | 'NONE';
  /** Stored status (may lag until the reconciler persists the transition). */
  storedStatus: SubscriptionStatus | 'NONE';
  grantsPlanAccess: boolean;
  /** Plan whose policy applies right now. */
  planIdForAccess: string;
  reason: string;
}

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

/** Status the subscription has at `nowIso` once time-based transitions are applied. */
export function timeAdjustedStatus(
  sub: Subscription,
  nowIso: string,
  policy?: Partial<GlobalPlatformPolicy> | null
): { status: SubscriptionStatus; reason: string } {
  const graceDays = policy?.paymentGraceDays ?? 7;
  switch (sub.status) {
    case 'TRIAL':
      if (sub.trialEndsAt && sub.trialEndsAt <= nowIso) return { status: 'EXPIRED', reason: 'Trial period ended' };
      return { status: 'TRIAL', reason: 'Trial in progress' };
    case 'COMPLIMENTARY':
      if (sub.currentPeriodEnd && sub.currentPeriodEnd <= nowIso) return { status: 'EXPIRED', reason: 'Complimentary access ended' };
      return { status: 'COMPLIMENTARY', reason: 'Complimentary access' };
    case 'ACTIVE':
      if (sub.currentPeriodEnd && sub.currentPeriodEnd <= nowIso) {
        if (sub.cancelAtPeriodEnd) return { status: 'CANCELLED', reason: 'Cancelled at period end' };
        if (sub.price > 0) {
          if (addDays(sub.currentPeriodEnd, graceDays) <= nowIso) return { status: 'EXPIRED', reason: 'Renewal not paid' };
          return { status: 'PAST_DUE', reason: 'Renewal payment due' };
        }
      }
      return { status: 'ACTIVE', reason: 'Active' };
    case 'PAST_DUE':
      if (sub.currentPeriodEnd && addDays(sub.currentPeriodEnd, graceDays) <= nowIso) {
        return { status: 'EXPIRED', reason: 'Payment not received within grace window' };
      }
      return { status: 'PAST_DUE', reason: 'Payment past due' };
    case 'GRACE':
      if (sub.graceEndsAt && sub.graceEndsAt <= nowIso) return { status: 'SUSPENDED', reason: 'Grace period expired' };
      return { status: 'GRACE', reason: 'Payment grace period' };
    default:
      return { status: sub.status, reason: sub.status };
  }
}

export function effectiveSubscriptionState(
  sub: Subscription | null | undefined,
  customerType: CustomerType,
  nowIso: string,
  policy?: Partial<GlobalPlatformPolicy> | null
): EffectiveSubscriptionState {
  const fallback = defaultPlanIdFor(customerType, policy);
  if (!sub) {
    return { status: 'NONE', storedStatus: 'NONE', grantsPlanAccess: false, planIdForAccess: fallback, reason: 'No subscription: free plan' };
  }
  const { status, reason } = timeAdjustedStatus(sub, nowIso, policy);
  const grants = ACCESS_GRANTING_STATUSES.includes(status);
  return {
    status,
    storedStatus: sub.status,
    grantsPlanAccess: grants,
    planIdForAccess: grants ? sub.planId : fallback,
    reason: grants ? reason : `${reason}: paid features locked, content retained`,
  };
}

export function subscriptionDocId(customerType: CustomerType, customerId: string): string {
  return `${customerType}_${customerId}`;
}
