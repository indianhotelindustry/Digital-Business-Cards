// Directive 25: the single shared commercial domain (shared/domain) used by the
// backend resolver and, for display only, by the browser.
import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOGUE, FEATURE_DEPENDENCIES, INITIAL_GLOBAL_POLICY, INITIAL_PLANS, PROTECTED_PLAN_IDS } from '../../shared/domain/catalogue';
import { fitsLimit, resolveEntitlement, type ControlPlane } from '../../shared/domain/entitlementResolver';
import { effectiveSubscriptionState, isTransitionAllowed, timeAdjustedStatus } from '../../shared/domain/subscriptionLifecycle';
import { periodKeyForUnit, usageUnitOf } from '../../shared/domain/usageKeys';
import { validateSlugFormat } from '../../shared/domain/slugRules';
import type { EntitlementOverride } from '../../shared/domain/entitlementTypes';
import type { Subscription } from '../../shared/domain/subscriptionTypes';

const NOW = '2026-10-02T12:00:00.000Z';
const cp: ControlPlane = {
  features: new Map(FEATURE_CATALOGUE.map((f) => [f.id, f])),
  dependencies: FEATURE_DEPENDENCIES,
  globalPolicy: { ...INITIAL_GLOBAL_POLICY },
  plans: new Map(INITIAL_PLANS.map((p) => [p.id, p])),
};
const ov = (o: Partial<EntitlementOverride>): EntitlementOverride => ({
  id: 'o', targetType: 'company', targetId: 'co', featureId: 'company.ai_assistance', rule: { status: 'ENABLED' }, grantType: 'permanent',
  validFrom: '2026-01-01T00:00:00.000Z', expiresAt: null, reason: 'r', createdBy: 'owner', createdAt: '', updatedAt: '', ...o,
});
const companyEmployee = { userIds: ['emp_1', 'uid_1'], companyId: 'co', planId: 'company_free' };

describe('standard plans are preserved', () => {
  it('Individual Free/Pro, Company Free/Pro and Enterprise Custom exist and are protected', () => {
    expect(INITIAL_PLANS.map((p) => p.id).sort()).toEqual(['company_free', 'company_pro', 'custom', 'individual_free', 'individual_pro']);
    expect([...PROTECTED_PLAN_IDS].sort()).toEqual(['company_free', 'company_pro', 'custom', 'individual_free', 'individual_pro']);
  });
});

describe('resolver precedence: Individual > Company > Plan > Global > Baseline', () => {
  const f = 'company.ai_assistance';
  it('plan policy applies without overrides', () => {
    expect(resolveEntitlement(cp, companyEmployee, [], f, NOW).source).toBe('plan_policy');
    expect(resolveEntitlement(cp, companyEmployee, [], f, NOW).isGranted).toBe(false);
  });
  it('company override beats plan; individual override beats company', () => {
    const company = ov({ rule: { status: 'ENABLED' } });
    const individual = ov({ id: 'i', targetType: 'individual', targetId: 'emp_1', rule: { status: 'DISABLED' } });
    expect(resolveEntitlement(cp, companyEmployee, [company], f, NOW)).toMatchObject({ isGranted: true, source: 'company_override' });
    expect(resolveEntitlement(cp, companyEmployee, [company, individual], f, NOW)).toMatchObject({ isGranted: false, source: 'individual_override' });
  });
  it('global policy override applies when the plan is silent', () => {
    const policy = { ...cp, globalPolicy: { ...cp.globalPolicy, globalFeatureOverrides: { 'platform.beta_x': { status: 'ENABLED' as const } } } };
    expect(resolveEntitlement(policy, companyEmployee, [], 'platform.beta_x', NOW).sourceDescription).toBe('Global System Policy Override');
  });
  it('expired and not-yet-valid overrides fall back', () => {
    const expired = ov({ expiresAt: '2026-10-01T00:00:00.000Z' });
    const future = ov({ validFrom: '2026-12-01T00:00:00.000Z' });
    expect(resolveEntitlement(cp, companyEmployee, [expired], f, NOW).source).toBe('plan_policy');
    expect(resolveEntitlement(cp, companyEmployee, [future], f, NOW).source).toBe('plan_policy');
  });
  it('another company or person never benefits from an override', () => {
    expect(resolveEntitlement(cp, { ...companyEmployee, companyId: 'other' }, [ov({})], f, NOW).isGranted).toBe(false);
    expect(resolveEntitlement(cp, companyEmployee, [ov({ targetType: 'individual', targetId: 'someone_else' })], f, NOW).isGranted).toBe(false);
  });
  it('dependencies disable a child whose prerequisite is off; suspension locks everything', () => {
    const noSite = ov({ featureId: 'company.mini_website', rule: { status: 'DISABLED' } });
    expect(resolveEntitlement(cp, companyEmployee, [noSite], 'company.services', NOW)).toMatchObject({ isGranted: false, sourceDescription: 'Prerequisite Missing (company.mini_website disabled)' });
    expect(resolveEntitlement(cp, { ...companyEmployee, accountSuspended: true }, [], 'individual.business_card', NOW).isGranted).toBe(false);
  });
  it('limits use server usage', () => {
    const eff = resolveEntitlement(cp, companyEmployee, [], 'company.team_members', NOW, (id) => (id === 'company.team_members' ? 3 : 0));
    expect([eff.limit, eff.used, eff.remaining, eff.isGranted]).toEqual([3, 3, 0, false]);
    expect(fitsLimit(eff, 1)).toBe(false);
  });
});

describe('subscription lifecycle (DATA != DELETED, FEATURE = LOCKED)', () => {
  const base: Subscription = {
    subscriptionId: 'company_co', customerType: 'company', customerId: 'co', planId: 'company_pro', status: 'ACTIVE', currency: 'INR',
    billingInterval: 'yearly', price: 500, startedAt: '2025-10-01T00:00:00.000Z', currentPeriodStart: '2025-10-01T00:00:00.000Z',
    currentPeriodEnd: '2026-11-01T00:00:00.000Z', cancelAtPeriodEnd: false, paymentStatus: 'PAID', provider: 'razorpay', createdAt: '', updatedAt: '',
  };
  it('time-based transitions', () => {
    expect(timeAdjustedStatus({ ...base, status: 'TRIAL', trialEndsAt: '2026-10-01T00:00:00.000Z' }, NOW).status).toBe('EXPIRED');
    expect(timeAdjustedStatus({ ...base, status: 'COMPLIMENTARY', currentPeriodEnd: '2026-10-01T00:00:00.000Z' }, NOW).status).toBe('EXPIRED');
    expect(timeAdjustedStatus({ ...base, currentPeriodEnd: '2026-09-30T00:00:00.000Z' }, NOW).status).toBe('PAST_DUE');
    expect(timeAdjustedStatus({ ...base, currentPeriodEnd: '2026-09-01T00:00:00.000Z' }, NOW).status).toBe('EXPIRED');
    expect(timeAdjustedStatus({ ...base, currentPeriodEnd: '2026-09-30T00:00:00.000Z', cancelAtPeriodEnd: true }, NOW).status).toBe('CANCELLED');
    expect(timeAdjustedStatus({ ...base, status: 'GRACE', graceEndsAt: '2026-10-01T00:00:00.000Z' }, NOW).status).toBe('SUSPENDED');
  });
  it('a lapsed subscription falls back to the free plan (content untouched)', () => {
    const s = effectiveSubscriptionState({ ...base, status: 'TRIAL', trialEndsAt: '2026-10-01T00:00:00.000Z' }, 'company', NOW);
    expect([s.status, s.grantsPlanAccess, s.planIdForAccess]).toEqual(['EXPIRED', false, 'company_free']);
    expect(s.reason).toContain('content retained');
    expect(effectiveSubscriptionState(null, 'individual', NOW).planIdForAccess).toBe('individual_free');
  });
  it('only listed transitions are allowed', () => {
    expect(isTransitionAllowed('EXPIRED', 'GRACE')).toBe(false);
    expect(isTransitionAllowed('TRIAL', 'ACTIVE')).toBe(true);
  });
});

describe('usage keys and slug rules', () => {
  it('AI features are metered monthly even without a catalogue unit', () => {
    expect(usageUnitOf(cp.features.get('company.ai_assistance'))).toBe('AI_USAGE');
    expect(periodKeyForUnit('AI_USAGE', Date.parse(NOW))).toBe('2026-10');
    expect(periodKeyForUnit('EMPLOYEES', Date.parse(NOW))).toBe('current');
  });
  it('reserved routes and malformed slugs are refused', () => {
    expect(validateSlugFormat('admin').errorCode).toBe('RESERVED_SYSTEM_ROUTE');
    expect(validateSlugFormat('ab').errorCode).toBe('TOO_SHORT');
    expect(validateSlugFormat('rahul-sharma').isValid).toBe(true);
  });
});
