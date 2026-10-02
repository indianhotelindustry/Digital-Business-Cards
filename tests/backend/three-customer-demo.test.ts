// Directive 26 — three-customer pilot at the API level (Firebase Emulator).
// Each customer is built through the same paths the product uses:
//   company admin edits its company (browser SDK, firestore.rules), uploads a
//   logo (uploadAsset), creates an employee + card (browser SDK), publishes
//   the website and the card (setPublishingState); visitors resolve them
//   anonymously (resolvePublicEntity) and send enquiries (submitPublicLead).
// Covers: company journey (Phase 3), employee journey (Phase 4), website loop
// and lead capture (Phase 5), three-tenant isolation (Phase 6), demo
// readiness (Phase 8/9).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import {
  adminDb,
  browserSession,
  call,
  createUser,
  ok,
  outcome,
  resetEmulators,
  type BrowserSession,
  type TestUser,
} from './support/backendEnv';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(128, 3)]).toString('base64');
const T = '2026-01-01T00:00:00.000Z';
const KEYS = ['A', 'B', 'C'] as const;
type Key = (typeof KEYS)[number];

interface Tenant {
  key: Key;
  companyId: string;
  admin: TestUser;
  db: Firestore;
  employeeId: string;
  cardId: string;
  websiteSlug: string;
  cardSlug: string;
}

let owner: TestUser;
const t = {} as Record<Key, Tenant>;
const sessions: BrowserSession[] = [];
const resolve = (route: 'card' | 'company' | 'profile', slug: string) => ok('resolvePublicEntity', { route, slug }, null);

async function createTenant(key: Key): Promise<Tenant> {
  const k = key.toLowerCase();
  const admin = await createUser(`u_admin_${k}`);
  const companyId = `co_${k}`;
  // Registration documents as registerAccount() writes them (Directive 24).
  await adminDb.doc(`users/${admin.uid}`).set({ id: admin.uid, uid: admin.uid, email: admin.email, displayName: `Admin ${key}`, role: 'company_admin', companyId, employeeId: null, accountType: 'company', tenantId: companyId, status: 'active', createdAt: T, updatedAt: T });
  await adminDb.doc(`tenants/${companyId}`).set({ id: companyId, kind: 'company', ownerUid: admin.uid, companyId, status: 'active', createdAt: T });
  await adminDb.doc(`companies/${companyId}`).set({ id: companyId, name: `Pilot ${key}`, legalName: `Pilot ${key}`, email: admin.email, branding: { primaryColor: '#0f766e' }, status: 'active', planId: 'company_free', kind: 'company', ownerUid: admin.uid, createdAt: T, updatedAt: T });
  const s = await browserSession(admin);
  sessions.push(s);
  return { key, companyId, admin, db: s.db, employeeId: `emp_${k}1`, cardId: `card_${k}1`, websiteSlug: `pilot-${k}-website`, cardSlug: `pilot-${k}-employee` };
}

beforeAll(async () => {
  await resetEmulators();
  owner = await createUser('u_owner', { claims: { platformRole: 'app_owner' } });
  await adminDb.doc('users/u_owner').set({ id: 'u_owner', role: 'app_owner', companyId: null, status: 'active', createdAt: T, updatedAt: T });
  await ok('bootstrapControlPlane', { reason: 'Pilot test bootstrap' }, owner);
  for (const key of KEYS) t[key] = await createTenant(key);
});
afterAll(async () => {
  await Promise.all(sessions.map((s) => s.close()));
});

describe('Company journey (Phase 3): setup → branding → services → products → publish → public URL', () => {
  it.each(KEYS)('customer %s builds and publishes its website without developer help', async (key) => {
    const x = t[key];
    // Company setup / content (company admin, firestore.rules enforced)
    await updateDoc(doc(x.db, 'companies', x.companyId), {
      tagline: `Pilot ${key} tagline`,
      description: `About Pilot ${key}`,
      phone: `+91 9000000${KEYS.indexOf(key)}`,
      services: [{ id: `s_${key}`, title: `Service ${key}`, description: `What ${key} does` }],
      products: [{ id: `p_${key}`, title: `Product ${key}`, description: `What ${key} sells` }],
      updatedAt: new Date().toISOString(),
    });
    // Branding: logo through the backend-only upload path (quota checked)
    const upload = await ok<{ downloadUrl: string }>('uploadAsset', { kind: 'company_logo', dataBase64: PNG, fileName: `logo-${key}.png` }, x.admin);
    await updateDoc(doc(x.db, 'companies', x.companyId), { logoUrl: upload.downloadUrl, branding: { primaryColor: '#123456' } });
    // Publish
    const res = await ok('setPublishingState', { entityType: 'company', entityId: x.companyId, state: 'PUBLISHED', slug: x.websiteSlug }, x.admin);
    expect(res.publishingState).toBe('PUBLISHED');
    // Public URL resolves for an anonymous visitor with the customer's own content
    const site = await resolve('company', x.websiteSlug);
    expect(site.outcome).toBe('OK');
    expect(site.data.company).toMatchObject({ id: x.companyId, name: `Pilot ${key}`, tagline: `Pilot ${key} tagline`, logoUrl: upload.downloadUrl });
    expect(site.data.company.services[0].title).toBe(`Service ${key}`);
    expect(site.data.company.products[0].title).toBe(`Product ${key}`);
  });
});

describe('Employee journey (Phase 4): add → identity → profile → card → publish → public card', () => {
  it.each(KEYS)('customer %s adds an employee and publishes the card', async (key) => {
    const x = t[key];
    // Same order as employeeService.createEmployee: employee first, then card.
    await setDoc(doc(x.db, 'employees', x.employeeId), {
      id: x.employeeId, companyId: x.companyId, departmentId: null, firstName: 'Emp', lastName: key, displayName: `Employee ${key}1`,
      designation: 'Consultant', email: `emp-${key}@pilot.test`, phone: '+91 9100000000', status: 'active', cardId: x.cardId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(x.db, 'cards', x.cardId), { id: x.cardId, companyId: x.companyId, employeeId: x.employeeId, templateId: 'modern', publicSlug: x.cardSlug, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await setDoc(doc(x.db, 'digitalIdentityProfiles', x.employeeId), { id: x.employeeId, employeeId: x.employeeId, companyId: x.companyId, headline: `Headline ${key}`, about: `About employee ${key}`, updatedAt: new Date().toISOString() });

    expect((await resolve('card', x.cardSlug)).outcome).toBe('NOT_FOUND'); // not published yet
    await ok('setPublishingState', { entityType: 'card', entityId: x.cardId, state: 'PUBLISHED', slug: x.cardSlug }, x.admin);
    const card = await resolve('card', x.cardSlug);
    expect(card.outcome).toBe('OK');
    expect(card.data.employee).toMatchObject({ id: x.employeeId, companyId: x.companyId, displayName: `Employee ${key}1` });
    expect(card.data.company).toMatchObject({ id: x.companyId, slug: x.websiteSlug }); // card shows the right company + website link
  });

  it('a company admin cannot add, attach or publish employees of another company', async () => {
    const a = t.A;
    expect(await outcome(setDoc(doc(a.db, 'employees', 'emp_injected'), { id: 'emp_injected', companyId: 'co_b', displayName: 'X', status: 'active' }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(a.db, 'employees', t.B.employeeId), { designation: 'Hijacked' }))).toBe('permission-denied');
    expect(await outcome(updateDoc(doc(a.db, 'employees', a.employeeId), { companyId: 'co_b' }))).toBe('permission-denied');
    expect(await outcome(setDoc(doc(a.db, 'cards', 'card_hijack'), { id: 'card_hijack', companyId: 'co_a', employeeId: t.B.employeeId, templateId: 'classic', publicSlug: 'hijack', status: 'active' }))).toBe('permission-denied');
    expect((await call('setPublishingState', { entityType: 'card', entityId: t.B.cardId, state: 'UNPUBLISHED' }, a.admin)).status).toBe('PERMISSION_DENIED');
  });
});

describe('Company website experience (Phase 5)', () => {
  it.each(KEYS)('website %s → team directory → employee card → website loop works anonymously', async (key) => {
    const x = t[key];
    const site = await resolve('company', x.websiteSlug);
    const member = site.data.employees.find((e: { id: string }) => e.id === x.employeeId);
    expect(member.cardSlug).toBe(x.cardSlug);
    const card = await resolve('card', member.cardSlug);
    expect(card.data.company.slug).toBe(x.websiteSlug);
    expect((await resolve('company', card.data.company.slug)).data.company.id).toBe(x.companyId);
    // The full profile of the same card resolves too (enabled on Company Free).
    const profile = await resolve('profile', x.cardSlug);
    expect(profile.outcome).toBe('OK');
    expect(profile.data.profile.headline).toBe(`Headline ${key}`);
  });

  it('an anonymous enquiry lands only in the right company CRM', async () => {
    expect((await call('submitPublicLead', { companySlug: t.A.websiteSlug, name: 'Visitor One', email: 'visitor@example.org', interest: 'Service A', message: 'Please call me' }, null)).ok).toBe(true);
    const leadsA = await getDocs(query(collection(t.A.db, 'leads'), where('companyId', '==', 'co_a')));
    expect(leadsA.docs.map((d) => d.get('name'))).toEqual(['Visitor One']);
    expect(leadsA.docs[0].get('sourceReference')).toBe(`Company Website (/company/${t.A.websiteSlug})`);
    expect(await outcome(getDocs(query(collection(t.B.db, 'leads'), where('companyId', '==', 'co_a'))))).toBe('permission-denied');
  });

  it('enquiries are refused for unknown or unpublished websites, bots and floods', async () => {
    expect((await call('submitPublicLead', { companySlug: 'no-such-site', name: 'X', email: 'x@example.org', message: 'm' }, null)).status).toBe('NOT_FOUND');
    expect((await call('submitPublicLead', { companySlug: t.A.websiteSlug, name: 'Bot', email: 'bot@example.org', message: 'm', website: 'http://spam' }, null)).status).toBe('INVALID_ARGUMENT');
    expect((await call('submitPublicLead', { companySlug: t.A.websiteSlug, name: 'X', email: 'not-an-email', message: 'm' }, null)).status).toBe('INVALID_ARGUMENT');
    expect((await call('submitPublicLead', { companySlug: t.A.websiteSlug, companyId: 'co_b', name: 'X', email: 'x@example.org', message: 'm' }, null)).status).toBe('INVALID_ARGUMENT');
    const hour = new Date().toISOString().slice(0, 13);
    await adminDb.doc(`counters/publicLeads_co_a_${hour}`).set({ companyId: 'co_a', hour, count: 30 });
    expect((await call('submitPublicLead', { companySlug: t.A.websiteSlug, name: 'X', email: 'x@example.org', message: 'm' }, null)).status).toBe('RESOURCE_EXHAUSTED');
    await adminDb.doc(`counters/publicLeads_co_a_${hour}`).delete();
  });
});

describe('Three-tenant isolation (Phase 6)', () => {
  it.each(KEYS)('customer %s reads its own private data', async (key) => {
    const x = t[key];
    for (const [col, id] of [['companies', x.companyId], ['employees', x.employeeId], ['cards', x.cardId], ['publishingRecords', x.cardId], ['users', x.admin.uid]] as const) {
      expect(await outcome(getDoc(doc(x.db, col, id)))).toBe('ALLOWED');
    }
  });

  const pairs = KEYS.flatMap((from) => KEYS.filter((to) => to !== from).map((to) => [from, to] as const));
  it.each(pairs)('customer %s is denied customer %s private data', async (from, to) => {
    const f = t[from];
    const v = t[to];
    // A draft record and private CRM data in the victim tenant
    await adminDb.doc(`leads/lead_private_${v.key}`).set({ id: `lead_private_${v.key}`, companyId: v.companyId, name: 'Private lead', ownerEmployeeId: v.employeeId });
    await adminDb.doc(`events/evt_${v.key}`).set({ id: `evt_${v.key}`, companyId: v.companyId, name: 'Private event', status: 'active' });
    for (const [col, id] of [
      ['users', v.admin.uid],
      ['publishingRecords', v.cardId],
      ['publishingRecords', v.companyId],
      ['leads', `lead_private_${v.key}`],
      ['events', `evt_${v.key}`],
      ['subscriptions', `company_${v.companyId}`],
      ['usageCounters', `company_${v.companyId}__company.team_members__current`],
      ['customerClassifications', `company_${v.companyId}`],
    ] as const) {
      expect(`${col}/${id}:${await outcome(getDoc(doc(f.db, col, id)))}`).toBe(`${col}/${id}:permission-denied`);
    }
    expect(await outcome(updateDoc(doc(f.db, 'companies', v.companyId), { name: 'Hijacked' }))).toBe('permission-denied');
    expect((await call('setPublishingState', { entityType: 'company', entityId: v.companyId, state: 'UNPUBLISHED' }, f.admin)).status).toBe('PERMISSION_DENIED');
  });

  it('each public website shows only its own company', async () => {
    for (const key of KEYS) {
      const site = await resolve('company', t[key].websiteSlug);
      expect(site.data.company.id).toBe(t[key].companyId);
      expect(site.data.employees.map((e: { companyId: string }) => e.companyId)).toEqual([t[key].companyId]);
      expect(JSON.stringify(site)).not.toMatch(new RegExp(KEYS.filter((o) => o !== key).map((o) => `co_${o.toLowerCase()}`).join('|')));
    }
  });
});

describe('Demo readiness (Phase 8/9)', () => {
  it('only the App Owner can read it', async () => {
    expect((await call('adminGetDemoReadiness', { pilotsOnly: false }, t.A.admin)).status).toBe('PERMISSION_DENIED');
    expect((await call('adminGetDemoReadiness', {}, null)).status).toBe('UNAUTHENTICATED');
  });

  it('marks the three pilots demo ready with every check passing', async () => {
    for (const key of KEYS) await ok('adminSetCustomerClassification', { customerType: 'company', customerId: t[key].companyId, isPilot: true, stage: 'LIVE_WEBSITE', reason: 'Pilot' }, owner);
    const r = await ok('adminGetDemoReadiness', { pilotsOnly: true }, owner);
    expect(r.summary).toEqual({ total: 3, demoReady: 3 });
    for (const c of r.customers) {
      expect(c.checks.filter((k: { ok: boolean }) => !k.ok)).toEqual([]);
      expect(c.websitePath).toBe(`#company/${t[c.companyId.slice(3).toUpperCase() as Key].websiteSlug}`);
    }
  });

  it('pinpoints what breaks a demo, and the fix goes through the existing audited controls', async () => {
    await ok('adminSetCustomerSuspension', { customerType: 'company', customerId: 'co_c', suspended: true, reason: 'Readiness test' }, owner);
    await ok('setPublishingState', { entityType: 'card', entityId: t.B.cardId, state: 'UNPUBLISHED' }, t.B.admin);
    let r = await ok('adminGetDemoReadiness', { pilotsOnly: true }, owner);
    const byId = Object.fromEntries(r.customers.map((c: { companyId: string }) => [c.companyId, c]));
    const failing = (id: string) => byId[id].checks.filter((k: { ok: boolean }) => !k.ok).map((k: { key: string }) => k.key);
    expect(byId.co_a.demoReady).toBe(true);
    expect(failing('co_b')).toEqual(['employeeCard', 'qr']);
    expect(failing('co_c')).toEqual(expect.arrayContaining(['company', 'publicUrl']));
    expect(byId.co_c.checks.find((k: { key: string }) => k.key === 'company').fix).toContain('Reinstate');
    // The readiness view itself never mutated anything.
    expect((await adminDb.doc('companies/co_c').get()).get('status')).toBe('suspended');

    await ok('adminSetCustomerSuspension', { customerType: 'company', customerId: 'co_c', suspended: false, reason: 'Readiness test done' }, owner);
    await ok('setPublishingState', { entityType: 'card', entityId: t.B.cardId, state: 'PUBLISHED' }, t.B.admin);
    await new Promise((res) => setTimeout(res, 3000)); // seat trigger unlocks after reinstatement
    r = await ok('adminGetDemoReadiness', { pilotsOnly: true }, owner);
    expect(r.summary.demoReady).toBe(3);
  });
});
