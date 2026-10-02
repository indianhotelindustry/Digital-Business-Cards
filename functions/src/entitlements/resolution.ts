// ============================================================================
// Server-side entitlement resolution (Directive 25 Phase 7)
// ============================================================================
// getEffectiveEntitlement(subject, featureId) and the server equivalents of
// can() / getLimit() / getUsage() / checkLimit() / isFeatureLocked().
// The browser may ASK ("can I perform this?") through checkEntitlement; it can
// never TELL the backend what it is entitled to: the subject is derived from
// the verified token and server records only.

import type { Transaction } from 'firebase-admin/firestore';
import {
  canUse,
  fitsLimit,
  limitOf,
  lockStateOf,
  resolveEntitlement,
  usageOf,
  type ControlPlane,
} from '../../../shared/domain/entitlementResolver';
import { effectiveSubscriptionState, type EffectiveSubscriptionState } from '../../../shared/domain/subscriptionLifecycle';
import type { EffectiveEntitlement, Plan } from '../../../shared/domain/entitlementTypes';
import type { Subscription } from '../../../shared/domain/subscriptionTypes';
import { findPlan } from '../../../shared/domain/entitlementResolver';
import type { CommercialSubject } from '../auth/identity';
import {
  entitlementSubjectOf,
  loadControlPlane,
  loadOverridesFor,
  loadSubscription,
  loadUsage,
} from './controlPlane';

export interface ResolutionContext {
  cp: ControlPlane;
  subscription: Subscription | null;
  state: EffectiveSubscriptionState;
  plan: Plan | undefined;
  resolve: (featureId: string) => EffectiveEntitlement;
}

export async function buildResolutionContext(
  subject: CommercialSubject,
  nowMs: number,
  tx: Pick<Transaction, 'get' | 'getAll'> | null = null
): Promise<ResolutionContext> {
  const nowIso = new Date(nowMs).toISOString();
  const [cp, subscription, overrides] = await Promise.all([
    loadControlPlane(tx),
    loadSubscription(subject.customerType, subject.customerId, tx),
    loadOverridesFor(subject, tx),
  ]);
  const usage = await loadUsage(cp, subject, nowMs, tx);
  const state = effectiveSubscriptionState(subscription, subject.customerType, nowIso, cp.globalPolicy);
  const entSubject = entitlementSubjectOf(subject, state.planIdForAccess);
  return {
    cp,
    subscription,
    state,
    plan: findPlan(cp.plans, state.planIdForAccess),
    resolve: (featureId) => resolveEntitlement(cp, entSubject, overrides, featureId, nowIso, usage),
  };
}

/** The authoritative resolver. */
export async function getEffectiveEntitlement(subject: CommercialSubject, featureId: string, nowMs = Date.now()) {
  return (await buildResolutionContext(subject, nowMs)).resolve(featureId);
}

export const can = (eff: EffectiveEntitlement) => canUse(eff);
export const getLimit = limitOf;
export const getUsage = usageOf;
export const checkLimit = fitsLimit;
export const isFeatureLocked = lockStateOf;

/** Snapshot returned to the browser for display (never accepted back). */
export async function commercialSnapshot(subject: CommercialSubject, nowMs = Date.now()) {
  const ctx = await buildResolutionContext(subject, nowMs);
  const entitlements: Record<string, EffectiveEntitlement> = {};
  for (const id of ctx.cp.features.keys()) entitlements[id] = ctx.resolve(id);
  return {
    schema: 'dsbc.commercialSnapshot/v1',
    generatedAt: new Date(nowMs).toISOString(),
    subject: {
      customerType: subject.customerType,
      customerId: subject.customerId,
      companyId: subject.companyId,
      tenantId: subject.tenantId,
      isBillingContact: subject.isBillingContact,
      accountSuspended: subject.accountSuspended,
    },
    subscription: ctx.subscription
      ? { ...ctx.subscription, effectiveStatus: ctx.state.status }
      : null,
    subscriptionState: ctx.state,
    plan: ctx.plan ?? null,
    entitlements,
  };
}
