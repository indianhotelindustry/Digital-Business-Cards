// ============================================================================
// App Owner control-plane mutations (Directive 25 Phases 6 & 8)
// ============================================================================
// Every handler: (1) verifies the caller is the App Owner from the verified
// token claim, (2) validates the payload against the catalogue, (3) mutates
// and appends the immutable audit record in ONE transaction, with
// server timestamps.

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { fail, invalid } from '../shared/errors';
import { serverNow, ts } from '../shared/time';
import { bool, num, obj, oneOf, PLAN_ID_PATTERN, ID_PATTERN, reason, str, type Payload } from '../shared/validate';
import { actorOf, requireAppOwner, resolveCustomerTenant, type Caller } from '../auth/identity';
import { appendAudit } from '../audit/ledger';
import { loadControlPlane, POLICY_DOC } from './controlPlane';
import {
  FEATURE_CATALOGUE,
  FEATURE_DEPENDENCIES,
  INITIAL_GLOBAL_POLICY,
  INITIAL_PLANS,
  PROTECTED_PLAN_IDS,
} from '../../../shared/domain/catalogue';
import type { EntitlementRule, EntitlementStatus, LimitUnit, Plan } from '../../../shared/domain/entitlementTypes';

const STATUSES: EntitlementStatus[] = ['DISABLED', 'ENABLED', 'LIMITED', 'UNLIMITED'];
const UNITS: LimitUnit[] = ['COUNT', 'STORAGE_MB', 'REQUESTS', 'EMPLOYEES', 'AI_USAGE'];
const BILLING = ['monthly', 'yearly', 'lifetime', 'free'] as const;
const GRANT_TYPES = ['permanent', 'until_date', 'trial', 'complimentary'] as const;

function parseRule(raw: unknown, featureIds: Set<string>, featureId: string): EntitlementRule {
  if (!featureIds.has(featureId)) invalid(`Unknown feature ${featureId}.`);
  const r = obj(raw, ['status', 'limit', 'limitUnit']);
  const status = oneOf(r, 'status', STATUSES);
  const rule: EntitlementRule = { status };
  if (r.limit !== undefined) rule.limit = num(r, 'limit', { min: 0, max: 10_000_000, int: true });
  if (r.limitUnit !== undefined) rule.limitUnit = oneOf(r, 'limitUnit', UNITS);
  if (status === 'LIMITED' && rule.limit === undefined) invalid(`${featureId}: LIMITED requires limit.`);
  return rule;
}

function parseFeatures(raw: unknown, featureIds: Set<string>): Record<string, EntitlementRule> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('features must be an object.');
  const out: Record<string, EntitlementRule> = {};
  for (const [fid, rule] of Object.entries(raw as Payload)) out[fid] = parseRule(rule, featureIds, fid);
  return out;
}

function parsePlan(raw: unknown, featureIds: Set<string>): Omit<Plan, 'createdAt' | 'updatedAt'> {
  const p = obj(raw, ['id', 'name', 'targetType', 'description', 'price', 'currency', 'billingCycle', 'isActive', 'isPopular', 'features', 'createdAt', 'updatedAt', 'archived', 'version', 'updatedBy']);
  const price = num(p, 'price', { min: 0, max: 100_000_000 });
  const billingCycle = oneOf(p, 'billingCycle', BILLING);
  if (billingCycle === 'free' && price !== 0) invalid('A free billing cycle requires price 0.');
  return {
    id: str(p, 'id', { pattern: PLAN_ID_PATTERN }),
    name: str(p, 'name', { max: 120 }),
    targetType: oneOf(p, 'targetType', ['individual', 'company'] as const),
    description: str(p, 'description', { max: 1000, optional: true }),
    price,
    currency: str(p, 'currency', { pattern: /^[A-Z]{3}$/ }),
    billingCycle,
    isActive: bool(p, 'isActive') as boolean,
    isPopular: bool(p, 'isPopular', true) ?? false,
    features: parseFeatures(p.features, featureIds),
  };
}

function planAuditAction(prev: FirebaseFirestore.DocumentData | undefined, next: Omit<Plan, 'createdAt' | 'updatedAt'>): string {
  if (!prev) return 'PLAN_CREATED';
  if (prev.price !== next.price || prev.currency !== next.currency || prev.billingCycle !== next.billingCycle) return 'PLAN_PRICING_CHANGED';
  if (JSON.stringify(prev.features) !== JSON.stringify(next.features)) return 'PLAN_FEATURES_CHANGED';
  return 'PLAN_UPDATED';
}

async function featureIdSet(): Promise<Set<string>> {
  const cp = await loadControlPlane();
  return new Set(cp.features.keys());
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export async function upsertPlan(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['plan', 'reason']);
  const why = reason(p);
  const plan = parsePlan(p.plan, await featureIdSet());
  const ref = db().collection('plans').doc(plan.id);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const prevData = prev.data();
    if (prevData?.archived && plan.isActive) invalid('Archived plans cannot be re-activated; duplicate them instead.');
    tx.set(ref, {
      ...plan,
      archived: prevData?.archived ?? false,
      version: (prevData?.version ?? 0) + 1,
      createdAt: prevData?.createdAt ?? serverNow(),
      updatedAt: serverNow(),
      updatedBy: caller.uid,
    });
    const action = planAuditAction(prevData, plan);
    appendAudit(tx, 'entitlementAuditLogs', {
      action, actor: actorOf(caller), targetType: 'plan', targetId: plan.id, targetName: plan.name,
      previousValue: prevData ? { price: prevData.price, currency: prevData.currency, billingCycle: prevData.billingCycle, isActive: prevData.isActive, features: prevData.features } : null,
      newValue: { price: plan.price, currency: plan.currency, billingCycle: plan.billingCycle, isActive: plan.isActive, features: plan.features },
      reason: why, source: 'SaaS Control Center',
    });
    return { planId: plan.id, action, version: (prevData?.version ?? 0) + 1 };
  });
}

export async function setPlanPricing(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['planId', 'price', 'currency', 'billingCycle', 'reason']);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const price = num(p, 'price', { min: 0, max: 100_000_000 });
  const currency = str(p, 'currency', { pattern: /^[A-Z]{3}$/ });
  const billingCycle = oneOf(p, 'billingCycle', BILLING);
  if (billingCycle === 'free' && price !== 0) invalid('A free billing cycle requires price 0.');
  const why = reason(p);
  const ref = db().collection('plans').doc(planId);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) fail('not-found', `Plan ${planId} does not exist.`);
    const d = prev.data()!;
    tx.update(ref, { price, currency, billingCycle, version: (d.version ?? 0) + 1, updatedAt: serverNow(), updatedBy: caller.uid });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: 'PLAN_PRICING_CHANGED', actor: actorOf(caller), targetType: 'plan', targetId: planId, targetName: d.name,
      previousValue: { price: d.price, currency: d.currency, billingCycle: d.billingCycle },
      newValue: { price, currency, billingCycle }, reason: why, source: 'SaaS Control Center',
    });
    return { planId, price, currency, billingCycle };
  });
}

export async function setPlanFeature(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['planId', 'featureId', 'rule', 'reason']);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  const featureId = str(p, 'featureId', { pattern: ID_PATTERN });
  const ids = await featureIdSet();
  const rule = p.rule === null ? null : parseRule(p.rule, ids, featureId);
  const why = reason(p);
  const ref = db().collection('plans').doc(planId);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) fail('not-found', `Plan ${planId} does not exist.`);
    const d = prev.data()!;
    tx.update(ref, {
      [`features.${featureId}`]: rule === null ? FieldValue.delete() : rule,
      version: (d.version ?? 0) + 1, updatedAt: serverNow(), updatedBy: caller.uid,
    });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: 'PLAN_FEATURES_CHANGED', actor: actorOf(caller), targetType: 'plan', targetId: planId, targetName: d.name, featureId,
      previousValue: d.features?.[featureId] ?? null, newValue: rule, reason: why, source: 'SaaS Control Center',
    });
    return { planId, featureId, rule };
  });
}

export async function duplicatePlan(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['sourcePlanId', 'newPlanId', 'newName', 'reason']);
  const sourcePlanId = str(p, 'sourcePlanId', { pattern: PLAN_ID_PATTERN });
  const newPlanId = str(p, 'newPlanId', { pattern: PLAN_ID_PATTERN, optional: true }) || `${sourcePlanId}_copy_${Date.now().toString(36)}`;
  if (!PLAN_ID_PATTERN.test(newPlanId)) invalid('newPlanId has an invalid format.');
  const why = reason(p);
  const srcRef = db().collection('plans').doc(sourcePlanId);
  const dstRef = db().collection('plans').doc(newPlanId);
  return db().runTransaction(async (tx) => {
    const [src, dst] = await Promise.all([tx.get(srcRef), tx.get(dstRef)]);
    if (!src.exists) fail('not-found', `Plan ${sourcePlanId} does not exist.`);
    if (dst.exists) fail('already-exists', `Plan ${newPlanId} already exists.`);
    const s = src.data()!;
    const name = str(p, 'newName', { max: 120, optional: true }) || `${s.name} (Copy)`;
    tx.create(dstRef, {
      ...s, id: newPlanId, name, isActive: false, isPopular: false, archived: false, version: 1,
      createdAt: serverNow(), updatedAt: serverNow(), updatedBy: caller.uid,
    });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: 'PLAN_DUPLICATED', actor: actorOf(caller), targetType: 'plan', targetId: newPlanId, targetName: name,
      previousValue: { sourcePlanId }, newValue: { planId: newPlanId, isActive: false }, reason: why, source: 'SaaS Control Center',
    });
    return { planId: newPlanId };
  });
}

/** Plans are archived, never hard-deleted: existing subscribers keep their policy. */
export async function deletePlan(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['planId', 'reason']);
  const planId = str(p, 'planId', { pattern: PLAN_ID_PATTERN });
  if ((PROTECTED_PLAN_IDS as readonly string[]).includes(planId)) fail('failed-precondition', `${planId} is a standard plan and cannot be deleted.`);
  const why = reason(p);
  const ref = db().collection('plans').doc(planId);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) fail('not-found', `Plan ${planId} does not exist.`);
    const d = prev.data()!;
    tx.update(ref, { archived: true, isActive: false, version: (d.version ?? 0) + 1, updatedAt: serverNow(), updatedBy: caller.uid });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: 'PLAN_ARCHIVED', actor: actorOf(caller), targetType: 'plan', targetId: planId, targetName: d.name,
      previousValue: { isActive: d.isActive, archived: !!d.archived }, newValue: { isActive: false, archived: true }, reason: why, source: 'SaaS Control Center',
    });
    return { planId, archived: true };
  });
}

// ---------------------------------------------------------------------------
// Entitlement overrides (incl. temporary / trial / complimentary grants)
// ---------------------------------------------------------------------------
export const overrideDocId = (targetType: string, targetId: string, featureId: string) => `${targetType}_${targetId}__${featureId}`;

export async function upsertOverride(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['targetType', 'targetId', 'featureId', 'rule', 'grantType', 'validFrom', 'expiresAt', 'reason', 'targetName', 'id']);
  const targetType = oneOf(p, 'targetType', ['individual', 'company'] as const);
  const targetId = str(p, 'targetId', { pattern: ID_PATTERN });
  const featureId = str(p, 'featureId', { pattern: ID_PATTERN });
  const rule = parseRule(p.rule, await featureIdSet(), featureId);
  const grantType = oneOf(p, 'grantType', GRANT_TYPES);
  const expiresAt = str(p, 'expiresAt', { optional: true, max: 40 });
  const validFrom = str(p, 'validFrom', { optional: true, max: 40 });
  for (const [k, v] of [['expiresAt', expiresAt], ['validFrom', validFrom]] as const) {
    if (v && Number.isNaN(Date.parse(v))) invalid(`${k} must be an ISO date.`);
  }
  if (grantType !== 'permanent' && !expiresAt) invalid(`${grantType} grants require expiresAt.`);
  const why = reason(p);
  const { tenantId, name } = await resolveCustomerTenant(targetType, targetId);
  const ref = db().collection('entitlementOverrides').doc(overrideDocId(targetType, targetId, featureId));
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const d = prev.data();
    tx.set(ref, {
      id: ref.id, targetType, targetId, targetName: name, tenantId, featureId, rule, grantType,
      validFrom: validFrom ? ts(new Date(validFrom).toISOString()) : serverNow(),
      expiresAt: expiresAt ? ts(new Date(expiresAt).toISOString()) : null,
      reason: why, createdBy: d?.createdBy ?? caller.uid, updatedBy: caller.uid,
      createdAt: d?.createdAt ?? serverNow(), updatedAt: serverNow(),
    });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: grantType === 'complimentary' ? 'COMPLIMENTARY_FEATURE_GRANTED' : grantType === 'trial' ? 'TRIAL_FEATURE_GRANTED' : 'OVERRIDE_SET',
      actor: actorOf(caller), targetType, targetId, targetName: name, tenantId, featureId,
      previousValue: d ? { rule: d.rule, grantType: d.grantType } : 'NONE (Follows Plan)',
      newValue: { rule, grantType, expiresAt: expiresAt || null }, reason: why, source: 'SaaS Control Center',
    });
    return { overrideId: ref.id, tenantId };
  });
}

export async function deleteOverride(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['overrideId', 'reason']);
  const overrideId = str(p, 'overrideId', { max: 300 });
  const why = reason(p);
  const ref = db().collection('entitlementOverrides').doc(overrideId);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    if (!prev.exists) fail('not-found', 'Override not found.');
    const d = prev.data()!;
    tx.delete(ref);
    appendAudit(tx, 'entitlementAuditLogs', {
      action: 'OVERRIDE_REMOVED', actor: actorOf(caller), targetType: d.targetType, targetId: d.targetId, targetName: d.targetName,
      tenantId: d.tenantId, featureId: d.featureId, previousValue: { rule: d.rule, grantType: d.grantType },
      newValue: 'REMOVED (Reverted to Plan)', reason: why, source: 'SaaS Control Center',
    });
    return { overrideId, removed: true };
  });
}

// ---------------------------------------------------------------------------
// Global policy & platform safety controls
// ---------------------------------------------------------------------------
const POLICY_FIELDS = [
  'maintenanceMode', 'allowSelfRegistration', 'defaultIndividualPlanId', 'defaultCompanyPlanId',
  'defaultTrialDays', 'enforceLimitsStrictly', 'currency', 'currencySymbol', 'platformName',
  'globalFeatureOverrides', 'paymentGraceDays',
] as const;

export async function updateGlobalPolicy(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['updates', 'reason']);
  const why = reason(p);
  const u = obj(p.updates, POLICY_FIELDS);
  const cp = await loadControlPlane();
  const updates: Record<string, unknown> = {};
  for (const k of ['maintenanceMode', 'allowSelfRegistration', 'enforceLimitsStrictly'] as const) {
    if (u[k] !== undefined) updates[k] = bool(u, k);
  }
  for (const [k, target] of [['defaultIndividualPlanId', 'individual'], ['defaultCompanyPlanId', 'company']] as const) {
    if (u[k] !== undefined) {
      const id = str(u, k, { pattern: PLAN_ID_PATTERN });
      const plan = cp.plans.get(id);
      if (!plan || plan.targetType !== target || plan.archived) invalid(`${k} must reference an existing ${target} plan.`);
      updates[k] = id;
    }
  }
  if (u.defaultTrialDays !== undefined) updates.defaultTrialDays = num(u, 'defaultTrialDays', { min: 0, max: 365, int: true });
  if (u.paymentGraceDays !== undefined) updates.paymentGraceDays = num(u, 'paymentGraceDays', { min: 0, max: 60, int: true });
  if (u.currency !== undefined) updates.currency = str(u, 'currency', { pattern: /^[A-Z]{3}$/ });
  if (u.currencySymbol !== undefined) updates.currencySymbol = str(u, 'currencySymbol', { max: 4 });
  if (u.platformName !== undefined) updates.platformName = str(u, 'platformName', { max: 80 });
  if (u.globalFeatureOverrides !== undefined) updates.globalFeatureOverrides = parseFeatures(u.globalFeatureOverrides, new Set(cp.features.keys()));
  if (!Object.keys(updates).length) invalid('No policy fields to update.');

  const ref = db().collection('globalPolicies').doc(POLICY_DOC);
  const safety = ['maintenanceMode', 'allowSelfRegistration', 'enforceLimitsStrictly'].some((k) => k in updates);
  return db().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const d = prev.data() ?? { ...INITIAL_GLOBAL_POLICY };
    const previousValue = Object.fromEntries(Object.keys(updates).map((k) => [k, (d as Record<string, unknown>)[k] ?? null]));
    tx.set(ref, { ...updates, id: POLICY_DOC, version: ((d as { version?: number }).version ?? 0) + 1, updatedAt: serverNow(), updatedBy: caller.uid }, { merge: true });
    appendAudit(tx, 'entitlementAuditLogs', {
      action: safety ? 'PLATFORM_SAFETY_CHANGED' : 'GLOBAL_POLICY_CHANGED', actor: actorOf(caller),
      targetType: 'global', targetId: 'global_policy', targetName: 'Global Platform Policy',
      previousValue, newValue: updates, reason: why, source: 'SaaS Control Center',
    });
    return { updated: Object.keys(updates) };
  });
}

// ---------------------------------------------------------------------------
// Control-plane bootstrap: create-if-missing, never overwrites.
// ---------------------------------------------------------------------------
export async function seedControlPlane(actor: { uid: string; name: string; role: string }, reasonText: string) {
  const firestore = db();
  return firestore.runTransaction(async (tx) => {
    const planRefs = INITIAL_PLANS.map((p) => firestore.collection('plans').doc(p.id));
    const featureRefs = FEATURE_CATALOGUE.map((f) => firestore.collection('featureCatalogue').doc(f.id));
    const policyRef = firestore.collection('globalPolicies').doc(POLICY_DOC);
    const [planSnaps, featureSnaps, policySnap] = await Promise.all([
      tx.getAll(...planRefs), tx.getAll(...featureRefs), tx.get(policyRef),
    ]);
    const created: string[] = [];
    planSnaps.forEach((s, i) => {
      if (s.exists) return;
      const { createdAt, updatedAt, ...plan } = INITIAL_PLANS[i];
      tx.create(s.ref, { ...plan, archived: false, version: 1, createdAt: serverNow(), updatedAt: serverNow(), updatedBy: actor.uid });
      created.push(`plans/${plan.id}`);
    });
    featureSnaps.forEach((s, i) => {
      if (s.exists) return;
      const f = FEATURE_CATALOGUE[i];
      tx.create(s.ref, { ...JSON.parse(JSON.stringify(f)), dependsOn: FEATURE_DEPENDENCIES[f.id] ?? [], createdAt: serverNow(), updatedAt: serverNow() });
      created.push(`featureCatalogue/${f.id}`);
    });
    if (!policySnap.exists) {
      tx.create(policyRef, { ...INITIAL_GLOBAL_POLICY, id: POLICY_DOC, version: 1, updatedAt: serverNow(), updatedBy: actor.uid });
      created.push(`globalPolicies/${POLICY_DOC}`);
    }
    if (created.length) {
      appendAudit(tx, 'entitlementAuditLogs', {
        action: 'CONTROL_PLANE_BOOTSTRAPPED', actor, targetType: 'global', targetId: 'control_plane', targetName: 'Commercial control plane',
        previousValue: null, newValue: { created }, reason: reasonText, source: 'bootstrapControlPlane',
      });
    }
    return { created };
  });
}

export async function bootstrapControlPlane(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data ?? {}, ['reason']);
  return seedControlPlane(actorOf(caller), reason(p));
}
