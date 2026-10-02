// Directive 25 Phase 12: cryptographic verification in the backend payment
// provider. The Razorpay HTTP transport is stubbed; no network is used.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MalformedWebhookError, RazorpayProvider, signatureMatches, type Transport } from '../../functions/src/billing/paymentProvider';

const KEY_SECRET = 'unit-key-secret';
const WEBHOOK_SECRET = 'unit-webhook-secret';
const hmac = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');

function stub(responses: Record<string, { ok: boolean; status: number; body: unknown }>): { transport: Transport; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    transport: async (url, init) => {
      calls.push(`${init.method} ${url}`);
      const r = responses[url] ?? { ok: false, status: 404, body: {} };
      return { ok: r.ok, status: r.status, json: async () => r.body };
    },
  };
}

const provider = (transport?: Transport, cfg: Partial<{ keyId: string; keySecret: string; webhookSecret: string }> = {}) =>
  new RazorpayProvider({ keyId: 'rzp_test_unit', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, ...cfg }, transport);

describe('payment signature (order_id|payment_id, key secret)', () => {
  it('accepts only the HMAC computed with the backend secret', () => {
    const p = provider();
    const good = hmac('order_1|pay_1', KEY_SECRET);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature: good })).toBe(true);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_2', signature: good })).toBe(false);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature: hmac('order_1|pay_1', 'other') })).toBe(false);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature: 'sig_rzp_1234567890abcdef' })).toBe(false);
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature: good.toUpperCase() })).toBe(false);
  });

  it('fails closed without a configured secret', () => {
    const p = provider(undefined, { keySecret: '' });
    expect(p.verifyPayment({ orderId: 'order_1', paymentId: 'pay_1', signature: hmac('order_1|pay_1', '') })).toBe(false);
  });
});

describe('webhook signature (raw body, webhook secret)', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 100, currency: 'INR', status: 'captured' } } } });

  it('verifies the exact raw bytes', () => {
    const p = provider();
    expect(p.verifyWebhookSignature(Buffer.from(body), hmac(body, WEBHOOK_SECRET))).toBe(true);
    expect(p.verifyWebhookSignature(Buffer.from(body + ' '), hmac(body, WEBHOOK_SECRET))).toBe(false);
    expect(p.verifyWebhookSignature(Buffer.from(body), hmac(body, KEY_SECRET))).toBe(false);
    expect(p.verifyWebhookSignature(Buffer.from(body), undefined)).toBe(false);
    expect(provider(undefined, { webhookSecret: '' }).verifyWebhookSignature(Buffer.from(body), hmac(body, ''))).toBe(false);
  });

  it('signatureMatches rejects anything that is not 64 lowercase hex characters', () => {
    const h = hmac('x', 'y');
    expect(signatureMatches(h, h)).toBe(true);
    for (const bad of ['', 'abc', h.slice(0, 63), `${h}0`, 'z'.repeat(64), null, undefined]) expect(signatureMatches(bad as string, h)).toBe(false);
  });

  it('parses payment events and rejects malformed ones', () => {
    const p = provider();
    expect(p.parseWebhookEvent(body)).toMatchObject({ event: 'payment.captured', orderId: 'order_1', payment: { paymentId: 'pay_1', amountMinor: 100 } });
    for (const bad of ['nope', '[]', '{}', JSON.stringify({ event: 'x' }), JSON.stringify({ event: 'x', payload: { payment: { entity: { id: 'p', amount: 1.5, currency: 'INR' } } } })]) {
      expect(() => p.parseWebhookEvent(bad)).toThrow(MalformedWebhookError);
    }
  });
});

describe('Razorpay REST calls (stubbed transport)', () => {
  it('createOrder posts the server amount with basic auth and returns the provider order', async () => {
    const s = stub({ 'https://api.razorpay.com/v1/orders': { ok: true, status: 200, body: { id: 'order_X', amount: 60000, currency: 'INR', status: 'created' } } });
    const order = await provider(s.transport).createOrder({ amountMinor: 60000, currency: 'INR', receipt: 'r1', notes: {} });
    expect(order).toEqual({ providerOrderId: 'order_X', amountMinor: 60000, currency: 'INR', status: 'created' });
    expect(s.calls).toEqual(['POST https://api.razorpay.com/v1/orders']);
  });

  it('createOrder refuses non-positive / fractional amounts and missing credentials', async () => {
    const s = stub({});
    await expect(provider(s.transport).createOrder({ amountMinor: 0, currency: 'INR', receipt: 'r', notes: {} })).rejects.toThrow('INVALID_AMOUNT');
    await expect(provider(s.transport).createOrder({ amountMinor: 10.5, currency: 'INR', receipt: 'r', notes: {} })).rejects.toThrow('INVALID_AMOUNT');
    await expect(provider(s.transport, { keySecret: '' }).createOrder({ amountMinor: 100, currency: 'INR', receipt: 'r', notes: {} })).rejects.toThrow('RAZORPAY_NOT_CONFIGURED');
    expect(s.calls).toEqual([]);
  });

  it('reconcilePayment reads the captured payment from the provider', async () => {
    const s = stub({ 'https://api.razorpay.com/v1/payments/pay_1': { ok: true, status: 200, body: { id: 'pay_1', order_id: 'order_1', amount: 60000, currency: 'INR', status: 'captured' } } });
    expect(await provider(s.transport).reconcilePayment('pay_1')).toEqual({ paymentId: 'pay_1', orderId: 'order_1', amountMinor: 60000, currency: 'INR', status: 'captured' });
    await expect(provider(s.transport).reconcilePayment('pay_missing')).rejects.toThrow('RAZORPAY_PAYMENT_LOOKUP_FAILED');
  });
});
