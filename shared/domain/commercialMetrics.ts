// ============================================================================
// DSBC COMMERCIAL METRICS (Directive 19, moved to shared/ in Directive 25)
// ============================================================================
// Pure read-only aggregation over authoritative subscriptions and invoices.
// Used by the App Owner dashboard; it never changes commercial state.

import type { CommercialMetrics, Invoice, Subscription } from './subscriptionTypes';

export function computeCommercialMetrics(subscriptions: Subscription[], invoices: Invoice[], nowMs: number): CommercialMetrics {
  const paidSubs = subscriptions.filter((s) => s.status === 'ACTIVE' && s.price > 0 && s.paymentStatus === 'PAID');
  const freeSubs = subscriptions.filter((s) => s.price === 0 || s.status === 'TRIAL' || s.status === 'CANCELLED');
  const sevenDays = nowMs + 7 * 86_400_000;

  let arr = 0;
  for (const sub of paidSubs) arr += sub.billingInterval === 'monthly' ? sub.price * 12 : sub.price;

  return {
    totalCustomers: subscriptions.length,
    freeCustomers: freeSubs.length,
    paidCustomers: paidSubs.length,
    companiesCount: subscriptions.filter((s) => s.customerType === 'company').length,
    individualsCount: subscriptions.filter((s) => s.customerType === 'individual').length,
    activeSubscriptions: subscriptions.filter((s) => s.status === 'ACTIVE').length,
    trialsCount: subscriptions.filter((s) => s.status === 'TRIAL').length,
    expiringTrials: subscriptions.filter(
      (s) => s.status === 'TRIAL' && s.trialEndsAt && Date.parse(s.trialEndsAt) <= sevenDays
    ).length,
    pastDueCount: subscriptions.filter((s) => s.status === 'PAST_DUE').length,
    graceCount: subscriptions.filter((s) => s.status === 'GRACE').length,
    cancelledCount: subscriptions.filter((s) => s.status === 'CANCELLED').length,
    mrr: Math.round(arr / 12),
    arr,
    totalRevenue: invoices.filter((i) => i.paymentStatus === 'PAID').reduce((sum, i) => sum + i.amount, 0),
    currency: 'INR',
  };
}
