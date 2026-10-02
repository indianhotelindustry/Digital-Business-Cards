// ============================================================================
// PaymentProvider abstraction + Razorpay adapter (Directive 25 Phase 12)
// ============================================================================
// Backend only. Replaces src/services/paymentProvider.ts, whose "signature
// checks" accepted any string of 32+ characters and whose webhook secret was
// a constant in browser source.
//
// A signature is valid ONLY if it equals HMAC-SHA256 computed with the
// backend-held secret, compared in constant time:
//   payment  : HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
//   webhook  : HMAC_SHA256(raw request body,             RAZORPAY_WEBHOOK_SECRET)
// A missing secret makes every verification fail (fail closed).
//
// NOT PRODUCTION-CERTIFIED: no request has been made to the real Razorpay API.
// createOrder/reconcilePayment are implemented against Razorpay's documented
// REST API and unit-tested with a stubbed transport only.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CreateOrderInput {
  amountMinor: number; // paise
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}

export interface ProviderOrder {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface ProviderPayment {
  paymentId: string;
  orderId: string | null;
  amountMinor: number;
  currency: string;
  status: string; // created | authorized | captured | refunded | failed
}

export interface NormalisedWebhookEvent {
  event: string;
  payment: ProviderPayment | null;
  orderId: string | null;
  createdAt: number | null;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined | null): boolean;
  /** Parse an ALREADY VERIFIED webhook body. Throws on malformed input. */
  parseWebhookEvent(rawBody: Buffer | string): NormalisedWebhookEvent;
  reconcilePayment(paymentId: string): Promise<ProviderPayment>;
}

export type Transport = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const HEX64 = /^[a-f0-9]{64}$/;

export function hmacSha256Hex(payload: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time comparison of a presented hex signature with the expected one. */
export function signatureMatches(presented: string | undefined | null, expectedHex: string): boolean {
  if (typeof presented !== 'string' || !HEX64.test(presented) || !HEX64.test(expectedHex)) return false;
  return timingSafeEqual(Buffer.from(presented, 'hex'), Buffer.from(expectedHex, 'hex'));
}

export class MalformedWebhookError extends Error {}

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  constructor(
    private readonly cfg: { keyId: string; keySecret: string; webhookSecret: string },
    private readonly transport: Transport = (url, init) => fetch(url, init) as ReturnType<Transport>
  ) {}

  private authHeader(): string {
    if (!this.cfg.keyId || !this.cfg.keySecret) throw new Error('RAZORPAY_NOT_CONFIGURED');
    return `Basic ${Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString('base64')}`;
  }

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('INVALID_AMOUNT');
    const res = await this.transport('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: input.amountMinor, currency: input.currency, receipt: input.receipt, notes: input.notes }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof body.id !== 'string') throw new Error(`RAZORPAY_ORDER_FAILED (${res.status})`);
    return { providerOrderId: body.id, amountMinor: Number(body.amount), currency: String(body.currency), status: String(body.status) };
  }

  verifyPayment(input: { orderId: string; paymentId: string; signature: string }): boolean {
    if (!this.cfg.keySecret || !input.orderId || !input.paymentId) return false;
    return signatureMatches(input.signature, hmacSha256Hex(`${input.orderId}|${input.paymentId}`, this.cfg.keySecret));
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined | null): boolean {
    if (!this.cfg.webhookSecret || rawBody === undefined || rawBody === null) return false;
    return signatureMatches(signature, hmacSha256Hex(rawBody, this.cfg.webhookSecret));
  }

  parseWebhookEvent(rawBody: Buffer | string): NormalisedWebhookEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    } catch {
      throw new MalformedWebhookError('Body is not JSON');
    }
    if (!parsed || typeof parsed !== 'object') throw new MalformedWebhookError('Body is not an object');
    const body = parsed as Record<string, any>;
    if (typeof body.event !== 'string' || !body.event) throw new MalformedWebhookError('Missing event');
    if (!body.payload || typeof body.payload !== 'object') throw new MalformedWebhookError('Missing payload');
    const p = body.payload.payment?.entity;
    let payment: ProviderPayment | null = null;
    if (p !== undefined) {
      if (!p || typeof p.id !== 'string' || !Number.isInteger(p.amount) || typeof p.currency !== 'string') {
        throw new MalformedWebhookError('Malformed payment entity');
      }
      payment = { paymentId: p.id, orderId: typeof p.order_id === 'string' ? p.order_id : null, amountMinor: p.amount, currency: p.currency, status: String(p.status) };
    }
    const orderEntity = body.payload.order?.entity;
    const orderId = payment?.orderId ?? (typeof orderEntity?.id === 'string' ? orderEntity.id : null);
    return { event: body.event, payment, orderId, createdAt: Number.isFinite(body.created_at) ? body.created_at : null };
  }

  async reconcilePayment(paymentId: string): Promise<ProviderPayment> {
    const res = await this.transport(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: { Authorization: this.authHeader() },
    });
    const p = (await res.json()) as Record<string, unknown>;
    if (!res.ok || typeof p.id !== 'string') throw new Error(`RAZORPAY_PAYMENT_LOOKUP_FAILED (${res.status})`);
    return {
      paymentId: p.id,
      orderId: typeof p.order_id === 'string' ? p.order_id : null,
      amountMinor: Number(p.amount),
      currency: String(p.currency),
      status: String(p.status),
    };
  }
}
