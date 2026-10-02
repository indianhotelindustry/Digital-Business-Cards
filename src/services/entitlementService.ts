// ============================================================================
// DSBC ENTITLEMENT CLIENT (Directive 25 Phase 11)
// ============================================================================
// Replaces the Directive 18 browser engine, whose plans, overrides, policy,
// usage and audit log lived in localStorage and were therefore editable by
// anyone with DevTools. This module is now a DISPLAY FACADE:
//
//   * the signed-in customer's effective entitlements come from the backend
//     (getMyCommercialState), resolved server-side from Firestore;
//   * App Owner screens that preview OTHER customers resolve with the same
//     shared resolver over Firestore data the App Owner may read (display
//     only — every mutation is re-authorised by the backend);
//   * without a server answer every gated feature is shown LOCKED (fail closed);
//   * every mutation is a Cloud Functions callable; the backend checks the
//     verified App Owner claim, validates, writes and appends the audit record.
//
// Nothing here reads or writes localStorage. The catalogue constants are
// re-exported from shared/domain for display.

import { callBackend, newOperationId } from '../lib/backend';
import { commercialStore, type AuditLedgerRecord } from './commercialStore';
import {
  FEATURE_CATALOGUE,
  FEATURE_DEPENDENCIES,
  FEATURE_MAP,
  INITIAL_GLOBAL_POLICY,
  INITIAL_PLANS,
} from '../../shared/domain/catalogue';
import {
  canUse,
  fitsLimit,
  limitOf,
  lockedEntitlement,
  lockStateOf,
  resolveEntitlement,
  usageOf,
} from '../../shared/domain/entitlementResolver';
import { effectiveSubscriptionState } from '../../shared/domain/subscriptionLifecycle';
import { periodKeyForUnit, usageUnitOf } from '../../shared/domain/usageKeys';
import type {
  EffectiveEntitlement,
  EntitlementAuditLog,
  EntitlementOverride,
  EntitlementRule,
  FeatureDefinition,
  GlobalPlatformPolicy,
  LimitUnit,
  Plan,
} from '../types/entitlement';
import type { UserRole } from '../types';

export { FEATURE_CATALOGUE, FEATURE_DEPENDENCIES, FEATURE_MAP, INITIAL_GLOBAL_POLICY, INITIAL_PLANS };

export interface EntitlementSubjectRef {
  userId?: string | null;
  companyId?: string | null;
  /** Ignored for authority: App Owner status comes from the verified session. */
  role?: UserRole | string | null;
  /** Ignored for the signed-in customer (the server decides the plan). */
  planId?: string | null;
}

type ActorInfo = { id: string; name: string; role?: string };

const POLICY_FIELDS = [
  'maintenanceMode', 'allowSelfRegistration', 'defaultIndividualPlanId', 'defaultCompanyPlanId',
  'defaultTrialDays', 'enforceLimitsStrictly', 'currency', 'currencySymbol', 'platformName',
  'globalFeatureOverrides', 'paymentGraceDays',
] as const;

function display(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function toEntitlementAuditLog(r: AuditLedgerRecord): EntitlementAuditLog {
  return {
    id: r.id,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    targetType: (['company', 'individual', 'plan', 'global'].includes(r.targetType) ? r.targetType : 'global') as EntitlementAuditLog['targetType'],
    targetId: r.targetId,
    targetName: r.targetName,
    featureId: r.featureId ?? undefined,
    featureName: r.featureId ? FEATURE_MAP.get(r.featureId)?.name || r.featureId : undefined,
    previousValue: display(r.previousValue),
    newValue: display(r.newValue),
    reason: `${r.action ? `[${r.action}] ` : ''}${r.reason}`,
    timestamp: r.timestamp,
    source: r.source,
  };
}

class EntitlementService {
  subscribe(listener: () => void): () => void {
    return commercialStore.subscribe(listener);
  }

  // ==========================================================================
  // Effective entitlements (display)
  // ==========================================================================
  private isAppOwnerSession(): boolean {
    return !!commercialStore.session?.isAppOwner;
  }

  /** Does this subject denote the signed-in customer (whose snapshot the server resolved)? */
  private isOwnSubject(subject: EntitlementSubjectRef): boolean {
    const s = commercialStore.session;
    if (!s) return false;
    if (subject.userId) return s.userIds.includes(subject.userId);
    if (subject.companyId) return subject.companyId === s.companyId;
    return true;
  }

  private featureDef(featureId: string): Pick<FeatureDefinition, 'id' | 'name' | 'limitUnit'> {
    return commercialStore.features.find((f) => f.id === featureId) || FEATURE_MAP.get(featureId) || { id: featureId, name: featureId };
  }

  /** App Owner preview of another customer: shared resolver over Firestore data. */
  private resolveForAppOwnerDisplay(subject: EntitlementSubjectRef, featureId: string): EffectiveEntitlement {
    const cp = commercialStore.controlPlane();
    const nowIso = new Date().toISOString();
    const customerType = subject.userId ? 'individual' : 'company';
    const customerId = subject.userId || subject.companyId || '';
    let sub = commercialStore.subscriptions.find((s) => s.customerType === customerType && s.customerId === customerId);
    if (!sub && subject.userId && subject.companyId) {
      sub = commercialStore.subscriptions.find((s) => s.customerType === 'company' && s.customerId === subject.companyId);
    }
    const state = effectiveSubscriptionState(sub ?? null, sub?.customerType ?? customerType, nowIso, cp.globalPolicy);
    const planId = sub ? state.planIdForAccess : subject.planId || state.planIdForAccess;
    const usage = (fid: string) => {
      const def = cp.features.get(fid);
      const target = def?.category !== 'individual' && subject.companyId
        ? { type: 'company', id: subject.companyId }
        : { type: 'individual', id: subject.userId || '' };
      const period = periodKeyForUnit(usageUnitOf(def), Date.now());
      return commercialStore.usageCounters.find((c) => c.targetType === target.type && c.targetId === target.id && c.featureId === fid && c.periodKey === period)?.currentValue ?? 0;
    };
    return resolveEntitlement(
      cp,
      { userIds: subject.userId ? [subject.userId] : [], companyId: subject.companyId ?? null, planId },
      commercialStore.overrides,
      featureId,
      nowIso,
      usage
    );
  }

  getEffectiveEntitlement(subject: EntitlementSubjectRef, featureId: string): EffectiveEntitlement {
    if (this.isOwnSubject(subject)) {
      const snap = commercialStore.snapshot;
      if (snap) return snap.entitlements[featureId] ?? lockedEntitlement(this.featureDef(featureId), 'Unknown feature');
      if (!this.isAppOwnerSession()) {
        return lockedEntitlement(
          this.featureDef(featureId),
          commercialStore.snapshotError ? 'Entitlements unavailable (server unreachable)' : 'Checking your plan…'
        );
      }
    }
    if (this.isAppOwnerSession()) return this.resolveForAppOwnerDisplay(subject, featureId);
    return lockedEntitlement(this.featureDef(featureId), 'Sign in to see your plan');
  }

  getEntitlement(subject: EntitlementSubjectRef, featureId: string): EffectiveEntitlement {
    return this.getEffectiveEntitlement(subject, featureId);
  }

  can(subject: EntitlementSubjectRef, featureId: string): boolean {
    if (this.isAppOwnerSession() && this.isOwnSubject(subject)) return true;
    return canUse(this.getEffectiveEntitlement(subject, featureId));
  }

  getLimit(subject: EntitlementSubjectRef, featureId: string): { limit: number; unit?: LimitUnit; isUnlimited: boolean } {
    return limitOf(this.getEffectiveEntitlement(subject, featureId));
  }

  getUsage(subject: EntitlementSubjectRef, featureId: string): { current: number; limit?: number; unit?: LimitUnit; remaining?: number } {
    return usageOf(this.getEffectiveEntitlement(subject, featureId));
  }

  /** UX pre-check only; the backend re-checks (atomically) when the operation runs. */
  checkLimit(subject: EntitlementSubjectRef, featureId: string, requestedAmount = 1): boolean {
    if (this.isAppOwnerSession() && this.isOwnSubject(subject)) return true;
    return fitsLimit(this.getEffectiveEntitlement(subject, featureId), requestedAmount);
  }

  isFeatureLocked(subject: EntitlementSubjectRef, featureId: string): { isLocked: boolean; reason: string; upgradePlanId?: string } {
    if (this.isAppOwnerSession() && this.isOwnSubject(subject)) return { isLocked: false, reason: '' };
    return lockStateOf(this.getEffectiveEntitlement(subject, featureId), !!subject.companyId);
  }

  getAllEffectiveEntitlements(subject: EntitlementSubjectRef): Record<string, EffectiveEntitlement> {
    const out: Record<string, EffectiveEntitlement> = {};
    for (const f of commercialStore.features) out[f.id] = this.getEffectiveEntitlement(subject, f.id);
    return out;
  }

  getEffectiveQuota(subject: EntitlementSubjectRef, quotaKey: string): { limit: number | 'UNLIMITED'; used: number; remaining: number } {
    let featureId = quotaKey;
    if (quotaKey === 'team_members_limit' || quotaKey === 'team_members') featureId = 'company.team_members';
    else if (quotaKey === 'services_limit' || quotaKey === 'services') featureId = subject.companyId ? 'company.services' : 'individual.services';
    else if (quotaKey === 'products_limit' || quotaKey === 'products') featureId = 'company.products';
    const eff = this.getEffectiveEntitlement(subject, featureId);
    const used = eff.used ?? 0;
    if (eff.status === 'UNLIMITED' || eff.status === 'ENABLED') return { limit: 'UNLIMITED', used, remaining: Infinity };
    const limit = eff.status === 'DISABLED' ? 0 : eff.limit ?? 0;
    return { limit, used, remaining: Math.max(0, limit - used) };
  }

  /**
   * Ask the backend to meter a REQUESTS / AI_USAGE operation. The server checks
   * the limit and increments the counter in one transaction; it rejects with
   * resource-exhausted when the quota is spent. Measured units (COUNT,
   * EMPLOYEES, STORAGE_MB) are computed by the backend from stored data and
   * cannot be reported by the browser.
   */
  async consumeQuota(featureId: string, amount = 1, operationId = newOperationId()): Promise<{ allowed: boolean; used: number; limit: number | null }> {
    const res = await callBackend<{ allowed: boolean; used: number; limit: number | null }>('consumeQuota', { featureId, amount, operationId });
    void commercialStore.refreshSnapshot();
    return res;
  }

  /** Server answer to "may I do this?" (used before expensive operations). */
  async checkWithServer(featureId: string, amount = 1): Promise<{ allowed: boolean; entitlement: EffectiveEntitlement }> {
    return callBackend('checkEntitlement', { featureId, amount });
  }

  // ==========================================================================
  // Control plane reads
  // ==========================================================================
  getPlans(): Plan[] {
    return [...commercialStore.plans];
  }

  getPlanById(id: string): Plan | undefined {
    return commercialStore.plans.find((p) => p.id === id);
  }

  getPlan(id: string): Plan | undefined {
    return commercialStore.plans.find((p) => p.id.toLowerCase() === id.toLowerCase());
  }

  getFeatures(): FeatureDefinition[] {
    return [...commercialStore.features];
  }

  getFeatureById(id: string): FeatureDefinition | undefined {
    return commercialStore.features.find((f) => f.id === id) || FEATURE_MAP.get(id);
  }

  getOverrides(filter?: { targetType?: 'individual' | 'company'; targetId?: string }): EntitlementOverride[] {
    return commercialStore.overrides.filter((o) => {
      if (filter?.targetType && o.targetType !== filter.targetType) return false;
      if (filter?.targetId && o.targetId !== filter.targetId) return false;
      return true;
    });
  }

  getGlobalPolicy(): GlobalPlatformPolicy {
    return { ...commercialStore.globalPolicy };
  }

  getAuditLogs(limitCount = 100): EntitlementAuditLog[] {
    return commercialStore.entitlementAudit.slice(0, limitCount).map(toEntitlementAuditLog);
  }

  getAuditTrail(): EntitlementAuditLog[] {
    return commercialStore.entitlementAudit.map(toEntitlementAuditLog);
  }

  // ==========================================================================
  // App Owner mutations — backend callables (authorised server-side)
  // ==========================================================================
  async savePlan(
    plan: Omit<Plan, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
    _actor?: ActorInfo,
    reason?: string
  ): Promise<void> {
    const existing = this.getPlanById(plan.id);
    await callBackend('upsertPlan', {
      plan: {
        id: plan.id,
        name: plan.name,
        targetType: plan.targetType,
        description: plan.description ?? '',
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        isActive: plan.isActive,
        isPopular: plan.isPopular ?? false,
        features: plan.features,
      },
      reason: reason || (existing ? `Plan ${plan.name} updated in SaaS Control Center` : `Plan ${plan.name} created in SaaS Control Center`),
    });
  }

  async setPlanFeature(planId: string, featureId: string, rule: EntitlementRule | null, reason: string): Promise<void> {
    await callBackend('setPlanFeature', { planId, featureId, rule, reason });
  }

  /** Plans are archived (never hard-deleted) so existing subscribers keep their policy. */
  async deletePlan(id: string, _actor?: ActorInfo, reason?: string): Promise<boolean> {
    await callBackend('deletePlan', { planId: id, reason: reason || `Plan ${id} archived in SaaS Control Center` });
    return true;
  }

  async duplicatePlan(id: string, _actor?: ActorInfo, reason?: string): Promise<{ planId: string }> {
    return callBackend<{ planId: string }>('duplicatePlan', { sourcePlanId: id, reason: reason || `Plan ${id} duplicated in SaaS Control Center` });
  }

  async saveOverride(
    override: Omit<EntitlementOverride, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'validFrom'> & {
      id?: string;
      createdBy?: string;
      validFrom?: string;
    },
    _actor?: ActorInfo
  ): Promise<{ overrideId: string; tenantId: string }> {
    return callBackend<{ overrideId: string; tenantId: string }>('upsertOverride', {
      targetType: override.targetType,
      targetId: override.targetId,
      featureId: override.featureId,
      rule: override.rule,
      grantType: override.grantType,
      ...(override.validFrom ? { validFrom: override.validFrom } : {}),
      ...(override.expiresAt ? { expiresAt: override.expiresAt } : {}),
      reason: override.reason || 'App Owner manual override configuration',
    });
  }

  async deleteOverride(id: string, _actor?: ActorInfo, reason?: string): Promise<boolean> {
    await callBackend('deleteOverride', { overrideId: id, reason: reason || 'App Owner removed override exception' });
    return true;
  }

  async updateGlobalPolicy(updates: Partial<GlobalPlatformPolicy>, _actor?: ActorInfo, reason?: string): Promise<GlobalPlatformPolicy> {
    const current = commercialStore.globalPolicy as unknown as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const k of POLICY_FIELDS) {
      const v = (updates as Record<string, unknown>)[k];
      if (v !== undefined && JSON.stringify(v) !== JSON.stringify(current[k])) changed[k] = v;
    }
    if (!Object.keys(changed).length) return this.getGlobalPolicy();
    await callBackend('updateGlobalPolicy', { updates: changed, reason: reason || 'Global platform settings updated' });
    return { ...commercialStore.globalPolicy, ...(changed as Partial<GlobalPlatformPolicy>) };
  }

  /** Seeds plans / catalogue / policy if missing (never overwrites). */
  async bootstrapControlPlane(reason = 'Initial control-plane bootstrap'): Promise<{ created: string[] }> {
    return callBackend('bootstrapControlPlane', { reason });
  }
}

export const entitlementService = new EntitlementService();
