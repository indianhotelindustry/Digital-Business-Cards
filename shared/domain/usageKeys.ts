// ============================================================================
// Usage counter keys (Directive 25 Phase 10)
// ============================================================================
// usageCounters/{targetType}_{targetId}__{featureId}__{periodKey}
// Written only by the backend; the browser uses the same keys to display the
// App Owner's view of a customer's counters.

import type { LimitUnit } from './entitlementTypes';

/** Units consumed per operation (monthly window). Everything else is measured from stored data. */
export const METERED_UNITS: LimitUnit[] = ['REQUESTS', 'AI_USAGE'];

/**
 * Unit a feature's usage is counted in. AI features carry no limitUnit in the
 * catalogue but are always metered as AI_USAGE. An override/plan rule may name
 * a metered unit explicitly (ruleUnit).
 */
export function usageUnitOf(def: { limitUnit?: LimitUnit; badge?: string } | undefined, ruleUnit?: LimitUnit): LimitUnit | undefined {
  if (ruleUnit && METERED_UNITS.includes(ruleUnit)) return ruleUnit;
  if (def?.limitUnit) return def.limitUnit;
  return def?.badge === 'AI' ? 'AI_USAGE' : undefined;
}

export function isMetered(unit: LimitUnit | undefined): boolean {
  return !!unit && METERED_UNITS.includes(unit);
}

export function periodKeyForUnit(unit: LimitUnit | undefined, nowMs: number): string {
  if (unit && METERED_UNITS.includes(unit)) return new Date(nowMs).toISOString().slice(0, 7);
  return 'current';
}

export interface UsageTarget {
  targetType: 'company' | 'individual';
  targetId: string;
}

export function usageCounterId(target: UsageTarget, featureId: string, periodKey: string): string {
  return `${target.targetType}_${target.targetId}__${featureId}__${periodKey}`;
}
