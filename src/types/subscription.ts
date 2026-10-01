// ============================================================================
// DSBC SAAS COMMERCIAL DOMAIN TYPES (Directive 19)
// ============================================================================

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'COMPLIMENTARY';

export type PaymentStatus =
  | 'PAID'
  | 'PENDING'
  | 'FAILED'
  | 'REFUNDED'
  | 'COMPLIMENTARY';

export type CustomerType = 'individual' | 'company';

export type BillingInterval = 'monthly' | 'yearly' | 'free' | 'lifetime';

export interface Subscription {
  subscriptionId: string;
  customerType: CustomerType;
  customerId: string; // userId, employeeId, or companyId
  customerName?: string;
  planId: string;
  status: SubscriptionStatus;
  currency: string; // e.g. 'INR', 'USD'
  billingInterval: BillingInterval;
  price: number; // e.g. 0, 100, 500
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  cancelledAt?: string | null;
  cancelAtPeriodEnd: boolean;
  paymentStatus: PaymentStatus;
  provider: 'razorpay' | 'stripe' | 'manual' | 'free';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface Invoice {
  invoiceId: string; // e.g. INV-2026-001
  customerId: string;
  customerType: CustomerType;
  customerName: string;
  customerEmail?: string;
  subscriptionId: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  paymentStatus: PaymentStatus;
  provider: string;
  paymentReference?: string;
  issuedAt: string;
  paidAt?: string | null;
  downloadUrl?: string;
  items: InvoiceItem[];
  metadata?: Record<string, any>;
}

export type CommercialAction =
  | 'PLAN_ASSIGNED'
  | 'PLAN_CHANGED'
  | 'TRIAL_STARTED'
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'COMPLIMENTARY_GRANTED'
  | 'COMPLIMENTARY_EXPIRED'
  | 'SEAT_INCREASED'
  | 'GRACE_PERIOD_ENTERED';

export interface CommercialAuditRecord {
  id: string;
  actor: string;
  actorRole: string;
  customerId: string;
  customerType: CustomerType;
  subscriptionId?: string;
  action: CommercialAction;
  previousState: string;
  newState: string;
  timestamp: string;
  source: string;
  reason: string;
}

export interface CommercialMetrics {
  totalCustomers: number;
  freeCustomers: number;
  paidCustomers: number;
  companiesCount: number;
  individualsCount: number;
  activeSubscriptions: number;
  trialsCount: number;
  expiringTrials: number;
  pastDueCount: number;
  graceCount: number;
  cancelledCount: number;
  mrr: number;
  arr: number;
  totalRevenue: number;
  currency: string;
}

export interface PaymentCheckoutRequest {
  customerId: string;
  customerType: CustomerType;
  customerEmail: string;
  customerName: string;
  planId: string;
  amount: number;
  currency: string;
  billingInterval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentCheckoutResponse {
  checkoutUrl: string;
  orderId: string;
  provider: string;
  currency: string;
  amount: number;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: string; // 'payment.captured' | 'payment.failed' | 'subscription.cancelled' | 'subscription.charged'
  timestamp: number;
  signature: string;
  data: any;
}
