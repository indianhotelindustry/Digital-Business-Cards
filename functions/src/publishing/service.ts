// ============================================================================
// Publishing authority (Directive 25 Phase 8)
// ============================================================================
// Replaces the localStorage publishing registry (dsbc_publishing_records_v1)
// and the "?preview=true" bypass. Authoritative records:
//   publishingRecords/{entityId}  DRAFT / PUBLISHED / UNPUBLISHED / SUSPENDED
//   slugs/{slug}                  global slug ownership (takeover protection)
// Owners publish/unpublish their own entities when their entitlement allows;
// only the App Owner can SUSPEND or lift a suspension. A suspension is also
// mirrored onto the entity as platformSuspended=true, which firestore.rules
// use to hide it from the public and which no customer can clear. Likewise
// DRAFT / UNPUBLISHED is mirrored as publicationHidden=true.

import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { deny, fail, invalid } from '../shared/errors';
import { nowMs, serverNow } from '../shared/time';
import { ID_PATTERN, obj, oneOf, reason, str } from '../shared/validate';
import { actorOf, requireActiveProfile, requireAppOwner, resolveCommercialSubject, type Caller } from '../auth/identity';
import { appendAudit } from '../audit/ledger';
import { buildResolutionContext } from '../entitlements/resolution';
import { validateSlugFormat } from '../../../shared/domain/slugRules';

type EntityType = 'card' | 'company' | 'profile';
const ENTITY_COLLECTION: Record<EntityType, string> = { card: 'cards', company: 'companies', profile: 'digitalIdentityProfiles' };
const REQUIRED_FEATURE: Record<EntityType, string> = { card: 'individual.business_card', company: 'company.mini_website', profile: 'individual.full_profile' };
/** Format + reserved routes (shared with the browser); null when acceptable. */
export function slugProblem(slug: string): string | null {
  const res = validateSlugFormat(slug);
  if (!res.isValid) return res.errorMessage || 'Invalid slug.';
  return res.sanitizedSlug === slug ? null : 'slug must already be in canonical form (lowercase letters, digits, single hyphens).';
}

interface EntityInfo {
  ref: FirebaseFirestore.DocumentReference;
  companyId: string;
  employeeId: string | null;
}

async function loadEntity(entityType: EntityType, entityId: string, tx?: Transaction): Promise<EntityInfo> {
  const ref = db().collection(ENTITY_COLLECTION[entityType]).doc(entityId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) fail('not-found', `${entityType} ${entityId} not found.`);
  const companyId = entityType === 'company' ? entityId : (snap.get('companyId') as string);
  const employeeId = entityType === 'card' ? (snap.get('employeeId') as string) : entityType === 'profile' ? entityId : null;
  return { ref, companyId, employeeId };
}

export async function setPublishingState(caller: Caller, data: unknown) {
  const p = obj(data, ['entityType', 'entityId', 'state', 'slug']);
  const entityType = oneOf(p, 'entityType', ['card', 'company', 'profile'] as const);
  const entityId = str(p, 'entityId', { pattern: ID_PATTERN });
  const state = oneOf(p, 'state', ['DRAFT', 'PUBLISHED', 'UNPUBLISHED'] as const);
  const slug = str(p, 'slug', { optional: true, max: 63 }).toLowerCase();
  if (slug) {
    const problem = slugProblem(slug);
    if (problem) invalid(problem);
  }
  const profile = requireActiveProfile(caller);

  const entity = await loadEntity(entityType, entityId);
  const isAdmin = profile.role === 'company_admin' && profile.companyId === entity.companyId;
  const isSelf = !!entity.employeeId && profile.employeeId === entity.employeeId && profile.companyId === entity.companyId;
  if (!isAdmin && !(entityType !== 'company' && isSelf)) deny('You may only publish entities you own.');

  const subject = await resolveCommercialSubject(caller);
  const recordRef = db().collection('publishingRecords').doc(entityId);

  return db().runTransaction(async (tx) => {
    const [record, company, ent] = await Promise.all([
      tx.get(recordRef),
      tx.get(db().collection('companies').doc(entity.companyId)),
      tx.get(entity.ref),
    ]);
    if (record.get('publishingState') === 'SUSPENDED' || ent.get('platformSuspended') === true) {
      deny('This entity is suspended by the platform.');
    }
    if (company.get('status') !== 'active') deny('Company is not active.');
    if (entityType === 'card' && entity.employeeId) {
      const emp = await tx.get(db().collection('employees').doc(entity.employeeId));
      if (emp.get('seatState') === 'locked' && state === 'PUBLISHED') fail('resource-exhausted', 'Employee seat is locked by the plan limit.');
    }
    const finalSlug = slug || (record.get('slug') as string) || (ent.get('publicSlug') as string) || (ent.get('slug') as string) || '';
    let slugSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (state === 'PUBLISHED') {
      if (!finalSlug || slugProblem(finalSlug)) invalid('A valid slug is required to publish.');
      const eff = (await buildResolutionContext(subject, nowMs(), tx)).resolve(REQUIRED_FEATURE[entityType]);
      if (!eff.isGranted) fail('permission-denied', `ENTITLEMENT_REQUIRED: ${REQUIRED_FEATURE[entityType]}`);
      slugSnap = await tx.get(db().collection('slugs').doc(finalSlug));
      if (slugSnap.exists && slugSnap.get('entityId') !== entityId) fail('already-exists', `Slug ${finalSlug} is taken.`);
    }

    // ---- writes ----
    if (state === 'PUBLISHED' && slugSnap && !slugSnap.exists) {
      tx.create(slugSnap.ref, { slug: finalSlug, entityId, entityType, tenantId: entity.companyId, createdAt: serverNow() });
    }
    const prevSlug = record.get('slug') as string | undefined;
    if (state === 'PUBLISHED' && prevSlug && prevSlug !== finalSlug) {
      tx.delete(db().collection('slugs').doc(prevSlug));
    }
    tx.set(recordRef, {
      id: entityId, entityType, slug: finalSlug, ownerId: entity.employeeId || entity.companyId, tenantId: entity.companyId,
      publishingState: state, activationState: state === 'PUBLISHED' ? 'PUBLISHED' : 'READY_TO_PUBLISH',
      publishedAt: state === 'PUBLISHED' ? serverNow() : record.get('publishedAt') ?? null,
      unpublishedAt: state === 'UNPUBLISHED' ? serverNow() : null,
      suspendedAt: null, suspensionReason: null, updatedAt: serverNow(), updatedBy: caller.uid,
      createdAt: record.get('createdAt') ?? serverNow(),
    });
    // Mirror onto the entity so firestore.rules hide DRAFT/UNPUBLISHED content
    // from the public (clients cannot write this field).
    tx.update(entity.ref, { publicationHidden: state === 'PUBLISHED' ? FieldValue.delete() : true });
    appendAudit(tx, 'platformAuditLogs', {
      action: `PUBLISHING_${state}`, actor: actorOf(caller), targetType: entityType, targetId: entityId, tenantId: entity.companyId,
      previousValue: record.get('publishingState') ?? 'NONE', newValue: { state, slug: finalSlug }, reason: 'Owner publishing action', source: 'Publishing',
    });
    return { entityId, publishingState: state, slug: finalSlug };
  });
}

export async function adminSetPublishingSuspension(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data, ['entityType', 'entityId', 'suspended', 'reason']);
  const entityType = oneOf(p, 'entityType', ['card', 'company', 'profile'] as const);
  const entityId = str(p, 'entityId', { pattern: ID_PATTERN });
  const suspended = p.suspended === true;
  if (typeof p.suspended !== 'boolean') invalid('suspended must be a boolean.');
  const why = reason(p);
  const entity = await loadEntity(entityType, entityId);
  const recordRef = db().collection('publishingRecords').doc(entityId);
  return db().runTransaction(async (tx) => {
    const record = await tx.get(recordRef);
    const prevState = (record.get('publishingState') as string) || 'DRAFT';
    const nextState = suspended ? 'SUSPENDED' : (record.get('stateBeforeSuspension') as string) || 'UNPUBLISHED';
    tx.set(recordRef, {
      id: entityId, entityType, tenantId: entity.companyId, slug: record.get('slug') ?? '',
      ownerId: entity.employeeId || entity.companyId,
      publishingState: nextState, activationState: suspended ? 'SUSPENDED' : 'READY_TO_PUBLISH',
      stateBeforeSuspension: suspended ? prevState : null,
      suspendedAt: suspended ? serverNow() : null, suspensionReason: suspended ? why : null,
      updatedAt: serverNow(), updatedBy: caller.uid, createdAt: record.get('createdAt') ?? serverNow(),
    }, { merge: true });
    tx.update(entity.ref, { platformSuspended: suspended ? true : FieldValue.delete() });
    appendAudit(tx, 'platformAuditLogs', {
      action: suspended ? 'PUBLISHING_SUSPENDED' : 'PUBLISHING_SUSPENSION_LIFTED', actor: actorOf(caller), targetType: entityType,
      targetId: entityId, tenantId: entity.companyId, previousValue: prevState, newValue: nextState, reason: why, source: 'App Owner Safety',
    });
    return { entityId, publishingState: nextState };
  });
}
