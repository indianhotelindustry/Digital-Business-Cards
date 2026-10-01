// ============================================================================
// DSBC SUBSCRIPTION & COMMERCIAL DOMAIN SERVICE (Directive 19)
// ============================================================================

import {
  Subscription,
  SubscriptionStatus,
  PaymentStatus,
  CustomerType,
  BillingInterval,
  Invoice,
  CommercialAuditRecord,
  CommercialAction,
  CommercialMetrics,
} from '../types/subscription';
import { entitlementService } from './entitlementService';
import { paymentProvider } from './paymentProvider';

const STORAGE_KEYS = {
  SUBSCRIPTIONS: 'dsbc_subscriptions_v1',
  INVOICES: 'dsbc_invoices_v1',
  AUDIT_LOGS: 'dsbc_commercial_audit_v1',
};

// Initial Seed Subscriptions
const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  {
    subscriptionId: 'sub_acme_pro',
    customerType: 'company',
    customerId: 'company_acme',
    customerName: 'Acme Innovations Ltd',
    planId: 'company_pro',
    status: 'ACTIVE',
    currency: 'INR',
    billingInterval: 'yearly',
    price: 500,
    startedAt: '2026-01-01T00:00:00.000Z',
    currentPeriodStart: '2026-01-01T00:00:00.000Z',
    currentPeriodEnd: '2027-01-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentStatus: 'PAID',
    provider: 'razorpay',
    providerCustomerId: 'cust_rzp_acme',
    providerSubscriptionId: 'sub_rzp_acme_001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    subscriptionId: 'sub_nexus_free',
    customerType: 'company',
    customerId: 'company_nexus',
    customerName: 'Nexus Enterprise Solutions',
    planId: 'company_free',
    status: 'ACTIVE',
    currency: 'INR',
    billingInterval: 'free',
    price: 0,
    startedAt: '2026-02-01T00:00:00.000Z',
    currentPeriodStart: '2026-02-01T00:00:00.000Z',
    currentPeriodEnd: '2027-02-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentStatus: 'COMPLIMENTARY',
    provider: 'free',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  {
    subscriptionId: 'sub_rahul_pro',
    customerType: 'individual',
    customerId: 'emp_acme_rahul',
    customerName: 'Rahul Sharma',
    planId: 'individual_pro',
    status: 'ACTIVE',
    currency: 'INR',
    billingInterval: 'yearly',
    price: 100,
    startedAt: '2026-02-15T00:00:00.000Z',
    currentPeriodStart: '2026-02-15T00:00:00.000Z',
    currentPeriodEnd: '2027-02-15T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentStatus: 'PAID',
    provider: 'razorpay',
    providerCustomerId: 'cust_rzp_rahul',
    providerSubscriptionId: 'sub_rzp_rahul_001',
    createdAt: '2026-02-15T00:00:00.000Z',
    updatedAt: '2026-02-15T00:00:00.000Z',
  },
  {
    subscriptionId: 'sub_priya_free',
    customerType: 'individual',
    customerId: 'emp_acme_priya',
    customerName: 'Priya Patel',
    planId: 'individual_free',
    status: 'ACTIVE',
    currency: 'INR',
    billingInterval: 'free',
    price: 0,
    startedAt: '2026-02-20T00:00:00.000Z',
    currentPeriodStart: '2026-02-20T00:00:00.000Z',
    currentPeriodEnd: '2027-02-20T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    paymentStatus: 'COMPLIMENTARY',
    provider: 'free',
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-20T00:00:00.000Z',
  },
  {
    subscriptionId: 'sub_marcus_trial',
    customerType: 'individual',
    customerId: 'emp_nexus_marcus',
    customerName: 'Marcus Vance',
    planId: 'individual_free',
    status: 'TRIAL',
    currency: 'INR',
    billingInterval: 'free',
    price: 0,
    startedAt: '2026-03-20T00:00:00.000Z',
    currentPeriodStart: '2026-03-20T00:00:00.000Z',
    currentPeriodEnd: '2026-04-03T00:00:00.000Z',
    trialEndsAt: '2026-10-15T00:00:00.000Z', // 14-day trial
    cancelAtPeriodEnd: false,
    paymentStatus: 'COMPLIMENTARY',
    provider: 'free',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  },
];

// Initial Seed Invoices
const INITIAL_INVOICES: Invoice[] = [
  {
    invoiceId: 'INV-2026-001',
    customerId: 'company_acme',
    customerType: 'company',
    customerName: 'Acme Innovations Ltd',
    customerEmail: 'billing@acme-innovations.example',
    subscriptionId: 'sub_acme_pro',
    planId: 'company_pro',
    planName: 'Company Pro (Yearly)',
    amount: 500,
    currency: 'INR',
    billingInterval: 'yearly',
    paymentStatus: 'PAID',
    provider: 'Razorpay',
    paymentReference: 'pay_rzp_acme_inv001',
    issuedAt: '2026-01-01T00:00:00.000Z',
    paidAt: '2026-01-01T00:05:00.000Z',
    items: [
      {
        description: 'Company Pro Annual Subscription (25 Seats, Custom Domain, White Label)',
        amount: 500,
        quantity: 1,
      },
    ],
  },
  {
    invoiceId: 'INV-2026-002',
    customerId: 'emp_acme_rahul',
    customerType: 'individual',
    customerName: 'Rahul Sharma',
    customerEmail: 'rahul@acme-innovations.example',
    subscriptionId: 'sub_rahul_pro',
    planId: 'individual_pro',
    planName: 'Individual Pro (Yearly)',
    amount: 100,
    currency: 'INR',
    billingInterval: 'yearly',
    paymentStatus: 'PAID',
    provider: 'Razorpay',
    paymentReference: 'pay_rzp_rahul_inv002',
    issuedAt: '2026-02-15T00:00:00.000Z',
    paidAt: '2026-02-15T00:03:00.000Z',
    items: [
      {
        description: 'Individual Pro Annual Subscription (Custom Slug, AI Capture, Analytics)',
        amount: 100,
        quantity: 1,
      },
    ],
  },
  {
    invoiceId: 'INV-2026-003',
    customerId: 'company_nexus',
    customerType: 'company',
    customerName: 'Nexus Enterprise Solutions',
    customerEmail: 'admin@nexus.example',
    subscriptionId: 'sub_nexus_free',
    planId: 'company_free',
    planName: 'Company Free',
    amount: 0,
    currency: 'INR',
    billingInterval: 'free',
    paymentStatus: 'COMPLIMENTARY',
    provider: 'DSBC Free',
    paymentReference: 'free_comp_nexus',
    issuedAt: '2026-02-01T00:00:00.000Z',
    paidAt: '2026-02-01T00:00:00.000Z',
    items: [
      {
        description: 'Company Free Tier (3 Team Members, Public Mini-Website)',
        amount: 0,
        quantity: 1,
      },
    ],
  },
];

export class SubscriptionService {
  private subscriptions: Subscription[] = [];
  private invoices: Invoice[] = [];
  private auditLogs: CommercialAuditRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const storedSubs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      if (storedSubs) {
        this.subscriptions = JSON.parse(storedSubs);
      } else {
        this.subscriptions = [...INITIAL_SUBSCRIPTIONS];
        this.saveSubscriptions();
      }

      const storedInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
      if (storedInvoices) {
        this.invoices = JSON.parse(storedInvoices);
      } else {
        this.invoices = [...INITIAL_INVOICES];
        this.saveInvoices();
      }

      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (storedAudit) {
        this.auditLogs = JSON.parse(storedAudit);
      } else {
        this.auditLogs = [];
      }
    } catch (err) {
      console.error('Error loading subscription state:', err);
      this.subscriptions = [...INITIAL_SUBSCRIPTIONS];
      this.invoices = [...INITIAL_INVOICES];
      this.auditLogs = [];
    }
  }

  private saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(this.subscriptions));
    } catch (err) {
      console.error('Error saving subscriptions:', err);
    }
  }

  private saveInvoices() {
    try {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));
    } catch (err) {
      console.error('Error saving invoices:', err);
    }
  }

  private saveAuditLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
    } catch (err) {
      console.error('Error saving commercial audit logs:', err);
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Subscription listener error:', e);
      }
    });
  }

  // ============================================================================
  // SUBSCRIPTION RETRIEVAL
  // ============================================================================

  public getAllSubscriptions(): Subscription[] {
    return [...this.subscriptions];
  }

  public getSubscriptionById(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.find((s) => s.subscriptionId === subscriptionId);
  }

  public getSubscriptionForCustomer(
    customerType: CustomerType,
    customerId: string
  ): Subscription | undefined {
    return this.subscriptions.find(
      (s) => s.customerType === customerType && s.customerId === customerId
    );
  }

  /**
   * Safe getter: returns existing subscription or creates default Free tier subscription
   */
  public getOrCreateCustomerSubscription(
    customerType: CustomerType,
    customerId: string,
    customerName?: string
  ): Subscription {
    let sub = this.getSubscriptionForCustomer(customerType, customerId);
    if (!sub) {
      const defaultPlanId =
        customerType === 'company' ? 'company_free' : 'individual_free';
      sub = this.createSubscription(
        customerType,
        customerId,
        defaultPlanId,
        {
          customerName,
          status: 'ACTIVE',
          price: 0,
          billingInterval: 'free',
          paymentStatus: 'COMPLIMENTARY',
          provider: 'free',
        }
      );
    }
    return sub;
  }

  // ============================================================================
  // COMMERCIAL MUTATIONS & LIFECYCLE
  // ============================================================================

  public createSubscription(
    customerType: CustomerType,
    customerId: string,
    planId: string,
    options?: Partial<Subscription>,
    actor?: { id: string; role: string; name?: string }
  ): Subscription {
    const plan = entitlementService.getPlanById(planId);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(now.getFullYear() + 1);

    const subscriptionId =
      options?.subscriptionId ||
      `sub_${customerType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSub: Subscription = {
      subscriptionId,
      customerType,
      customerId,
      customerName: options?.customerName || customerId,
      planId,
      status: options?.status || (plan?.price === 0 ? 'ACTIVE' : 'TRIAL'),
      currency: options?.currency || plan?.currency || 'INR',
      billingInterval: options?.billingInterval || (plan?.billingCycle as BillingInterval) || 'yearly',
      price: options?.price ?? plan?.price ?? 0,
      startedAt: options?.startedAt || now.toISOString(),
      currentPeriodStart: options?.currentPeriodStart || now.toISOString(),
      currentPeriodEnd: options?.currentPeriodEnd || periodEnd.toISOString(),
      trialEndsAt: options?.trialEndsAt ?? (options?.status === 'TRIAL' ? periodEnd.toISOString() : null),
      graceEndsAt: options?.graceEndsAt ?? null,
      cancelledAt: null,
      cancelAtPeriodEnd: false,
      paymentStatus: options?.paymentStatus || (plan?.price === 0 ? 'COMPLIMENTARY' : 'PENDING'),
      provider: options?.provider || (plan?.price === 0 ? 'free' : 'razorpay'),
      providerCustomerId: options?.providerCustomerId,
      providerSubscriptionId: options?.providerSubscriptionId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Remove old sub if exists
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.customerType === customerType && s.customerId === customerId)
    );
    this.subscriptions.push(newSub);
    this.saveSubscriptions();

    this.recordCommercialAudit({
      actor: actor?.id || 'system',
      actorRole: actor?.role || 'system',
      customerId,
      customerType,
      subscriptionId,
      action: 'SUBSCRIPTION_CREATED',
      previousState: 'NONE',
      newState: `${newSub.planId} (${newSub.status})`,
      reason: 'New subscription initiated',
      source: 'SubscriptionService',
    });

    this.notify();
    return newSub;
  }

  /**
   * Free -> Pro Upgrade with 100% Data Preservation
   */
  public async upgradeSubscription(
    customerType: CustomerType,
    customerId: string,
    targetPlanId: string,
    actor?: { id: string; role: string; name?: string }
  ): Promise<{ success: boolean; subscription: Subscription; invoice: Invoice }> {
    const existing = this.getOrCreateCustomerSubscription(customerType, customerId);
    const plan = entitlementService.getPlanById(targetPlanId);
    if (!plan) throw new Error(`INVALID_PLAN: Plan ${targetPlanId} not found`);

    const prevPlanId = existing.planId;
    const prevStatus = existing.status;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(now.getFullYear() + 1);

    // Update subscription to Pro and ACTIVE
    existing.planId = targetPlanId;
    existing.status = 'ACTIVE';
    existing.price = plan.price;
    existing.currency = plan.currency;
    existing.billingInterval = (plan.billingCycle as BillingInterval) || 'yearly';
    existing.paymentStatus = 'PAID';
    existing.currentPeriodStart = now.toISOString();
    existing.currentPeriodEnd = periodEnd.toISOString();
    existing.trialEndsAt = null;
    existing.graceEndsAt = null;
    existing.cancelAtPeriodEnd = false;
    existing.updatedAt = now.toISOString();

    this.saveSubscriptions();

    // Create paid invoice record
    const invoiceId = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const invoice: Invoice = {
      invoiceId,
      customerId,
      customerType,
      customerName: existing.customerName || customerId,
      subscriptionId: existing.subscriptionId,
      planId: targetPlanId,
      planName: plan.name,
      amount: plan.price,
      currency: plan.currency,
      billingInterval: existing.billingInterval,
      paymentStatus: 'PAID',
      provider: 'Razorpay',
      paymentReference: `pay_rzp_upg_${Date.now()}`,
      issuedAt: now.toISOString(),
      paidAt: now.toISOString(),
      items: [
        {
          description: `${plan.name} Annual Subscription Upgrade`,
          amount: plan.price,
          quantity: 1,
        },
      ],
    };

    this.invoices.unshift(invoice);
    this.saveInvoices();

    // Log commercial audit
    this.recordCommercialAudit({
      actor: actor?.id || 'customer',
      actorRole: actor?.role || 'customer',
      customerId,
      customerType,
      subscriptionId: existing.subscriptionId,
      action: 'PLAN_CHANGED',
      previousState: `${prevPlanId} (${prevStatus})`,
      newState: `${targetPlanId} (ACTIVE, ₹${plan.price}/yr)`,
      reason: `Customer upgraded from ${prevPlanId} to ${targetPlanId}`,
      source: 'Customer Upgrade Flow',
    });

    this.notify();
    return { success: true, subscription: existing, invoice };
  }

  /**
   * Downgrade Subscription with Strict Data Preservation (FEATURE=LOCKED, DATA!=DELETED)
   */
  public downgradeSubscription(
    customerType: CustomerType,
    customerId: string,
    targetPlanId: string,
    actor?: { id: string; role: string; name?: string }
  ): Subscription {
    const existing = this.getOrCreateCustomerSubscription(customerType, customerId);
    const plan = entitlementService.getPlanById(targetPlanId);
    if (!plan) throw new Error(`INVALID_PLAN: Plan ${targetPlanId} not found`);

    const prevPlan = existing.planId;
    existing.planId = targetPlanId;
    existing.price = plan.price;
    existing.billingInterval = (plan.billingCycle as BillingInterval) || 'free';
    existing.updatedAt = new Date().toISOString();

    this.saveSubscriptions();

    this.recordCommercialAudit({
      actor: actor?.id || 'customer',
      actorRole: actor?.role || 'customer',
      customerId,
      customerType,
      subscriptionId: existing.subscriptionId,
      action: 'PLAN_CHANGED',
      previousState: prevPlan,
      newState: targetPlanId,
      reason: `Customer downgraded to ${targetPlanId}. Existing content preserved under quota locks.`,
      source: 'Customer Downgrade Flow',
    });

    this.notify();
    return existing;
  }

  /**
   * Cancel Subscription (Cancel at period end or immediate)
   */
  public cancelSubscription(
    subscriptionId: string,
    atPeriodEnd = true,
    actor?: { id: string; role: string }
  ): Subscription {
    const sub = this.getSubscriptionById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const prevStatus = sub.status;
    sub.cancelAtPeriodEnd = atPeriodEnd;
    sub.cancelledAt = new Date().toISOString();
    if (!atPeriodEnd) {
      sub.status = 'CANCELLED';
    }
    sub.updatedAt = new Date().toISOString();

    this.saveSubscriptions();

    this.recordCommercialAudit({
      actor: actor?.id || 'customer',
      actorRole: actor?.role || 'customer',
      customerId: sub.customerId,
      customerType: sub.customerType,
      subscriptionId: sub.subscriptionId,
      action: 'SUBSCRIPTION_CANCELLED',
      previousState: prevStatus,
      newState: atPeriodEnd ? `ACTIVE (Cancel at: ${sub.currentPeriodEnd})` : 'CANCELLED',
      reason: atPeriodEnd ? 'User scheduled cancellation at period end' : 'Immediate cancellation',
      source: 'SubscriptionService',
    });

    this.notify();
    return sub;
  }

  /**
   * Grant Complimentary Access (App Owner only)
   */
  public grantComplimentaryAccess(
    customerType: CustomerType,
    customerId: string,
    planId: string,
    durationDays = 365,
    reason = 'Platform Partner VIP Access',
    actor?: { id: string; role: string }
  ): Subscription {
    if (actor && actor.role !== 'app_owner') {
      throw new Error('ACCESS_DENIED: Only App Owner can grant complimentary access');
    }

    const existing = this.getOrCreateCustomerSubscription(customerType, customerId);
    const now = new Date();
    const expiry = new Date(now.getTime() + durationDays * 86400000);

    const prevPlan = existing.planId;
    existing.planId = planId;
    existing.status = 'COMPLIMENTARY';
    existing.paymentStatus = 'COMPLIMENTARY';
    existing.currentPeriodStart = now.toISOString();
    existing.currentPeriodEnd = expiry.toISOString();
    existing.price = 0;
    existing.updatedAt = now.toISOString();

    this.saveSubscriptions();

    this.recordCommercialAudit({
      actor: actor?.id || 'app_owner',
      actorRole: actor?.role || 'app_owner',
      customerId,
      customerType,
      subscriptionId: existing.subscriptionId,
      action: 'COMPLIMENTARY_GRANTED',
      previousState: prevPlan,
      newState: `${planId} (COMPLIMENTARY until ${expiry.toISOString()})`,
      reason,
      source: 'App Owner Commercial Control',
    });

    this.notify();
    return existing;
  }

  /**
   * Reconcile subscriptions deterministically:
   * - Expired trials fall back to free tier
   * - Subscriptions past currentPeriodEnd without renewal enter PAST_DUE or GRACE
   * - Past grace periods enter EXPIRED/SUSPENDED
   */
  public checkAndReconcileSubscriptions(): void {
    const now = new Date();
    let mutated = false;

    this.subscriptions.forEach((sub) => {
      // 1. Trial Expiry check
      if (sub.status === 'TRIAL' && sub.trialEndsAt && new Date(sub.trialEndsAt) < now) {
        const prev = sub.status;
        const fallbackPlan = sub.customerType === 'company' ? 'company_free' : 'individual_free';
        sub.status = 'EXPIRED';
        sub.planId = fallbackPlan;
        sub.updatedAt = now.toISOString();
        mutated = true;

        this.recordCommercialAudit({
          actor: 'system',
          actorRole: 'reconciler',
          customerId: sub.customerId,
          customerType: sub.customerType,
          subscriptionId: sub.subscriptionId,
          action: 'TRIAL_EXPIRED',
          previousState: prev,
          newState: `EXPIRED -> Reverted to ${fallbackPlan}`,
          reason: 'Trial period ended without upgrade',
          source: 'SubscriptionReconciler',
        });
      }

      // 2. Cancellation at period end check
      if (
        sub.cancelAtPeriodEnd &&
        sub.status === 'ACTIVE' &&
        new Date(sub.currentPeriodEnd) < now
      ) {
        const fallbackPlan = sub.customerType === 'company' ? 'company_free' : 'individual_free';
        sub.status = 'CANCELLED';
        sub.planId = fallbackPlan;
        sub.updatedAt = now.toISOString();
        mutated = true;

        this.recordCommercialAudit({
          actor: 'system',
          actorRole: 'reconciler',
          customerId: sub.customerId,
          customerType: sub.customerType,
          subscriptionId: sub.subscriptionId,
          action: 'SUBSCRIPTION_EXPIRED',
          previousState: 'ACTIVE (Cancel at period end)',
          newState: `CANCELLED -> Reverted to ${fallbackPlan}`,
          reason: 'Subscription period concluded after cancellation notice',
          source: 'SubscriptionReconciler',
        });
      }

      // 3. Grace period expiry check
      if (sub.status === 'GRACE' && sub.graceEndsAt && new Date(sub.graceEndsAt) < now) {
        const fallbackPlan = sub.customerType === 'company' ? 'company_free' : 'individual_free';
        sub.status = 'SUSPENDED';
        sub.planId = fallbackPlan;
        sub.updatedAt = now.toISOString();
        mutated = true;

        this.recordCommercialAudit({
          actor: 'system',
          actorRole: 'reconciler',
          customerId: sub.customerId,
          customerType: sub.customerType,
          subscriptionId: sub.subscriptionId,
          action: 'SUBSCRIPTION_EXPIRED',
          previousState: 'GRACE',
          newState: `SUSPENDED -> Reverted to ${fallbackPlan}`,
          reason: 'Payment grace period expired without successful charge',
          source: 'SubscriptionReconciler',
        });
      }
    });

    if (mutated) {
      this.saveSubscriptions();
      this.notify();
    }
  }

  // ============================================================================
  // INVOICES & BILLING LEDGER
  // ============================================================================

  public getInvoices(customerId?: string): Invoice[] {
    if (!customerId) return [...this.invoices];
    return this.invoices.filter((inv) => inv.customerId === customerId);
  }

  public getInvoiceById(invoiceId: string): Invoice | undefined {
    return this.invoices.find((inv) => inv.invoiceId === invoiceId);
  }

  public addInvoice(invoice: Invoice): void {
    this.invoices.unshift(invoice);
    this.saveInvoices();
    this.notify();
  }

  // ============================================================================
  // COMMERCIAL AUDIT LOGGING
  // ============================================================================

  public getCommercialAuditLogs(): CommercialAuditRecord[] {
    return [...this.auditLogs];
  }

  public recordCommercialAudit(
    log: Omit<CommercialAuditRecord, 'id' | 'timestamp'>
  ): CommercialAuditRecord {
    const fullLog: CommercialAuditRecord = {
      id: `comm_aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    this.auditLogs.unshift(fullLog);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAuditLogs();
    return fullLog;
  }

  // ============================================================================
  // COMMERCIAL METRICS CALCULATION
  // ============================================================================

  public getCommercialMetrics(): CommercialMetrics {
    const paidSubs = this.subscriptions.filter(
      (s) => s.status === 'ACTIVE' && s.price > 0 && s.paymentStatus === 'PAID'
    );
    const freeSubs = this.subscriptions.filter(
      (s) => s.price === 0 || s.status === 'TRIAL' || s.status === 'CANCELLED'
    );

    const companies = this.subscriptions.filter((s) => s.customerType === 'company');
    const individuals = this.subscriptions.filter((s) => s.customerType === 'individual');

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    const expiringTrials = this.subscriptions.filter(
      (s) => s.status === 'TRIAL' && s.trialEndsAt && new Date(s.trialEndsAt) <= sevenDaysFromNow
    ).length;

    // Calculate ARR & MRR
    let arr = 0;
    paidSubs.forEach((sub) => {
      if (sub.billingInterval === 'monthly') {
        arr += sub.price * 12;
      } else {
        arr += sub.price;
      }
    });

    const mrr = Math.round(arr / 12);

    // Total lifetime revenue from invoices marked PAID
    const totalRevenue = this.invoices
      .filter((inv) => inv.paymentStatus === 'PAID')
      .reduce((sum, inv) => sum + inv.amount, 0);

    return {
      totalCustomers: this.subscriptions.length,
      freeCustomers: freeSubs.length,
      paidCustomers: paidSubs.length,
      companiesCount: companies.length,
      individualsCount: individuals.length,
      activeSubscriptions: this.subscriptions.filter((s) => s.status === 'ACTIVE').length,
      trialsCount: this.subscriptions.filter((s) => s.status === 'TRIAL').length,
      expiringTrials,
      pastDueCount: this.subscriptions.filter((s) => s.status === 'PAST_DUE').length,
      graceCount: this.subscriptions.filter((s) => s.status === 'GRACE').length,
      cancelledCount: this.subscriptions.filter((s) => s.status === 'CANCELLED').length,
      mrr,
      arr,
      totalRevenue,
      currency: 'INR',
    };
  }
  public async processWebhookEvent(payload: any): Promise<{ success: boolean; handled: boolean; error?: string }> {
    if (!payload || !payload.eventId) {
      return { success: false, handled: false, error: 'MALFORMED_WEBHOOK_PAYLOAD' };
    }

    // Process event type
    if (payload.eventType === 'payment.captured' || payload.eventType === 'subscription.activated') {
      const data = payload.data || {};
      if (data.customerId && data.planId) {
        await this.upgradeSubscription(data.customerType || 'individual', data.customerId, data.planId, {
          id: 'webhook_worker',
          role: 'gateway_listener',
          name: 'Razorpay Verified Webhook',
        });
      }
    }

    return { success: true, handled: true };
  }
}

export const subscriptionService = new SubscriptionService();
