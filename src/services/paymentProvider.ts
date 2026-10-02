// ============================================================================
// DSBC CHECKOUT CLIENT (Directive 25 Phase 12)
// ============================================================================
// Replaces the Directive 19 browser "Razorpay adapter", which accepted any
// signature of 16+ characters and shipped its webhook secret in the bundle.
//
// The browser now only:
//   1. asks the backend for an order (the backend prices it from plans/{id});
//   2. opens Razorpay Checkout with the backend's order id and PUBLIC key id;
//   3. forwards Razorpay's callback fields to confirmPayment.
// The backend verifies the HMAC with its secret, re-reads the captured payment
// from Razorpay, checks the amount against the server-priced order, and only
// then activates the subscription. Webhooks go straight to the backend.
// The browser never verifies a signature and holds no secret.

import { callBackend } from '../lib/backend';

export interface CheckoutOrder {
  orderId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
}

export interface CheckoutResult {
  outcome: 'ACTIVATED' | 'ALREADY_APPLIED';
  orderId?: string;
  invoiceId?: string;
}

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (e: unknown) => void): void };
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout.'));
    document.head.appendChild(s);
  });
}

function openCheckout(order: CheckoutOrder, prefill: { name?: string; email?: string }): Promise<RazorpayHandlerResponse> {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.providerOrderId,
      amount: order.amountMinor,
      currency: order.currency,
      name: 'DSBC',
      prefill,
      handler: (response: RazorpayHandlerResponse) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Checkout was closed before payment completed.')) },
    });
    rzp.on('payment.failed', () => reject(new Error('Payment failed. No charge was applied to your plan.')));
    rzp.open();
  });
}

/**
 * Purchase a plan. Rejects with BackendError (PAYMENTS_NOT_ENABLED) while
 * online payments are switched off on the backend — no state changes then.
 */
export async function purchasePlan(planId: string, prefill: { name?: string; email?: string } = {}): Promise<CheckoutResult> {
  const order = await callBackend<CheckoutOrder>('createCheckoutOrder', { planId });
  await loadCheckoutScript();
  const response = await openCheckout(order, prefill);
  return callBackend<CheckoutResult>('confirmPayment', {
    orderId: order.orderId,
    razorpayOrderId: response.razorpay_order_id,
    razorpayPaymentId: response.razorpay_payment_id,
    razorpaySignature: response.razorpay_signature,
  });
}
