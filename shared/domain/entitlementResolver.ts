// ============================================================================
// DSBC AUTHORITATIVE ENTITLEMENT RESOLVER (Directive 18 semantics, Directive 25)
// ============================================================================
// Pure functions, no I/O. The backend (functions/) is the ONLY caller whose
// result is authoritative: it loads the control plane, the overrides and the
// usage counters from Firestore and calls resolveEntitlement(). The browser
// never resolves entitlements itself; it displays the backend's snapshot.
//
// Precedence (most specific wins):
//   Individual Override  >  Company Override  >  Plan Policy  >
//   Global Policy override  >  Catalogue baseline
// Expired (or not-yet-valid) overrides are ignored, so a temporary grant falls
// back automatically. Feature dependencies disable a child whose prerequisite
// is not granted. A suspended account has every feature DISABLED.

import type {
  EffectiveEntitlement,
  EntitlementOverride,
  EntitlementRule,
  EntitlementStatus,
  FeatureDefinition,
  GlobalPlatformPolicy,
  LimitUnit,
  Plan,
} from './entitlementTypes';
import { LEGACY_PLAN_ALIASES } from './catalogue';

export interface ControlPlane {
  features: Map<string, FeatureDefinition>;
  dependencies: Record<string, string[]>;
  globalPolicy: GlobalPlatformPolicy;
  plans: Map<string, Plan>;
}

export interface EntitlementSubject {
  /** Ids an individual override may target (Firebase uid and/or employeeId). */
  userIds: string[];
  companyId: string | null;
  /** Plan already resolved through the subscription lifecycle. */
  planId: string | null;
  /** Company or user suspended by the App Owner: everything is locked. */
  accountSuspended?: boolean;
}

/** usage(featureId) -> current authoritative counter value. */
export type UsageLookup = (featureId: string) => number;

const NO_USAGE: UsageLookup = () => 0;

export function findPlan(plans: Map<string, Plan>, planId: string | null | undefined): Plan | undefined {
  if (!planId) return undefined;
  const direct = plans.get(planId);
  if (direct) return direct;
  const lower = planId.toLowerCase();
  for (const p of plans.values()) if (p.id.toLowerCase() === lower) return p;
  const alias = LEGACY_PLAN_ALIASES[lower];
  return alias ? plans.get(alias) : undefined;
}

export function isOverrideInForce(o: Pick<EntitlementOverride, 'validFrom' | 'expiresAt'>, nowIso: string): boolean {
  if (o.expiresAt && o.expiresAt <= nowIso) return false;
  if (o.validFrom && o.validFrom > nowIso) return false;
  return true;
}

function describeOverride(kind: 'Company' | 'Individual', o: EntitlementOverride): string {
  return `${kind} Override (${o.grantType}${o.expiresAt ? ` until ${o.expiresAt.slice(0, 10)}` : ''})`;
}

function pickOverride(
  overrides: EntitlementOverride[],
  targetType: 'company' | 'individual',
  targetIds: string[],
  featureId: string,
  nowIso: string
): EntitlementOverride | undefined {
  // Deterministic: first target id in priority order with an in-force override.
  for (const id of targetIds) {
    const hit = overrides.find(
      (o) => o.targetType === targetType && o.targetId === id && o.featureId === featureId && isOverrideInForce(o, nowIso)
    );
    if (hit) return hit;
  }
  return undefined;
}

export function resolveEntitlement(
  cp: ControlPlane,
  subject: EntitlementSubject,
  overrides: EntitlementOverride[],
  featureId: string,
  nowIso: string,
  usage: UsageLookup = NO_USAGE,
  visiting: Set<string> = new Set()
): EffectiveEntitlement {
  const def: FeatureDefinition = cp.features.get(featureId) || {
    id: featureId,
    name: featureId,
    description: '',
    category: 'individual',
    scope: 'both',
    defaultEntitlement: 'DISABLED',
  };

  let status: EntitlementStatus = def.defaultEntitlement;
  let limit: number | undefined = def.defaultLimit;
  let limitUnit: LimitUnit | undefined = def.limitUnit;
  let source: EffectiveEntitlement['source'] = 'global_policy';
  let sourceDescription = 'Global Platform Baseline';
  let expiresAt: string | null = null;

  const apply = (rule: EntitlementRule) => {
    status = rule.status;
    if (rule.limit !== undefined) limit = rule.limit;
    if (rule.limitUnit !== undefined) limitUnit = rule.limitUnit;
  };

  const gRule = cp.globalPolicy.globalFeatureOverrides?.[featureId];
  if (gRule) {
    apply(gRule);
    sourceDescription = 'Global System Policy Override';
  }

  const plan = findPlan(cp.plans, subject.planId);
  if (plan && plan.features[featureId]) {
    apply(plan.features[featureId]);
    source = 'plan_policy';
    sourceDescription = `Plan: ${plan.name}`;
  }

  if (subject.companyId) {
    const co = pickOverride(overrides, 'company', [subject.companyId], featureId, nowIso);
    if (co) {
      apply(co.rule);
      source = 'company_override';
      sourceDescription = describeOverride('Company', co);
      expiresAt = co.expiresAt || null;
    }
  }

  const ind = pickOverride(overrides, 'individual', subject.userIds.filter(Boolean), featureId, nowIso);
  if (ind) {
    apply(ind.rule);
    source = 'individual_override';
    sourceDescription = describeOverride('Individual', ind);
    expiresAt = ind.expiresAt || null;
  }

  // Feature dependencies (cycle-safe).
  const deps = cp.dependencies[featureId] || [];
  if (deps.length && !visiting.has(featureId)) {
    const nextVisiting = new Set(visiting).add(featureId);
    for (const depId of deps) {
      const parent = resolveEntitlement(cp, subject, overrides, depId, nowIso, usage, nextVisiting);
      if (!parent.isGranted) {
        status = 'DISABLED';
        sourceDescription = `Prerequisite Missing (${depId} disabled)`;
        break;
      }
    }
  }

  if (subject.accountSuspended) {
    status = 'DISABLED';
    sourceDescription = 'Account suspended by platform';
  }

  const used = usage(featureId);
  const remaining = status === 'UNLIMITED' ? undefined : limit !== undefined ? Math.max(0, limit - used) : undefined;
  const isGranted =
    status === 'ENABLED' ||
    status === 'UNLIMITED' ||
    (status === 'LIMITED' && (limit === undefined || (remaining !== undefined && remaining > 0)));

  return {
    featureId,
    featureName: def.name,
    status,
    isGranted,
    limit: status === 'UNLIMITED' ? undefined : limit,
    limitUnit,
    used,
    remaining,
    source,
    sourceDescription,
    expiresAt,
    isExpired: false,
  };
}

export function resolveAll(
  cp: ControlPlane,
  subject: EntitlementSubject,
  overrides: EntitlementOverride[],
  nowIso: string,
  usage: UsageLookup = NO_USAGE
): Record<string, EffectiveEntitlement> {
  const out: Record<string, EffectiveEntitlement> = {};
  for (const id of cp.features.keys()) out[id] = resolveEntitlement(cp, subject, overrides, id, nowIso, usage);
  return out;
}

// ---------------------------------------------------------------------------
// Decision helpers over an already-resolved entitlement (Directive 18 API).
// ---------------------------------------------------------------------------
export function canUse(eff: EffectiveEntitlement): boolean {
  return eff.isGranted;
}

export function limitOf(eff: EffectiveEntitlement): { limit: number; unit?: LimitUnit; isUnlimited: boolean } {
  if (eff.status === 'UNLIMITED') return { limit: Infinity, unit: eff.limitUnit, isUnlimited: true };
  return { limit: eff.limit ?? 0, unit: eff.limitUnit, isUnlimited: false };
}

export function usageOf(eff: EffectiveEntitlement): { current: number; limit?: number; unit?: LimitUnit; remaining?: number } {
  return { current: eff.used ?? 0, limit: eff.limit, unit: eff.limitUnit, remaining: eff.remaining };
}

/** Would `requestedAmount` more units fit? */
export function fitsLimit(eff: EffectiveEntitlement, requestedAmount = 1): boolean {
  if (eff.status === 'DISABLED') return false;
  if (eff.status === 'ENABLED' || eff.status === 'UNLIMITED') return true;
  if (eff.limit === undefined) return true;
  return (eff.used ?? 0) + requestedAmount <= eff.limit;
}

export function lockStateOf(
  eff: EffectiveEntitlement,
  isCompanySubject: boolean
): { isLocked: boolean; reason: string; upgradePlanId?: string } {
  const upgradePlanId = isCompanySubject ? 'company_pro' : 'individual_pro';
  if (eff.status === 'DISABLED') {
    return { isLocked: true, reason: `Feature is not available on ${eff.sourceDescription}.`, upgradePlanId };
  }
  if (eff.status === 'LIMITED' && eff.remaining !== undefined && eff.remaining <= 0) {
    return { isLocked: true, reason: `Quota limit reached (${eff.used}/${eff.limit} ${eff.limitUnit || ''}).`, upgradePlanId };
  }
  return { isLocked: false, reason: '' };
}

/** A fully locked entitlement, used by the browser while no snapshot is loaded (fail closed). */
export function lockedEntitlement(def: Pick<FeatureDefinition, 'id' | 'name' | 'limitUnit'>, reason: string): EffectiveEntitlement {
  return {
    featureId: def.id,
    featureName: def.name,
    status: 'DISABLED',
    isGranted: false,
    limit: 0,
    limitUnit: def.limitUnit,
    used: 0,
    remaining: 0,
    source: 'global_policy',
    sourceDescription: reason,
    expiresAt: null,
    isExpired: false,
  };
}
