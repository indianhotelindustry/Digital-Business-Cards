// ============================================================================
// DSBC BACKEND CLIENT (Directive 25 Phase 11)
// ============================================================================
// The ONLY way the browser changes commercial, publishing or quota state.
// Every call is an authenticated Cloud Functions callable: the backend derives
// the caller's identity, tenant and entitlements from the verified ID token and
// server records, and ignores (rejects) any authority the payload claims.
//
// Payloads never carry role, companyId-as-authority, planId-as-entitlement,
// prices or statuses — the backend's input validation rejects unknown fields.

import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** Callable names exported by functions/src/index.ts (kept in sync by tests/unit/backendContract.test.ts). */
export const BACKEND_CALLABLES = [
  // Public (no sign-in required)
  'resolvePublicEntity',
  'submitPublicLead',
  // Customer-facing
  'getMyCommercialState',
  'checkEntitlement',
  'consumeQuota',
  'cancelMySubscription',
  'setPublishingState',
  'uploadAsset',
  'setMyDeletionRequest',
  'createCheckoutOrder',
  'confirmPayment',
  // App Owner
  'bootstrapControlPlane',
  'upsertPlan',
  'setPlanPricing',
  'setPlanFeature',
  'duplicatePlan',
  'deletePlan',
  'upsertOverride',
  'deleteOverride',
  'updateGlobalPolicy',
  'adminGetCustomerCommercialState',
  'adminGrantComplimentary',
  'adminGrantTrial',
  'adminChangeCustomerPlan',
  'adminSetSubscriptionStatus',
  'adminReconcileNow',
  'adminCreateInvoice',
  'adminRecordInvoicePayment',
  'adminSetPublishingSuspension',
  'adminSetCustomerSuspension',
  'adminSetCustomerClassification',
  'adminReviewDeletion',
  'adminGetDemoReadiness',
] as const;

export type BackendCallable = (typeof BACKEND_CALLABLES)[number];

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'BackendError';
  }

  /** True when the backend refused because online payments are switched off. */
  get paymentsDisabled(): boolean {
    return this.message.includes('PAYMENTS_NOT_ENABLED');
  }
}

export async function callBackend<T = unknown>(name: BackendCallable, data: Record<string, unknown> = {}): Promise<T> {
  try {
    const res = await httpsCallable<Record<string, unknown>, T>(functions, name)(data);
    return res.data;
  } catch (err) {
    if (err instanceof FirebaseError) {
      throw new BackendError(err.code.replace(/^functions\//, ''), err.message, (err as FirebaseError & { details?: unknown }).details);
    }
    throw err;
  }
}

/** Human-readable message for UI surfaces. */
export function describeBackendError(err: unknown): string {
  if (err instanceof BackendError) {
    if (err.paymentsDisabled) return 'Online payments are not active yet. Please contact the platform owner to change your plan.';
    if (err.code === 'unauthenticated') return 'Please sign in again.';
    if (err.code === 'permission-denied') return `Not permitted: ${err.message}`;
    if (err.code === 'resource-exhausted') return `Plan limit reached: ${err.message}`;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Runs a backend request from a UI handler. A refusal is reported to the user
 * with the backend's reason; returns true only when the backend accepted it.
 */
export async function runBackendAction(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (err) {
    console.error('Backend request failed:', err);
    window.alert(describeBackendError(err));
    return false;
  }
}

/** Random id for idempotent metered operations (consumeQuota). */
export function newOperationId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
