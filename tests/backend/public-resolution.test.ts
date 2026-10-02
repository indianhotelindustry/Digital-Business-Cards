// Directive 26 Phase 7 — public resolution security regression.
// PUBLIC-001 … PUBLIC-015 (anonymous = no ID token at all).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  eventually,
  ok,
  outcome,
  seedWorld,
  Timestamp,
  type BrowserSession,
  type World,
} from './support/backendEnv';

let w: World;
const sessions: BrowserSession[] = [];
async function browser(user: World[keyof World] | null) {
  const s = await browserSession(user);
  sessions.push(s);
  return s.db;
}
const resolve = (route: 'card' | 'profile' | 'company', slug: string, user: World[keyof World] | null = null, preview?: boolean) =>
  ok('resolvePublicEntity', { route, slug, ...(preview !== undefined ? { preview } : {}) }, user);
const publish = (user: World[keyof World], entityType: 'card' | 'company', entityId: string, slug?: string, state = 'PUBLISHED') =>
  ok('setPublishingState', { entityType, entityId, state, ...(slug ? { slug } : {}) }, user);

/** Every key at any depth of a JSON value. */
function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  return out;
}
const FORBIDDEN_KEYS = [
  'planId', 'subscription', 'subscriptionId', 'paymentStatus', 'invoice', 'invoices', 'entitlement', 'entitlements', 'overrides',
  'usage', 'used', 'limit', 'ownerUid', 'kind', 'seatState', 'seatLockedAt', 'platformSuspended', 'publicationHidden', 'contentHash',
  'tenantId', 'createdBy', 'updatedBy', 'price', 'billingInterval', 'accountStatus', 'isPilot',
];

beforeAll(async () => {
  w = await seedWorld();
  // Commercial records that must never leak through the public resolver.
  await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', reason: 'Pilot' }, w.owner);
  await ok('adminSetCustomerClassification', { customerType: 'company', customerId: 'co_a', isPilot: true, reason: 'Pilot' }, w.owner);
  await adminDb.doc('companies/co_a').update({ description: 'Company A builds things', services: [{ id: 's1', title: 'Consulting', description: 'Advice' }] });
  await adminDb.doc('digitalIdentityProfiles/emp_a1').set({
    id: 'emp_a1', employeeId: 'emp_a1', companyId: 'co_a', headline: 'Lead engineer', about: 'Public about', experiences: [{ id: 'x', role: 'Secret job' }],
    sectionConfigs: [
      { id: 'about', type: 'ABOUT', enabled: true, order: 1, visibility: 'PUBLIC' },
      { id: 'exp', type: 'EXPERIENCE', enabled: true, order: 2, visibility: 'PRIVATE' },
      { id: 'contact', type: 'CONTACT', enabled: true, order: 3, visibility: 'PUBLIC' },
    ],
    updatedAt: new Date().toISOString(),
  });
  await adminDb.doc('employees/emp_a1').update({ email: 'a1@company-a.test', phone: '+91 90000 00001', designation: 'Engineer' });
  await publish(w.adminA, 'company', 'co_a', 'company-a');
  await publish(w.employeeA, 'card', 'card_a1', 'employee-a1');
  await publish(w.adminB, 'company', 'co_b', 'company-b');
  await publish(w.adminB, 'card', 'card_b1', 'employee-b1');
});
afterAll(async () => {
  await Promise.all(sessions.map((s) => s.close()));
});

describe('PUBLIC-001 anonymous published company lookup succeeds', () => {
  it('returns the real company website projection', async () => {
    const r = await resolve('company', 'company-a');
    expect(r.outcome).toBe('OK');
    expect(r.data.company).toMatchObject({ id: 'co_a', name: 'Company co_a', description: 'Company A builds things', slug: 'company-a' });
    expect(r.data.company.services).toEqual([{ id: 's1', title: 'Consulting', description: 'Advice' }]);
    expect(r.preview).toBeUndefined();
  });
});

describe('PUBLIC-002 anonymous unpublished company lookup fails', () => {
  it('an unpublished website is NOT_PUBLISHED and the company document is not publicly readable', async () => {
    await publish(w.adminB, 'company', 'co_b', undefined, 'UNPUBLISHED');
    expect((await resolve('company', 'company-b')).outcome).toBe('NOT_PUBLISHED');
    expect(await outcome(getDoc(doc(await browser(null), 'companies', 'co_b')))).toBe('permission-denied');
    await publish(w.adminB, 'company', 'co_b');
    expect((await resolve('company', 'company-b')).outcome).toBe('OK');
  });
});

describe('PUBLIC-003 anonymous suspended company lookup fails', () => {
  it('a platform-suspended website is UNAVAILABLE until the App Owner lifts it', async () => {
    await ok('adminSetPublishingSuspension', { entityType: 'company', entityId: 'co_b', suspended: true, reason: 'Review' }, w.owner);
    expect((await resolve('company', 'company-b')).outcome).toBe('UNAVAILABLE');
    expect((await resolve('company', 'company-b', w.adminB, true)).outcome).toBe('UNAVAILABLE'); // not even as preview
    await ok('adminSetPublishingSuspension', { entityType: 'company', entityId: 'co_b', suspended: false, reason: 'Cleared' }, w.owner);
    expect((await resolve('company', 'company-b')).outcome).toBe('OK');
  });
});

describe('PUBLIC-004 anonymous published employee card succeeds', () => {
  it('returns employee, card and the company website link', async () => {
    const r = await resolve('card', 'employee-a1');
    expect(r.outcome).toBe('OK');
    expect(r.data.employee).toMatchObject({ id: 'emp_a1', companyId: 'co_a', displayName: 'Employee A1', email: 'a1@company-a.test' });
    expect(r.data.card).toMatchObject({ id: 'card_a1', companyId: 'co_a', employeeId: 'emp_a1', publicSlug: 'employee-a1' });
    expect(r.data.company).toMatchObject({ id: 'co_a', slug: 'company-a' });
  });

  it('the full profile honours section privacy', async () => {
    const r = await resolve('profile', 'employee-a1');
    expect(r.outcome).toBe('OK');
    expect(r.data.profile.about).toBe('Public about');
    expect(r.data.profile.experiences).toBeUndefined(); // EXPERIENCE is PRIVATE
    expect(r.data.profile.sectionConfigs.map((s: { type: string }) => s.type)).toEqual(['ABOUT', 'CONTACT']);
  });
});

describe('PUBLIC-005 anonymous draft employee card fails', () => {
  it('a card moved back to DRAFT is NOT_PUBLISHED and unreadable directly', async () => {
    await publish(w.adminB, 'card', 'card_b1', undefined, 'DRAFT');
    expect((await resolve('card', 'employee-b1')).outcome).toBe('NOT_PUBLISHED');
    expect((await resolve('profile', 'employee-b1')).outcome).toBe('NOT_PUBLISHED');
    expect(await outcome(getDoc(doc(await browser(null), 'cards', 'card_b1')))).toBe('permission-denied');
  });

  it('a card that was never published has no public slug at all', async () => {
    await adminDb.doc('cards/card_a2').set({ id: 'card_a2', companyId: 'co_a', employeeId: 'emp_a1', templateId: 'classic', publicSlug: 'never-published', status: 'active' });
    expect((await resolve('card', 'never-published')).outcome).toBe('NOT_FOUND');
  });
});

describe('PUBLIC-006 ?preview=true cannot expose draft content', () => {
  it('anonymous and other-tenant previews are refused; the owning tenant may preview', async () => {
    expect((await resolve('card', 'employee-b1', null, true)).outcome).toBe('NOT_PUBLISHED');
    expect((await resolve('card', 'employee-b1', w.adminA, true)).outcome).toBe('NOT_PUBLISHED');
    expect((await resolve('card', 'employee-b1', w.individual, true)).outcome).toBe('NOT_PUBLISHED');
    const own = await resolve('card', 'employee-b1', w.adminB, true);
    expect([own.outcome, own.preview]).toEqual(['OK', true]);
    expect((await resolve('card', 'employee-b1', w.adminB)).outcome).toBe('NOT_PUBLISHED'); // without the flag: public view
    await publish(w.adminB, 'card', 'card_b1');
  });
});

describe('PUBLIC-007 unknown slug returns not-found', () => {
  it('unknown, malformed, reserved and wrong-type slugs are NOT_FOUND', async () => {
    for (const [route, slug] of [['company', 'no-such-company'], ['card', 'no-such-card'], ['card', 'Bad Slug!'], ['company', 'admin'], ['card', 'company-a'], ['company', 'employee-a1']] as const) {
      expect((await resolve(route, slug)).outcome).toBe('NOT_FOUND');
    }
    expect((await call('resolvePublicEntity', { route: 'company', slug: 'company-a', tenantId: 'co_b' }, null)).status).toBe('INVALID_ARGUMENT');
  });
});

describe('PUBLIC-008 Company A cannot retrieve Company B private content', () => {
  it('a signed-in company A admin gets exactly the anonymous projection of company B', async () => {
    const anon = await resolve('company', 'company-b');
    const asA = await resolve('company', 'company-b', w.adminA);
    expect(asA).toEqual(anon);
    expect(await outcome(getDoc(doc(await browser(w.adminA), 'subscriptions', 'company_co_b')))).toBe('permission-denied');
    // Publishing metadata (tenant ids, publisher uid) is not public, even when PUBLISHED.
    expect(await outcome(getDoc(doc(await browser(w.adminA), 'publishingRecords', 'card_b1')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(await browser(null), 'publishingRecords', 'co_b')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(await browser(null), 'slugs', 'company-b')))).toBe('permission-denied');
    expect(await outcome(getDoc(doc(await browser(w.adminB), 'publishingRecords', 'card_b1')))).toBe('ALLOWED');
  });
});

describe('PUBLIC-009 a real customer URL never falls back to demo data', () => {
  it('demo slugs do not resolve on the backend', async () => {
    for (const slug of ['acme-innovations', 'nexus-global', 'rahul-sharma', 'priya-patel']) {
      expect((await resolve(slug.includes('-innovations') || slug.includes('-global') ? 'company' : 'card', slug)).outcome).toBe('NOT_FOUND');
    }
  });

  it('public pages resolve only through the backend resolver (no demo store, no direct slug queries)', () => {
    for (const page of ['PublicCardPage', 'PublicCompanyPage', 'PublicProfilePage']) {
      const src = readFileSync(`src/components/public/${page}.tsx`, 'utf8');
      expect(src).toContain('publicResolver');
      expect(src).not.toMatch(/demoStore|getCardBySlug|getCompanyBySlug|getEmployeesByCompany|getCardsByCompany/);
    }
    const resolverClient = readFileSync('src/services/publicResolver.ts', 'utf8');
    expect(resolverClient).not.toMatch(/demoStore/);
  });
});

describe('PUBLIC-010 the public resolver cannot expose billing / subscription / entitlement data', () => {
  it('no response contains commercial, ownership or enforcement fields', async () => {
    const responses = [
      await resolve('company', 'company-a'),
      await resolve('card', 'employee-a1'),
      await resolve('profile', 'employee-a1'),
      await resolve('company', 'company-a', w.adminA, true),
    ];
    for (const r of responses) {
      const keys = keysDeep(r);
      expect(FORBIDDEN_KEYS.filter((k) => keys.has(k))).toEqual([]);
      expect(JSON.stringify(r)).not.toMatch(/company_pro|COMPLIMENTARY|PAID|INV-\d/);
    }
  });
});

describe('PUBLIC-011 an employee remains attached to the correct tenant', () => {
  it('browsers cannot move an employee or create a card for another tenant\'s employee', async () => {
    const db = await browser(w.adminA);
    expect(await outcome(updateDoc(doc(db, 'employees', 'emp_a1'), { companyId: 'co_b' }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'cards', 'card_steal'), { id: 'card_steal', companyId: 'co_a', employeeId: 'emp_b1', templateId: 'classic', publicSlug: 'steal', status: 'active' }))).toBe('permission-denied');
  });

  it('even a fabricated cross-tenant card record never resolves', async () => {
    await adminDb.doc('cards/card_x').set({ id: 'card_x', companyId: 'co_a', employeeId: 'emp_b1', templateId: 'classic', publicSlug: 'cross-card', status: 'active' });
    await adminDb.doc('slugs/cross-card').set({ slug: 'cross-card', entityId: 'card_x', entityType: 'card', tenantId: 'co_a', createdAt: Timestamp.now() });
    await adminDb.doc('publishingRecords/card_x').set({ id: 'card_x', entityType: 'card', slug: 'cross-card', tenantId: 'co_a', publishingState: 'PUBLISHED' });
    expect((await resolve('card', 'cross-card')).outcome).toBe('NOT_FOUND');
    // A slug whose recorded tenant disagrees with the entity is also refused.
    await adminDb.doc('slugs/cross-card').update({ tenantId: 'co_b' });
    expect((await resolve('card', 'cross-card')).outcome).toBe('NOT_FOUND');
  });

  it('the resolved card, employee and company always share one tenant', async () => {
    const r = await resolve('card', 'employee-b1');
    expect(new Set([r.data.card.companyId, r.data.employee.companyId, r.data.company.id])).toEqual(new Set(['co_b']));
  });
});

describe('PUBLIC-012 the company directory exposes only published employees', () => {
  it('drafts, missing cards and locked seats are excluded', async () => {
    const batch = adminDb.batch();
    for (const id of ['emp_a2', 'emp_a3']) {
      batch.set(adminDb.doc(`employees/${id}`), { id, companyId: 'co_a', displayName: id, status: 'active', createdAt: '2026-05-01T00:00:00.000Z' });
      batch.set(adminDb.doc(`cards/card_${id}`), { id: `card_${id}`, companyId: 'co_a', employeeId: id, templateId: 'classic', publicSlug: id.replace('_', '-'), status: 'active' });
    }
    batch.set(adminDb.doc('employees/emp_a4'), { id: 'emp_a4', companyId: 'co_a', displayName: 'No card', status: 'active', createdAt: '2026-05-02T00:00:00.000Z' });
    await batch.commit();
    await publish(w.adminA, 'card', 'card_emp_a2', 'emp-a2'); // published
    await publish(w.adminA, 'card', 'card_emp_a3', 'emp-a3');
    await publish(w.adminA, 'card', 'card_emp_a3', undefined, 'UNPUBLISHED'); // unpublished again
    await adminDb.doc('employees/emp_a5').set({ id: 'emp_a5', companyId: 'co_a', displayName: 'Fifth', status: 'active', createdAt: '2026-06-01T00:00:00.000Z' });
    await adminDb.doc('cards/card_emp_a5').set({ id: 'card_emp_a5', companyId: 'co_a', employeeId: 'emp_a5', templateId: 'classic', publicSlug: 'emp-a5', status: 'active' });
    await publish(w.adminA, 'card', 'card_emp_a5', 'emp-a5');
    const team = (await resolve('company', 'company-a')).data.employees.map((e: { id: string }) => e.id).sort();
    expect(team).toEqual(['emp_a1', 'emp_a2', 'emp_a5']);

    // Downgrade to 3 seats: the newest seats (emp_a4, emp_a5) lock — the published
    // emp_a5 leaves the directory and its card stops resolving; nothing is deleted.
    await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_free', reason: 'Downgrade' }, w.owner);
    await eventually(async () => (await adminDb.doc('employees/emp_a5').get()).get('seatState'), (v) => v === 'locked');
    expect((await resolve('company', 'company-a')).data.employees.map((e: { id: string }) => e.id).sort()).toEqual(['emp_a1', 'emp_a2']);
    expect((await resolve('card', 'emp-a5')).outcome).toBe('UNAVAILABLE');
    expect((await adminDb.doc('cards/card_emp_a5').get()).exists).toBe(true);
    await ok('adminChangeCustomerPlan', { customerType: 'company', customerId: 'co_a', planId: 'company_pro', reason: 'Upgrade' }, w.owner);
    expect((await eventually(() => resolve('card', 'emp-a5'), (r) => r.outcome === 'OK')).outcome).toBe('OK');
  });
});

describe('PUBLIC-013 a suspended tenant loses public visibility', () => {
  it('suspending the customer hides its website and cards; reinstating restores them', async () => {
    await ok('adminSetCustomerSuspension', { customerType: 'company', customerId: 'co_a', suspended: true, reason: 'Unpaid' }, w.owner);
    expect((await resolve('company', 'company-a')).outcome).toBe('UNAVAILABLE');
    expect((await resolve('card', 'employee-a1')).outcome).toBe('UNAVAILABLE');
    expect((await resolve('company', 'company-a', w.adminA, true)).outcome).toBe('UNAVAILABLE');
    expect((await resolve('company', 'company-b')).outcome).toBe('OK'); // other tenants unaffected
    await ok('adminSetCustomerSuspension', { customerType: 'company', customerId: 'co_a', suspended: false, reason: 'Paid' }, w.owner);
    expect((await resolve('company', 'company-a')).outcome).toBe('OK');
    // Suspension locked every seat (feature locked, data kept); reinstatement
    // unlocks them through the seat trigger.
    expect((await eventually(() => resolve('card', 'employee-a1'), (r) => r.outcome === 'OK')).outcome).toBe('OK');
  });
});

describe('PUBLIC-014 publication state remains server-authoritative', () => {
  it('browsers cannot write publishing records, slugs or visibility flags; the backend state is what resolves', async () => {
    const db = await browser(w.adminB);
    expect(await outcome(setDoc(doc(db, 'publishingRecords', 'card_b1'), { publishingState: 'PUBLISHED', tenantId: 'co_b', slug: 'employee-b1' }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(db, 'slugs', 'brand-new'), { entityId: 'card_b1', entityType: 'card', tenantId: 'co_b' }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(db, 'companies', 'co_b'), { publicationHidden: false }))).toBe('permission-denied');
    await publish(w.adminB, 'company', 'co_b', undefined, 'UNPUBLISHED');
    expect((await resolve('company', 'company-b')).outcome).toBe('NOT_PUBLISHED');
    await publish(w.adminB, 'company', 'co_b');
    expect((await resolve('company', 'company-b')).outcome).toBe('OK');
  });
});

describe('PUBLIC-015 cross-tenant slug takeover remains impossible', () => {
  it('company and card slugs share one namespace owned by the backend', async () => {
    for (const slug of ['company-a', 'employee-a1']) {
      expect((await call('setPublishingState', { entityType: 'card', entityId: 'card_b1', state: 'PUBLISHED', slug }, w.adminB)).status).toBe('ALREADY_EXISTS');
      expect((await call('setPublishingState', { entityType: 'company', entityId: 'co_b', state: 'PUBLISHED', slug }, w.adminB)).status).toBe('ALREADY_EXISTS');
    }
    expect((await resolve('company', 'company-a')).data.company.id).toBe('co_a');
    expect((await resolve('card', 'employee-a1')).data.employee.id).toBe('emp_a1');
  });
});
