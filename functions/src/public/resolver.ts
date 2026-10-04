// ============================================================================
// Server-authoritative public resolution (Directive 26 Phase 1, CA-31)
// ============================================================================
// Anonymous visitors resolve /card/{slug}, /profile/{slug} and
// /company/{slug} ONLY through this module. Firestore list queries cannot be
// used by the public (the rules cannot prove tenant state for a query), and
// the browser must never fall back to demo data for a real customer URL.
//
// A slug resolves only when ALL of these hold:
//   slugs/{slug}          exists, belongs to the route's entity type, not released
//   publishingRecords/{id} PUBLISHED, same slug, same tenant as the entity
//   entity                exists, status active, not publicationHidden,
//                         not platformSuspended
//   tenant                company exists, status active, not platformSuspended
//   card / profile        employee exists, belongs to the card's company,
//                         active, seat not locked, not suspended
// Responses are built from explicit allow-lists. They never contain plan,
// subscription, billing, entitlement, usage, owner or audit information.
//
// Preview: a signed-in member of the owning tenant (or the App Owner) may ask
// for preview=true and receive DRAFT / UNPUBLISHED content. For everyone else
// the flag is ignored. Suspended content is never served, preview or not.

import '../shared/runtime'; // region + environment before onCall (Directive 31)
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../shared/firebase';
import { fail } from '../shared/errors';
import { nowMs } from '../shared/time';
import { bool, obj, oneOf, str } from '../shared/validate';
import { APP_OWNER_CLAIM } from '../auth/identity';
import { buildResolutionContext } from '../entitlements/resolution';
import { companySubject } from '../usage/quota';
import { validateSlugFormat } from '../../../shared/domain/slugRules';

export type PublicRoute = 'card' | 'profile' | 'company';
export type PublicOutcome = 'OK' | 'NOT_FOUND' | 'NOT_PUBLISHED' | 'UNAVAILABLE';

type Doc = FirebaseFirestore.DocumentData;
type Snap = FirebaseFirestore.DocumentSnapshot;

// ---------------------------------------------------------------------------
// Allow-lists (anything not listed is dropped)
// ---------------------------------------------------------------------------
export const PUBLIC_COMPANY_FIELDS = [
  'id', 'name', 'legalName', 'tagline', 'logoUrl', 'heroImageUrl', 'positioningStatement', 'industry', 'foundedYear',
  'website', 'email', 'phone', 'whatsapp', 'address', 'operatingHours', 'description', 'mission', 'vision', 'coreValues',
  'services', 'products', 'metrics', 'caseStudies', 'testimonials', 'socialLinks', 'branding',
] as const;

export const PUBLIC_EMPLOYEE_FIELDS = [
  'id', 'companyId', 'departmentId', 'firstName', 'lastName', 'displayName', 'designation', 'profilePhotoUrl',
  'email', 'phone', 'whatsapp', 'bio', 'linkedin', 'website', 'instagram', 'socialLinks', 'otherSocialLinks',
] as const;

const CONTACT_FIELDS = ['email', 'phone', 'whatsapp'] as const;

export const PUBLIC_PROFILE_FIELDS = [
  'id', 'employeeId', 'companyId', 'headline', 'about', 'philosophy', 'location', 'heroImageUrl', 'metrics', 'expertise',
  'skillCategories', 'services', 'experiences', 'projects', 'education', 'credentials', 'achievements', 'testimonials',
  'socialLinks', 'sectionConfigs', 'fullProfileSections', 'companyProfileRef', 'appearance',
] as const;

/** Profile fields carried by each card section; removed unless the section is enabled and PUBLIC. */
const SECTION_FIELDS: Record<string, string[]> = {
  ABOUT: ['about', 'philosophy'],
  EXPERTISE: ['expertise', 'skillCategories'],
  EXPERIENCE: ['experiences'],
  SERVICES: ['services'],
  PORTFOLIO: ['projects'],
  CREDENTIALS: ['credentials'],
  EDUCATION: ['education'],
  ACHIEVEMENTS: ['achievements'],
  TESTIMONIALS: ['testimonials'],
  SOCIAL_PROFESSIONAL: ['socialLinks'],
};

function pick(src: Doc | undefined, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!src) return out;
  for (const f of fields) if (src[f] !== undefined && src[f] !== null) out[f] = JSON.parse(JSON.stringify(src[f]));
  return out;
}

const isActive = (s: Snap | null) => !!s?.exists && s.get('status') === 'active';
const isHidden = (s: Snap) => s.get('publicationHidden') === true || s.get('platformSuspended') === true;
const tenantVisible = (company: Snap) => company.exists && company.get('status') === 'active' && company.get('platformSuspended') !== true;
const seatOk = (emp: Snap) => emp.get('seatState') !== 'locked';

export function publicCompany(company: Snap, websiteSlug: string | null): Record<string, unknown> {
  return { ...pick(company.data(), PUBLIC_COMPANY_FIELDS), id: company.id, status: 'active', slug: websiteSlug };
}

export function publicEmployee(emp: Snap, contactPublic: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = { ...pick(emp.data(), PUBLIC_EMPLOYEE_FIELDS), id: emp.id, status: 'active' };
  if (!contactPublic) for (const f of CONTACT_FIELDS) delete out[f];
  return out;
}

/** Visible section types of a profile (enabled + PUBLIC); null = no configuration (all default sections). */
function publicSections(profile: Doc | undefined): Set<string> | null {
  const cfg = profile?.sectionConfigs;
  if (!Array.isArray(cfg) || !cfg.length) return null;
  return new Set(cfg.filter((s: Doc) => s?.enabled && s?.visibility === 'PUBLIC').map((s: Doc) => String(s.type)));
}

export function publicProfile(profile: Snap | null): Record<string, unknown> | null {
  if (!profile?.exists) return null;
  const data = profile.data()!;
  const out: Record<string, unknown> = { ...pick(data, PUBLIC_PROFILE_FIELDS), id: profile.id };
  const visible = publicSections(data);
  if (visible) {
    for (const [section, fields] of Object.entries(SECTION_FIELDS)) if (!visible.has(section)) for (const f of fields) delete out[f];
    out.sectionConfigs = (data.sectionConfigs as Doc[]).filter((s) => s?.enabled && s?.visibility === 'PUBLIC');
  }
  if (Array.isArray(out.fullProfileSections)) out.fullProfileSections = (out.fullProfileSections as Doc[]).filter((s) => s?.enabled === true);
  return out;
}

// ---------------------------------------------------------------------------
// Viewer (optional): who may preview
// ---------------------------------------------------------------------------
export interface Viewer {
  uid: string | null;
  isAppOwner: boolean;
  companyId: string | null;
}

export async function viewerOf(auth: CallableRequest['auth']): Promise<Viewer> {
  if (!auth?.uid) return { uid: null, isAppOwner: false, companyId: null };
  const token = auth.token as Record<string, unknown>;
  const isAppOwner = token[APP_OWNER_CLAIM] === 'app_owner' && token.email_verified === true;
  const user = await db().collection('users').doc(auth.uid).get();
  const active = user.exists && user.get('status') === 'active';
  return { uid: auth.uid, isAppOwner, companyId: active ? (user.get('companyId') as string) || null : null };
}

const mayPreview = (viewer: Viewer, tenantId: string) => viewer.isAppOwner || (!!viewer.companyId && viewer.companyId === tenantId);

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------
export interface Resolution {
  outcome: PublicOutcome;
  route: PublicRoute;
  slug: string;
  preview?: boolean;
  data?: Record<string, unknown>;
}

const none = (route: PublicRoute, slug: string, outcome: Exclude<PublicOutcome, 'OK'>): Resolution => ({ outcome, route, slug });

interface PublishedEntity {
  ok: boolean;
  outcome?: Exclude<PublicOutcome, 'OK'>;
  preview?: boolean;
  entity?: Snap;
  record?: Snap;
}

/** Shared checks for slug -> entity, publishing record and entity visibility. */
async function publishedEntity(route: PublicRoute, slug: string, viewer: Viewer, wantPreview: boolean): Promise<PublishedEntity> {
  const entityType = route === 'company' ? 'company' : 'card';
  const slugDoc = await db().collection('slugs').doc(slug).get();
  if (!slugDoc.exists || slugDoc.get('entityType') !== entityType || slugDoc.get('releasedAt')) return { ok: false, outcome: 'NOT_FOUND' };
  const entityId = slugDoc.get('entityId') as string;
  const [entity, record] = await Promise.all([
    db().collection(entityType === 'company' ? 'companies' : 'cards').doc(entityId).get(),
    db().collection('publishingRecords').doc(entityId).get(),
  ]);
  if (!entity.exists) return { ok: false, outcome: 'NOT_FOUND' };
  const tenantId = entityType === 'company' ? entity.id : (entity.get('companyId') as string);
  // The slug, the publishing record and the entity must agree on ownership.
  if (slugDoc.get('tenantId') !== tenantId) return { ok: false, outcome: 'NOT_FOUND' };
  if (record.exists && (record.get('tenantId') !== tenantId || record.get('slug') !== slug)) return { ok: false, outcome: 'NOT_FOUND' };

  if (entity.get('platformSuspended') === true || record.get('publishingState') === 'SUSPENDED') return { ok: false, outcome: 'UNAVAILABLE' };
  if (entity.get('status') !== 'active') return { ok: false, outcome: 'UNAVAILABLE' };
  const published = record.exists && record.get('publishingState') === 'PUBLISHED' && entity.get('publicationHidden') !== true;
  if (published) return { ok: true, entity, record };
  if (wantPreview && mayPreview(viewer, tenantId)) return { ok: true, preview: true, entity, record };
  return { ok: false, outcome: 'NOT_PUBLISHED' };
}

/** Slug of the company's website if it is publicly published (null otherwise). */
async function publishedCompanySlug(companyId: string): Promise<string | null> {
  const record = await db().collection('publishingRecords').doc(companyId).get();
  if (!record.exists || record.get('publishingState') !== 'PUBLISHED' || record.get('entityType') !== 'company') return null;
  const slug = record.get('slug') as string;
  const slugDoc = await db().collection('slugs').doc(slug).get();
  if (!slugDoc.exists || slugDoc.get('entityId') !== companyId || slugDoc.get('releasedAt')) return null;
  const company = await db().collection('companies').doc(companyId).get();
  return isHidden(company) ? null : slug;
}

/** Publicly visible card slug for an employee's card (null otherwise). */
async function publishedCardSlug(card: Snap): Promise<string | null> {
  if (!card.exists || card.get('status') !== 'active' || isHidden(card)) return null;
  const record = await db().collection('publishingRecords').doc(card.id).get();
  if (!record.exists || record.get('publishingState') !== 'PUBLISHED' || record.get('entityType') !== 'card') return null;
  const slug = record.get('slug') as string;
  const slugDoc = await db().collection('slugs').doc(slug).get();
  if (!slugDoc.exists || slugDoc.get('entityId') !== card.id || slugDoc.get('releasedAt')) return null;
  return slug;
}

async function contactIsPublic(profile: Snap | null): Promise<boolean> {
  const visible = publicSections(profile?.data());
  return !visible || visible.has('CONTACT');
}

export async function resolveCardRoute(route: 'card' | 'profile', slug: string, viewer: Viewer, wantPreview: boolean): Promise<Resolution> {
  const pe = await publishedEntity(route, slug, viewer, wantPreview);
  if (!pe.ok) return none(route, slug, pe.outcome!);
  const card = pe.entity!;
  const companyId = card.get('companyId') as string;
  const employeeId = card.get('employeeId') as string;
  const [company, employee, profile] = await Promise.all([
    db().collection('companies').doc(companyId).get(),
    db().collection('employees').doc(employeeId).get(),
    db().collection('digitalIdentityProfiles').doc(employeeId).get(),
  ]);
  if (!tenantVisible(company)) return none(route, slug, 'UNAVAILABLE');
  // Tenant ownership: the employee must belong to the card's company.
  if (!employee.exists || employee.get('companyId') !== companyId) return none(route, slug, 'NOT_FOUND');
  if (!isActive(employee) || !seatOk(employee) || employee.get('platformSuspended') === true) return none(route, slug, 'UNAVAILABLE');

  let profileOut: Record<string, unknown> | null = null;
  if (profile.exists && profile.get('companyId') === companyId) {
    if (profile.get('platformSuspended') === true) return none(route, slug, 'UNAVAILABLE');
    if (route === 'profile' && profile.get('publicationHidden') === true && !pe.preview) return none(route, slug, 'NOT_PUBLISHED');
    profileOut = publicProfile(profile);
  }
  if (route === 'profile' && !pe.preview) {
    // The full profile is a paid capability of the owning tenant.
    const subject = await companySubject(companyId);
    const eff = (await buildResolutionContext(subject!, nowMs())).resolve('individual.full_profile');
    if (!eff.isGranted) return none(route, slug, 'NOT_PUBLISHED');
  }

  const departmentId = employee.get('departmentId') as string | null;
  const department = departmentId ? await db().collection('departments').doc(departmentId).get() : null;
  const websiteSlug = await publishedCompanySlug(companyId);
  return {
    outcome: 'OK',
    route,
    slug,
    ...(pe.preview ? { preview: true } : {}),
    data: {
      card: { id: card.id, companyId, employeeId, templateId: card.get('templateId') || 'classic', publicSlug: slug, status: 'active' },
      employee: publicEmployee(employee, await contactIsPublic(profile.exists ? profile : null)),
      company: publicCompany(company, websiteSlug),
      department: department && isActive(department) && department.get('companyId') === companyId
        ? { id: department.id, companyId, name: department.get('name') || '', description: department.get('description') || '', status: 'active' }
        : null,
      profile: profileOut,
    },
  };
}

export async function resolveCompanyRoute(slug: string, viewer: Viewer, wantPreview: boolean): Promise<Resolution> {
  const pe = await publishedEntity('company', slug, viewer, wantPreview);
  if (!pe.ok) return none('company', slug, pe.outcome!);
  const company = pe.entity!;
  if (!tenantVisible(company)) return none('company', slug, 'UNAVAILABLE');

  const [employees, cards, departments] = await Promise.all([
    db().collection('employees').where('companyId', '==', company.id).get(),
    db().collection('cards').where('companyId', '==', company.id).get(),
    db().collection('departments').where('companyId', '==', company.id).get(),
  ]);
  const team: Array<Record<string, unknown>> = [];
  const teamCards: Array<Record<string, unknown>> = [];
  for (const emp of employees.docs) {
    if (!isActive(emp) || !seatOk(emp) || emp.get('platformSuspended') === true) continue;
    // An employee may have several cards; the directory links the first published one.
    let card: Snap | null = null;
    let cardSlug: string | null = null;
    for (const c of cards.docs.filter((d) => d.get('employeeId') === emp.id && d.get('companyId') === company.id)) {
      cardSlug = await publishedCardSlug(c);
      if (cardSlug) {
        card = c;
        break;
      }
    }
    if (!card || !cardSlug) continue; // the directory lists only employees whose card is published
    const profile = await db().collection('digitalIdentityProfiles').doc(emp.id).get();
    team.push({ ...publicEmployee(emp, await contactIsPublic(profile.exists ? profile : null)), cardSlug });
    teamCards.push({ id: card.id, companyId: company.id, employeeId: emp.id, templateId: card.get('templateId') || 'classic', publicSlug: cardSlug, status: 'active' });
  }
  const usedDepartments = new Set(team.map((e) => e.departmentId).filter(Boolean));
  return {
    outcome: 'OK',
    route: 'company',
    slug,
    ...(pe.preview ? { preview: true } : {}),
    data: {
      company: publicCompany(company, slug),
      employees: team,
      cards: teamCards,
      departments: departments.docs
        .filter((d) => isActive(d) && usedDepartments.has(d.id))
        .map((d) => ({ id: d.id, companyId: company.id, name: d.get('name') || '', description: d.get('description') || '', status: 'active' })),
    },
  };
}

export async function resolvePublic(data: unknown, auth: CallableRequest['auth']): Promise<Resolution> {
  const p = obj(data, ['route', 'slug', 'preview']);
  const route = oneOf(p, 'route', ['card', 'profile', 'company'] as const);
  const raw = str(p, 'slug', { max: 80 }).toLowerCase();
  const wantPreview = bool(p, 'preview', true) === true;
  if (!validateSlugFormat(raw).isValid || validateSlugFormat(raw).sanitizedSlug !== raw) return none(route, raw, 'NOT_FOUND');
  const viewer = await viewerOf(auth);
  return route === 'company' ? resolveCompanyRoute(raw, viewer, wantPreview) : resolveCardRoute(route, raw, viewer, wantPreview);
}

/** Unauthenticated callable: identity is optional and only ever widens access to the viewer's own tenant previews. */
export const resolvePublicEntity = onCall({ cors: true }, async (req: CallableRequest<unknown>) => {
  try {
    return await resolvePublic(req.data, req.auth);
  } catch (err) {
    if ((err as { code?: string }).code) throw err;
    return fail('internal', 'Public resolution failed.');
  }
});
