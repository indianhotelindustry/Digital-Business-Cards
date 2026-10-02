// ============================================================================
// Persistent entitlement control plane (Directive 25 Phase 6/7)
// ============================================================================
// Firestore is authoritative:
//   featureCatalogue/{featureId}     feature definitions + dependsOn
//   plans/{planId}                   plan policy and pricing
//   globalPolicies/platform          global policy and platform safety controls
//   entitlementOverrides/{id}        company / individual grants
//   subscriptions/{type}_{id}        customer subscription
//   usageCounters/{key}              server-maintained usage
// The shared catalogue constants are used only as the bootstrap seed and as the
// catalogue baseline if featureCatalogue has never been seeded (they grant
// nothing beyond the platform defaults).

import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { toIso } from '../shared/time';
import {
  FEATURE_CATALOGUE,
  FEATURE_DEPENDENCIES,
  INITIAL_GLOBAL_POLICY,
} from '../../../shared/domain/catalogue';
import type { ControlPlane, EntitlementSubject, UsageLookup } from '../../../shared/domain/entitlementResolver';
import type {
  EntitlementOverride,
  FeatureDefinition,
  GlobalPlatformPolicy,
  LimitUnit,
  Plan,
} from '../../../shared/domain/entitlementTypes';
import type { CustomerType, Subscription } from '../../../shared/domain/subscriptionTypes';
import type { CommercialSubject } from '../auth/identity';
import { METERED_UNITS, periodKeyForUnit, usageCounterId, type UsageTarget } from '../../../shared/domain/usageKeys';

export const POLICY_DOC = 'platform';
type Getter = Pick<Transaction, 'get' | 'getAll'> | null;

const get = (tx: Getter, ref: FirebaseFirestore.DocumentReference) => (tx ? tx.get(ref) : ref.get());
const getQuery = (tx: Getter, q: FirebaseFirestore.Query) => (tx ? tx.get(q) : q.get());

export function planFromDoc(id: string, d: FirebaseFirestore.DocumentData): Plan {
  return { ...(d as Plan), id, createdAt: toIso(d.createdAt) || '', updatedAt: toIso(d.updatedAt) || '' };
}

export function overrideFromDoc(id: string, d: FirebaseFirestore.DocumentData): EntitlementOverride {
  return {
    ...(d as EntitlementOverride),
    id,
    validFrom: toIso(d.validFrom) || '',
    expiresAt: toIso(d.expiresAt),
    createdAt: toIso(d.createdAt) || '',
    updatedAt: toIso(d.updatedAt) || '',
  };
}

export function subscriptionFromDoc(d: FirebaseFirestore.DocumentData): Subscription {
  const iso = (k: string) => toIso(d[k]);
  return {
    ...(d as Subscription),
    startedAt: iso('startedAt') || '',
    currentPeriodStart: iso('currentPeriodStart') || '',
    currentPeriodEnd: iso('currentPeriodEnd') || '',
    trialEndsAt: iso('trialEndsAt'),
    graceEndsAt: iso('graceEndsAt'),
    cancelledAt: iso('cancelledAt'),
    createdAt: iso('createdAt') || '',
    updatedAt: iso('updatedAt') || '',
  };
}

export async function loadControlPlane(tx: Getter = null): Promise<ControlPlane> {
  const [catalogueSnap, plansSnap, policySnap] = await Promise.all([
    getQuery(tx, db().collection('featureCatalogue')),
    getQuery(tx, db().collection('plans')),
    get(tx, db().collection('globalPolicies').doc(POLICY_DOC)),
  ]);

  const features = new Map<string, FeatureDefinition>();
  const dependencies: Record<string, string[]> = {};
  if (catalogueSnap.empty) {
    for (const f of FEATURE_CATALOGUE) features.set(f.id, f);
    Object.assign(dependencies, FEATURE_DEPENDENCIES);
  } else {
    for (const doc of catalogueSnap.docs) {
      const { dependsOn, createdAt, updatedAt, ...def } = doc.data();
      features.set(doc.id, { ...(def as FeatureDefinition), id: doc.id });
      if (Array.isArray(dependsOn) && dependsOn.length) dependencies[doc.id] = dependsOn;
    }
  }

  const plans = new Map<string, Plan>();
  for (const doc of plansSnap.docs) plans.set(doc.id, planFromDoc(doc.id, doc.data()));

  const policy = policySnap.exists
    ? ({ ...INITIAL_GLOBAL_POLICY, ...policySnap.data(), updatedAt: toIso(policySnap.get('updatedAt')) || undefined } as GlobalPlatformPolicy)
    : { ...INITIAL_GLOBAL_POLICY };

  return { features, dependencies, globalPolicy: policy, plans };
}

export async function loadSubscription(customerType: CustomerType, customerId: string, tx: Getter = null): Promise<Subscription | null> {
  const snap = await get(tx, db().collection('subscriptions').doc(`${customerType}_${customerId}`));
  return snap.exists ? subscriptionFromDoc(snap.data()!) : null;
}

export async function loadOverridesFor(subject: Pick<CommercialSubject, 'companyId' | 'userIds'>, tx: Getter = null): Promise<EntitlementOverride[]> {
  const col = db().collection('entitlementOverrides');
  const queries: FirebaseFirestore.Query[] = [];
  if (subject.companyId) queries.push(col.where('targetType', '==', 'company').where('targetId', '==', subject.companyId));
  if (subject.userIds.length) queries.push(col.where('targetType', '==', 'individual').where('targetId', 'in', subject.userIds.slice(0, 10)));
  const snaps = await Promise.all(queries.map((q) => getQuery(tx, q)));
  return snaps.flatMap((s) => s.docs.map((d) => overrideFromDoc(d.id, d.data())));
}

// ---------------------------------------------------------------------------
// Usage counters
// ---------------------------------------------------------------------------
export { METERED_UNITS, usageCounterId };
export type { UsageTarget };
export const periodKeyFor = periodKeyForUnit;

export function usageTargetFor(feature: FeatureDefinition | undefined, subject: Pick<CommercialSubject, 'companyId' | 'primaryUserId'>): UsageTarget {
  if (feature?.category !== 'individual' && subject.companyId) return { targetType: 'company', targetId: subject.companyId };
  return { targetType: 'individual', targetId: subject.primaryUserId };
}

export async function loadUsage(
  cp: ControlPlane,
  subject: Pick<CommercialSubject, 'companyId' | 'primaryUserId'>,
  nowMs: number,
  tx: Getter = null
): Promise<UsageLookup> {
  const ids = new Map<string, string>();
  for (const f of cp.features.values()) {
    if (!f.limitUnit) continue;
    ids.set(f.id, usageCounterId(usageTargetFor(f, subject), f.id, periodKeyFor(f.limitUnit, nowMs)));
  }
  const refs = [...ids.values()].map((id) => db().collection('usageCounters').doc(id));
  const snaps = refs.length ? await (tx ? tx.getAll(...refs) : db().getAll(...refs)) : [];
  const values = new Map<string, number>();
  for (const s of snaps) if (s.exists) values.set(s.id, Number(s.get('currentValue')) || 0);
  return (featureId) => values.get(ids.get(featureId) || '') ?? 0;
}

export function entitlementSubjectOf(
  subject: Pick<CommercialSubject, 'userIds' | 'companyId' | 'accountSuspended'>,
  planId: string
): EntitlementSubject {
  return { userIds: subject.userIds, companyId: subject.companyId, planId, accountSuspended: subject.accountSuspended };
}
