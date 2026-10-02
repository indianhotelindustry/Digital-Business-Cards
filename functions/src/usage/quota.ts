// ============================================================================
// Usage & quota authority (Directive 25 Phase 10)
// ============================================================================
// usageCounters/{targetType}_{targetId}__{featureId}__{period} is written only
// here (firestore.rules deny every client write), so customers cannot modify,
// reset or forge usage. Two kinds of accounting:
//
//   MEASURED (COUNT, EMPLOYEES, STORAGE_MB) — computed by the backend from the
//     stored data itself (triggers / upload path), never reported by a client.
//   METERED (REQUESTS, AI_USAGE, AI features) — consumed through consumeQuota,
//     an atomic check-and-increment transaction with an idempotency ledger, so
//     concurrent requests cannot both pass the same remaining unit (no TOCTOU).
//
// Enforcement keeps DATA != DELETED, FEATURE = LOCKED:
//   * employees beyond the seat limit get seatState 'locked' (hidden from the
//     public, not deleted) and are unlocked automatically when seats return;
//   * uploads are backend-only and reserve storage atomically before writing;
//   * metered operations are refused once the limit is reached.

import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { fail, invalid } from '../shared/errors';
import { nowMs, serverNow } from '../shared/time';
import { ID_PATTERN, num, obj, str } from '../shared/validate';
import { resolveCommercialSubject, type Caller, type CommercialSubject } from '../auth/identity';
import { fitsLimit } from '../../../shared/domain/entitlementResolver';
import type { LimitUnit } from '../../../shared/domain/entitlementTypes';
import { periodKeyFor, usageCounterId, usageTargetFor, type UsageTarget } from '../entitlements/controlPlane';
import { isMetered, usageUnitOf } from '../../../shared/domain/usageKeys';
import { buildResolutionContext } from '../entitlements/resolution';

const counters = () => db().collection('usageCounters');

function counterDoc(target: UsageTarget, tenantId: string, featureId: string, unit: LimitUnit | undefined, periodKey: string, value: number) {
  return {
    targetType: target.targetType,
    targetId: target.targetId,
    tenantId,
    featureId,
    unit: unit ?? 'COUNT',
    periodKey,
    currentValue: value,
    updatedAt: serverNow(),
  };
}

/** Commercial subject for a company as a whole (used by triggers). */
export async function companySubject(companyId: string): Promise<CommercialSubject | null> {
  const c = await db().collection('companies').doc(companyId).get();
  if (!c.exists) return null;
  return {
    uid: companyId, userIds: [], primaryUserId: companyId, companyId, role: 'company', customerType: 'company',
    customerId: companyId, tenantId: companyId, isBillingContact: false, accountSuspended: c.get('status') !== 'active',
  };
}

// ---------------------------------------------------------------------------
// METERED: consumeQuota
// ---------------------------------------------------------------------------
export async function consumeQuota(caller: Caller, data: unknown) {
  const p = obj(data, ['featureId', 'amount', 'operationId']);
  const featureId = str(p, 'featureId', { pattern: ID_PATTERN });
  const amount = p.amount === undefined ? 1 : num(p, 'amount', { min: 1, max: 1000, int: true });
  const operationId = str(p, 'operationId', { pattern: /^[A-Za-z0-9_\-]{8,128}$/ });
  const subject = await resolveCommercialSubject(caller);
  const ledgerRef = db().collection('usageLedger').doc(`${caller.uid}_${operationId}`);

  return db().runTransaction(async (tx) => {
    const prior = await tx.get(ledgerRef);
    if (prior.exists) return { ...(prior.get('result') as Record<string, unknown>), idempotentReplay: true };

    const now = nowMs();
    const ctx = await buildResolutionContext(subject, now, tx);
    const def = ctx.cp.features.get(featureId);
    if (!def) invalid(`Unknown feature ${featureId}.`);
    const eff = ctx.resolve(featureId);
    const unit = usageUnitOf(def, eff.limitUnit);
    if (!isMetered(unit)) invalid(`${featureId} is not a metered feature; its usage is measured by the backend.`);

    // The limit is checked against the counter read in THIS transaction, so
    // concurrent requests cannot both spend the last remaining unit.
    const target = usageTargetFor(def, subject);
    const periodKey = periodKeyFor(unit, now);
    const ref = counters().doc(usageCounterId(target, featureId, periodKey));
    const current = Number((await tx.get(ref)).get('currentValue')) || 0;
    const limited = eff.status === 'LIMITED' && eff.limit !== undefined;
    if (eff.status === 'DISABLED' || (limited && current + amount > eff.limit!)) {
      fail('resource-exhausted', `QUOTA_EXCEEDED: ${featureId} (${current}/${eff.limit ?? 0} ${unit}).`, { featureId, used: current, limit: eff.limit ?? 0 });
    }
    const value = current + amount;
    tx.set(ref, counterDoc(target, subject.tenantId, featureId, unit, periodKey, value));
    const result = { allowed: true, featureId, used: value, limit: eff.status === 'UNLIMITED' || eff.status === 'ENABLED' ? null : eff.limit ?? null, unit, periodKey };
    tx.create(ledgerRef, { uid: caller.uid, tenantId: subject.tenantId, featureId, amount, operationId, result, createdAt: serverNow() });
    return result;
  });
}

// ---------------------------------------------------------------------------
// MEASURED: employee seats
// ---------------------------------------------------------------------------
function createdKey(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate().toISOString();
  return '';
}

export async function enforceSeatQuota(companyId: string): Promise<{ count: number; limit: number | null; locked: string[] } | null> {
  const subject = await companySubject(companyId);
  if (!subject) return null;
  return db().runTransaction(async (tx) => {
    const now = nowMs();
    const ctx = await buildResolutionContext(subject, now, tx);
    const eff = ctx.resolve('company.team_members');
    const employees = await tx.get(db().collection('employees').where('companyId', '==', companyId));
    const ordered = employees.docs
      .filter((d) => d.get('status') !== 'deleted')
      .sort((a, b) => createdKey(a.get('createdAt')).localeCompare(createdKey(b.get('createdAt'))) || a.id.localeCompare(b.id));
    const limit = eff.status === 'UNLIMITED' || eff.status === 'ENABLED' ? null : eff.status === 'DISABLED' ? 0 : eff.limit ?? null;

    const locked: string[] = [];
    ordered.forEach((d, i) => {
      const shouldLock = limit !== null && i >= limit;
      const isLocked = d.get('seatState') === 'locked';
      if (shouldLock) locked.push(d.id);
      if (shouldLock && !isLocked) tx.update(d.ref, { seatState: 'locked', seatLockedAt: serverNow() });
      if (!shouldLock && isLocked) tx.update(d.ref, { seatState: FieldValue.delete(), seatLockedAt: FieldValue.delete() });
    });
    const target: UsageTarget = { targetType: 'company', targetId: companyId };
    tx.set(counters().doc(usageCounterId(target, 'company.team_members', 'current')), counterDoc(target, companyId, 'company.team_members', 'EMPLOYEES', 'current', ordered.length));
    return { count: ordered.length, limit, locked };
  });
}

// ---------------------------------------------------------------------------
// MEASURED: content item counts (COUNT)
// ---------------------------------------------------------------------------
export const COMPANY_COUNT_FIELDS: Record<string, string> = {
  'company.services': 'services',
  'company.products': 'products',
  'company.case_studies': 'caseStudies',
  'company.testimonials': 'testimonials',
};

export const PROFILE_COUNT_FIELDS: Record<string, string> = {
  'individual.services': 'services',
  'individual.portfolio': 'projects',
  'individual.career': 'experiences',
  'individual.certifications': 'credentials',
  'individual.testimonials': 'testimonials',
};

export async function measureCounts(
  target: UsageTarget,
  tenantId: string,
  data: FirebaseFirestore.DocumentData | undefined,
  fields: Record<string, string>
): Promise<Record<string, number>> {
  const batch = db().batch();
  const out: Record<string, number> = {};
  for (const [featureId, field] of Object.entries(fields)) {
    const v = data?.[field];
    const n = Array.isArray(v) ? v.length : 0;
    out[featureId] = n;
    batch.set(counters().doc(usageCounterId(target, featureId, 'current')), counterDoc(target, tenantId, featureId, 'COUNT', 'current', n));
  }
  await batch.commit();
  return out;
}

// ---------------------------------------------------------------------------
// MEASURED: storage (reserved atomically by the backend-only upload path)
// ---------------------------------------------------------------------------
export async function reserveStorage(
  tx: Transaction,
  subject: CommercialSubject,
  bytes: number
): Promise<() => void> {
  const now = nowMs();
  const ctx = await buildResolutionContext(subject, now, tx);
  const eff = ctx.resolve('company.storage');
  const mb = bytes / (1024 * 1024);
  if (eff.status === 'DISABLED' || !fitsLimit(eff, mb)) {
    fail('resource-exhausted', `QUOTA_EXCEEDED: storage (${(eff.used ?? 0).toFixed(2)}/${eff.limit ?? 0} MB).`);
  }
  const target = usageTargetFor(ctx.cp.features.get('company.storage'), subject);
  const ref = counters().doc(usageCounterId(target, 'company.storage', 'current'));
  const snap = await tx.get(ref);
  const value = (Number(snap.get('currentValue')) || 0) + mb;
  const totalBytes = (Number(snap.get('bytes')) || 0) + bytes;
  return () => tx.set(ref, { ...counterDoc(target, subject.tenantId, 'company.storage', 'STORAGE_MB', 'current', value), bytes: totalBytes });
}

export async function releaseStorage(subject: CommercialSubject, bytes: number): Promise<void> {
  const target = usageTargetFor({ id: 'company.storage', category: 'company' } as never, subject);
  const ref = counters().doc(usageCounterId(target, 'company.storage', 'current'));
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const totalBytes = Math.max(0, (Number(snap.get('bytes')) || 0) - bytes);
    tx.update(ref, { bytes: totalBytes, currentValue: totalBytes / (1024 * 1024), updatedAt: serverNow() });
  });
}
