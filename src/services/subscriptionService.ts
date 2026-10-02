// ============================================================================
// DSBC SUBSCRIPTION CLIENT (Directive 25 Phase 9/11)
// ============================================================================
// Replaces the Directive 19 browser SubscriptionService, whose subscriptions,
// invoices and commercial audit log lived in localStorage and whose
// upgradeSubscription() turned the caller into ACTIVE/PAID on its own.
//
// Authority now lives in functions/src/subscriptions + billing:
//   * a customer can only start a checkout (paid access is granted by the
//     backend after cryptographic payment verification) or cancel;
//   * the App Owner's commercial controls are backend callables;
//   * lifecycle transitions (trial/complimentary/grace expiry) are applied by
//     the backend on every read and persisted by its scheduled reconciler.
// This module only displays and requests. It never writes a subscription.

import { callBackend, describeBackendError } from '../lib/backend';
import { commercialStore, type AuditLedgerRecord } from './commercialStore';
import { purchasePlan, type CheckoutResult } from './paymentProvider';
import { computeCommercialMetrics } from '../../shared/domain/commercialMetrics';
import type {
  CommercialAction,
  CommercialAuditRecord,
  CommercialMetrics,
  CustomerType,
  Invoice,
  Subscription,
  SubscriptionStatus,
} from '../types/subscription';

export interface PlanChangeResult {
  success: boolean;
  /** Present when the request did not change the plan (e.g. payments not enabled yet). */
  message?: string;
  checkout?: CheckoutResult;
}

function display(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function toCommercialAuditRecord(r: AuditLedgerRecord): CommercialAuditRecord {
  return {
    id: r.id,
    actor: r.actorName || r.actorUserId,
    actorRole: r.actorRole,
    customerId: r.targetId,
    customerType: (r.targetType === 'company' ? 'company' : 'individual') as CustomerType,
    action: r.action as CommercialAction,
    previousState: display(r.previousValue),
    newState: display(r.newValue),
    timestamp: r.timestamp,
    source: r.source,
    reason: r.reason,
  };
}

class SubscriptionService {
  subscribe(fn: () => void): () => void {
    return commercialStore.subscribe(fn);
  }

  private isAppOwner(): boolean {
    return !!commercialStore.session?.isAppOwner;
  }

  /** Is (customerType, customerId) the signed-in customer as resolved by the server? */
  private isOwnCustomer(customerType: CustomerType, customerId: string): boolean {
    const subj = commercialStore.snapshot?.subject;
    if (subj) return subj.customerType === customerType && subj.customerId === customerId;
    const s = commercialStore.session;
    return !!s && (customerType === 'company' ? s.companyId === customerId : s.userIds.includes(customerId));
  }

  // ==========================================================================
  // Reads
  // ==========================================================================
  getAllSubscriptions(): Subscription[] {
    return [...commercialStore.subscriptions];
  }

  getSubscriptionById(subscriptionId: string): Subscription | undefined {
    const own = this.getCurrentSubscription();
    if (own?.subscriptionId === subscriptionId) return own;
    return commercialStore.subscriptions.find((s) => s.subscriptionId === subscriptionId);
  }

  getSubscriptionForCustomer(customerType: CustomerType, customerId: string): Subscription | undefined {
    if (this.isOwnCustomer(customerType, customerId)) return this.getCurrentSubscription() ?? undefined;
    return commercialStore.subscriptions.find((s) => s.customerType === customerType && s.customerId === customerId);
  }

  /**
   * The signed-in customer's subscription as the server sees it right now
   * (status already time-adjusted). With no subscription record the customer
   * is on the free plan; a display-only placeholder describes that.
   */
  getCurrentSubscription(): Subscription | null {
    const snap = commercialStore.snapshot;
    if (!snap) return null;
    const state = snap.subscriptionState;
    if (snap.subscription) {
      const { effectiveStatus, ...sub } = snap.subscription;
      return { ...sub, status: (state.status === 'NONE' ? sub.status : state.status) as SubscriptionStatus };
    }
    const plan = snap.plan;
    return {
      subscriptionId: `${snap.subject.customerType}_${snap.subject.customerId}`,
      customerType: snap.subject.customerType,
      customerId: snap.subject.customerId,
      planId: state.planIdForAccess,
      status: 'ACTIVE',
      currency: plan?.currency || 'INR',
      billingInterval: 'free',
      price: 0,
      startedAt: '',
      currentPeriodStart: '',
      currentPeriodEnd: '',
      trialEndsAt: null,
      graceEndsAt: null,
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      paymentStatus: 'COMPLIMENTARY',
      provider: 'free',
      createdAt: '',
      updatedAt: '',
    };
  }

  /** Kept for the Directive 19 API: never creates anything. */
  getOrCreateCustomerSubscription(customerType: CustomerType, customerId: string): Subscription | null {
    return this.getSubscriptionForCustomer(customerType, customerId) ?? null;
  }

  getInvoices(customerId?: string): Invoice[] {
    if (this.isAppOwner()) {
      return customerId ? commercialStore.invoices.filter((i) => i.customerId === customerId) : [...commercialStore.invoices];
    }
    return customerId ? commercialStore.ownInvoices.filter((i) => i.customerId === customerId) : [...commercialStore.ownInvoices];
  }

  getInvoiceById(invoiceId: string): Invoice | undefined {
    return [...commercialStore.invoices, ...commercialStore.ownInvoices].find((i) => i.invoiceId === invoiceId);
  }

  getCommercialAuditLogs(): CommercialAuditRecord[] {
    return commercialStore.commercialAudit.map(toCommercialAuditRecord);
  }

  getCommercialMetrics(): CommercialMetrics {
    return computeCommercialMetrics(commercialStore.subscriptions, commercialStore.invoices, Date.now());
  }

  // ==========================================================================
  // Customer requests
  // ==========================================================================
  /**
   * Upgrade. For the signed-in customer this starts a server-priced checkout;
   * the plan changes only after the backend verifies the payment. For the App
   * Owner acting on another customer it is an audited plan assignment.
   */
  async upgradeSubscription(customerType: CustomerType, customerId: string, targetPlanId: string, prefill: { name?: string; email?: string } = {}): Promise<PlanChangeResult> {
    if (!this.isOwnCustomer(customerType, customerId)) {
      if (!this.isAppOwner()) return { success: false, message: 'You can only change your own plan.' };
      await this.adminChangePlan(customerType, customerId, targetPlanId, 'Plan changed by App Owner');
      return { success: true };
    }
    try {
      const checkout = await purchasePlan(targetPlanId, prefill);
      await commercialStore.refreshSnapshot();
      return { success: true, checkout };
    } catch (err) {
      return { success: false, message: describeBackendError(err) };
    }
  }

  /**
   * Downgrade. A customer moves to the free plan by cancelling at period end
   * (content is retained, paid features lock when the period ends). Moving to
   * a different paid tier is a purchase; the App Owner can assign any plan.
   */
  async downgradeSubscription(customerType: CustomerType, customerId: string, targetPlanId: string): Promise<PlanChangeResult> {
    if (!this.isOwnCustomer(customerType, customerId)) {
      if (!this.isAppOwner()) return { success: false, message: 'You can only change your own plan.' };
      await this.adminChangePlan(customerType, customerId, targetPlanId, 'Plan downgraded by App Owner (content retained)');
      return { success: true };
    }
    const target = commercialStore.plans.find((p) => p.id === targetPlanId);
    if (target && target.price > 0) return this.upgradeSubscription(customerType, customerId, targetPlanId);
    try {
      await callBackend('cancelMySubscription', { atPeriodEnd: true, reason: `Customer downgraded to ${targetPlanId}` });
      await commercialStore.refreshSnapshot();
      return { success: true, message: 'Your plan will move to the free tier at the end of the current period. Your content is kept.' };
    } catch (err) {
      return { success: false, message: describeBackendError(err) };
    }
  }

  /** Customer: cancels their own subscription. App Owner: sets another customer's status to CANCELLED. */
  async cancelSubscription(subscriptionId: string, atPeriodEnd = true): Promise<PlanChangeResult> {
    const own = this.getCurrentSubscription();
    try {
      if (own && own.subscriptionId === subscriptionId) {
        await callBackend('cancelMySubscription', { atPeriodEnd });
        await commercialStore.refreshSnapshot();
        return { success: true };
      }
      const sub = commercialStore.subscriptions.find((s) => s.subscriptionId === subscriptionId);
      if (!sub || !this.isAppOwner()) return { success: false, message: 'Subscription not found.' };
      await this.adminSetStatus(sub.customerType, sub.customerId, 'CANCELLED', 'Cancelled by App Owner');
      return { success: true };
    } catch (err) {
      return { success: false, message: describeBackendError(err) };
    }
  }

  // ==========================================================================
  // App Owner commercial controls (authorised by the backend)
  // ==========================================================================
  async grantComplimentaryAccess(customerType: CustomerType, customerId: string, planId: string, durationDays = 365, reason = 'Complimentary access'): Promise<void> {
    await callBackend('adminGrantComplimentary', { customerType, customerId, planId, durationDays, reason });
  }

  async grantTrial(customerType: CustomerType, customerId: string, planId: string, trialDays: number, reason: string): Promise<void> {
    await callBackend('adminGrantTrial', { customerType, customerId, planId, trialDays, reason });
  }

  async adminChangePlan(customerType: CustomerType, customerId: string, planId: string, reason: string): Promise<void> {
    await callBackend('adminChangeCustomerPlan', { customerType, customerId, planId, reason });
  }

  async adminSetStatus(customerType: CustomerType, customerId: string, status: SubscriptionStatus, reason: string, graceDays?: number): Promise<void> {
    await callBackend('adminSetSubscriptionStatus', { customerType, customerId, status, reason, ...(graceDays ? { graceDays } : {}) });
  }

  async createManualInvoice(input: {
    customerType: CustomerType;
    customerId: string;
    planId: string;
    currency: string;
    paymentStatus: 'PENDING' | 'COMPLIMENTARY';
    items: Array<{ description: string; amount: number; quantity: number }>;
    reason: string;
  }): Promise<{ invoiceId: string; amount: number }> {
    return callBackend('adminCreateInvoice', input);
  }

  async recordInvoicePayment(invoiceId: string, paymentReference: string, reason: string): Promise<void> {
    await callBackend('adminRecordInvoicePayment', { invoiceId, paymentReference, reason });
  }

  /** App Owner: persist due lifecycle transitions now (the backend also runs this daily). */
  async checkAndReconcileSubscriptions(): Promise<{ examined: number; changed: unknown[] } | null> {
    if (!this.isAppOwner()) return null;
    return callBackend('adminReconcileNow');
  }
}

export const subscriptionService = new SubscriptionService();
