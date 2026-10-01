// Shared harness for Firestore security-rules tests (Directive 24 Phases 2-4).
//
// - Runs only against the Firebase Emulator Suite (FIRESTORE_EMULATOR_HOST must
//   be set; there is no fallback to a real project). Project ids are "demo-*",
//   which the emulator guarantees can never reach production.
// - Every identity is a real authenticated emulator context with explicit
//   token claims; "unauthenticated" is a real unauthenticated context.
// - assertFails() from @firebase/rules-unit-testing only passes on a
//   PERMISSION_DENIED error. Network/emulator errors make the test FAIL.
// - DSBC_RULES_FILE may point at another rules file (used once to run this
//   suite against the frozen baseline rules and record the vulnerabilities).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch, type Firestore, type DocumentData } from 'firebase/firestore';

export const RULES_FILE = resolve(process.env.DSBC_RULES_FILE || 'firestore.rules');

function emulatorAddress(): { host: string; port: number } {
  const raw = process.env.FIRESTORE_EMULATOR_HOST;
  if (!raw) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Rules tests must run inside the Firebase Emulator Suite ' +
        '(npm run test:rules). Refusing to run against any real Firebase project.'
    );
  }
  const idx = raw.lastIndexOf(':');
  return { host: raw.slice(0, idx), port: Number(raw.slice(idx + 1)) };
}

export async function createRulesEnv(suite: string): Promise<RulesTestEnvironment> {
  const { host, port } = emulatorAddress();
  return initializeTestEnvironment({
    projectId: `demo-dsbc-${suite}`,
    firestore: { rules: readFileSync(RULES_FILE, 'utf8'), host, port },
  });
}

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------
export interface Identity {
  label: string;
  uid: string | null;
  token?: Record<string, unknown>;
}

const verified = (email: string, extra: Record<string, unknown> = {}) => ({ email, email_verified: true, ...extra });

export const ID = {
  appOwner: { label: 'App Owner (verified claim)', uid: 'uid_owner', token: verified('platform-owner@dsbc.test', { platformRole: 'app_owner' }) },
  adminA: { label: 'Company Admin A', uid: 'uid_admin_a', token: verified('admin-a@acme.test') },
  adminB: { label: 'Company Admin B', uid: 'uid_admin_b', token: verified('admin-b@nexus.test') },
  employeeA: { label: 'Employee A', uid: 'uid_emp_a', token: verified('emp-a@acme.test') },
  employeeB: { label: 'Employee B', uid: 'uid_emp_b', token: verified('emp-b@nexus.test') },
  individualA: { label: 'Individual A', uid: 'uid_ind_a', token: verified('ind-a@dsbc.test') },
  individualB: { label: 'Individual B', uid: 'uid_ind_b', token: verified('ind-b@dsbc.test') },
  suspendedAdmin: { label: 'Admin of suspended company', uid: 'uid_admin_susp', token: verified('admin@suspended.test') },
  // Attempted App Owner impersonations
  ownerEmailImpostor: { label: 'Owner allow-list email, verified, no claim', uid: 'uid_imp_email', token: verified('theindianhotelindustry@gmail.com') },
  legacyOwnerEmailUnverified: { label: 'owner@saas-cards.io, unverified, no claim', uid: 'uid_imp_legacy', token: { email: 'owner@saas-cards.io', email_verified: false } },
  docRoleImpostor: { label: 'users doc role app_owner, no claim', uid: 'uid_imp_docrole', token: verified('docrole@dsbc.test') },
  unverifiedClaimOwner: { label: 'owner claim but email unverified', uid: 'uid_owner_unverified', token: { email: 'unverified-owner@dsbc.test', email_verified: false, platformRole: 'app_owner' } },
  freshUser: { label: 'Signed-in user with no profile yet', uid: 'uid_fresh', token: verified('fresh@dsbc.test') },
  unauthenticated: { label: 'Unauthenticated visitor', uid: null },
} satisfies Record<string, Identity>;

export function dbFor(env: RulesTestEnvironment, who: Identity): Firestore {
  const ctx = who.uid ? env.authenticatedContext(who.uid, who.token as any) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}

// ---------------------------------------------------------------------------
// Fixture world: two companies, two individuals, commercial records.
// ---------------------------------------------------------------------------
const T = '2026-10-01T00:00:00.000Z';

const user = (uid: string, role: string, companyId: string | null, employeeId: string | null, extra: DocumentData = {}) => ({
  id: uid, email: `${uid}@fixture.test`, displayName: uid, role, companyId, employeeId, status: 'active', createdAt: T, updatedAt: T, ...extra,
});
const company = (id: string, status = 'active', planId = 'company_free') => ({
  id, name: id, legalName: id, website: '', email: `${id}@fixture.test`, phone: '', address: '', description: 'fixture',
  branding: { primaryColor: '#000000' }, status, planId, createdAt: T, updatedAt: T,
});
const employee = (id: string, companyId: string, departmentId: string | null, status = 'active') => ({
  id, companyId, departmentId, firstName: id, lastName: 'X', displayName: id, designation: 'Staff', email: `${id}@fixture.test`,
  phone: '', bio: '', status, createdAt: T, updatedAt: T,
});

export type FixtureSet = Record<string, Record<string, DocumentData>>;

export function fullWorld(): FixtureSet {
  return {
    companies: {
      company_acme: company('company_acme', 'active', 'company_pro'),
      company_nexus: company('company_nexus'),
      company_suspended: company('company_suspended', 'suspended'),
    },
    tenants: {
      ind_uid_ind_a: { id: 'ind_uid_ind_a', kind: 'individual', ownerUid: 'uid_ind_a', companyId: null, status: 'active', createdAt: T },
      ind_uid_ind_b: { id: 'ind_uid_ind_b', kind: 'individual', ownerUid: 'uid_ind_b', companyId: null, status: 'active', createdAt: T },
    },
    users: {
      uid_owner: user('uid_owner', 'app_owner', null, null),
      uid_admin_a: user('uid_admin_a', 'company_admin', 'company_acme', null),
      uid_admin_b: user('uid_admin_b', 'company_admin', 'company_nexus', null),
      uid_emp_a: user('uid_emp_a', 'employee', 'company_acme', 'emp_a'),
      uid_emp_b: user('uid_emp_b', 'employee', 'company_nexus', 'emp_b'),
      uid_ind_a: user('uid_ind_a', 'employee', null, null, { accountType: 'individual', tenantId: 'ind_uid_ind_a' }),
      uid_ind_b: user('uid_ind_b', 'employee', null, null, { accountType: 'individual', tenantId: 'ind_uid_ind_b' }),
      uid_admin_susp: user('uid_admin_susp', 'company_admin', 'company_suspended', null),
      uid_imp_docrole: user('uid_imp_docrole', 'app_owner', null, null),
      uid_owner_unverified: user('uid_owner_unverified', 'app_owner', null, null),
    },
    departments: {
      dept_a: { id: 'dept_a', companyId: 'company_acme', name: 'Sales A', description: '', status: 'active', createdAt: T, updatedAt: T },
      dept_b: { id: 'dept_b', companyId: 'company_nexus', name: 'Sales B', description: '', status: 'active', createdAt: T, updatedAt: T },
    },
    employees: {
      emp_a: employee('emp_a', 'company_acme', 'dept_a'),
      emp_a2: employee('emp_a2', 'company_acme', 'dept_a'),
      emp_b: employee('emp_b', 'company_nexus', 'dept_b'),
      emp_susp: employee('emp_susp', 'company_suspended', null),
    },
    cards: {
      card_a: { id: 'card_a', companyId: 'company_acme', employeeId: 'emp_a', templateId: 'classic', publicSlug: 'emp-a', status: 'active', createdAt: T, updatedAt: T },
      card_b: { id: 'card_b', companyId: 'company_nexus', employeeId: 'emp_b', templateId: 'classic', publicSlug: 'emp-b', status: 'active', createdAt: T, updatedAt: T },
    },
    digitalIdentityProfiles: {
      emp_a: { employeeId: 'emp_a', companyId: 'company_acme', headline: 'A', updatedAt: T },
      emp_b: { employeeId: 'emp_b', companyId: 'company_nexus', headline: 'B', updatedAt: T },
    },
    cardTemplates: { classic: { id: 'classic', name: 'Classic', status: 'active' } },
    events: {
      evt_a: { id: 'evt_a', companyId: 'company_acme', name: 'Expo A', status: 'active', createdAt: T },
      evt_b: { id: 'evt_b', companyId: 'company_nexus', name: 'Expo B', status: 'active', createdAt: T },
    },
    eventMembers: {
      em_a: { id: 'em_a', companyId: 'company_acme', eventId: 'evt_a', employeeId: 'emp_a' },
      em_b: { id: 'em_b', companyId: 'company_nexus', eventId: 'evt_b', employeeId: 'emp_b' },
    },
    campaigns: {
      camp_a: { id: 'camp_a', companyId: 'company_acme', name: 'Camp A', status: 'active' },
      camp_b: { id: 'camp_b', companyId: 'company_nexus', name: 'Camp B', status: 'active' },
    },
    leads: {
      lead_a: { id: 'lead_a', companyId: 'company_acme', name: 'Lead A', status: 'new', createdAt: T },
      lead_b: { id: 'lead_b', companyId: 'company_nexus', name: 'Lead B', status: 'new', createdAt: T },
    },
    leadNotes: {
      ln_a: { id: 'ln_a', companyId: 'company_acme', leadId: 'lead_a', authorUserId: 'uid_emp_a', body: 'note' },
      ln_b: { id: 'ln_b', companyId: 'company_nexus', leadId: 'lead_b', authorUserId: 'uid_emp_b', body: 'note' },
    },
    leadEvents: {
      le_a: { id: 'le_a', companyId: 'company_acme', leadId: 'lead_a', type: 'CREATED' },
      le_b: { id: 'le_b', companyId: 'company_nexus', leadId: 'lead_b', type: 'CREATED' },
    },
    contacts: {
      contact_ind_a: { id: 'contact_ind_a', ownerUserId: 'uid_ind_a', displayName: 'Friend of A', sourceType: 'manual', createdAt: T, updatedAt: T },
      contact_ind_b: { id: 'contact_ind_b', ownerUserId: 'uid_ind_b', displayName: 'Friend of B', sourceType: 'manual', createdAt: T, updatedAt: T },
    },
    relationshipNotes: {
      note_ind_a: { id: 'note_ind_a', ownerUserId: 'uid_ind_a', body: 'private A' },
      note_ind_b: { id: 'note_ind_b', ownerUserId: 'uid_ind_b', body: 'private B' },
    },
    followUps: {
      fu_ind_a: { id: 'fu_ind_a', ownerUserId: 'uid_ind_a', title: 'Call', status: 'pending' },
      fu_ind_b: { id: 'fu_ind_b', ownerUserId: 'uid_ind_b', title: 'Call', status: 'pending' },
    },
    connections: {
      conn_ab: {
        id: 'conn_ab', connectionVersion: 'v2.0', requesterUserId: 'uid_ind_a', recipientUserId: 'uid_ind_b',
        requesterIdentityId: 'uid_ind_a', recipientIdentityId: 'uid_ind_b', requesterName: 'A', recipientCompanyId: 'company_nexus',
        status: 'accepted', initiatedBy: 'uid_ind_a', exchangeMethod: 'card_exchange', consentState: 'granted', sharedCategories: [],
        createdAt: T, updatedAt: T, lastInteractionAt: T,
      },
    },
    connectionEvents: {
      cevt_ab: { id: 'cevt_ab', connectionId: 'conn_ab', participantUserIds: ['uid_ind_a', 'uid_ind_b'], eventType: 'CONNECTION_REQUESTED', actorUserId: 'uid_ind_a', actorName: 'A', description: 'x', timestamp: T },
    },
    plans: {
      individual_free: { id: 'individual_free', price: 0 },
      individual_pro: { id: 'individual_pro', price: 100 },
      company_free: { id: 'company_free', price: 0 },
      company_pro: { id: 'company_pro', price: 500 },
    },
    globalPolicies: { platform: { id: 'platform', maintenanceMode: false } },
    entitlementOverrides: {
      ov_acme: { id: 'ov_acme', targetType: 'company', targetId: 'company_acme', featureId: 'company.analytics' },
      ov_ind_b: { id: 'ov_ind_b', targetType: 'individual', targetId: 'uid_ind_b', featureId: 'individual.analytics' },
    },
    entitlementAuditLogs: { eal_1: { id: 'eal_1', action: 'PLAN_UPDATED' } },
    subscriptions: {
      sub_acme: { subscriptionId: 'sub_acme', customerType: 'company', customerId: 'company_acme', planId: 'company_pro', status: 'ACTIVE' },
      sub_nexus: { subscriptionId: 'sub_nexus', customerType: 'company', customerId: 'company_nexus', planId: 'company_free', status: 'ACTIVE' },
      sub_ind_a: { subscriptionId: 'sub_ind_a', customerType: 'individual', customerId: 'uid_ind_a', planId: 'individual_free', status: 'ACTIVE' },
      sub_ind_b: { subscriptionId: 'sub_ind_b', customerType: 'individual', customerId: 'uid_ind_b', planId: 'individual_pro', status: 'ACTIVE' },
    },
    invoices: {
      inv_acme: { invoiceId: 'inv_acme', customerType: 'company', customerId: 'company_acme', amount: 500 },
      inv_nexus: { invoiceId: 'inv_nexus', customerType: 'company', customerId: 'company_nexus', amount: 0 },
    },
    commercialAuditLogs: { cal_1: { id: 'cal_1', action: 'PLAN_CHANGED' } },
    securityAuditLogs: { sal_1: { id: 'sal_1', action: 'APP_OWNER_GRANTED' } },
  };
}

/** Clear the emulator project and load the given fixtures with rules disabled. */
export async function loadFixtures(env: RulesTestEnvironment, fixtures: FixtureSet): Promise<void> {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore() as unknown as Firestore;
    for (const [collectionName, docs] of Object.entries(fixtures)) {
      for (const [id, data] of Object.entries(docs)) {
        await setDoc(doc(fs, collectionName, id), data);
      }
    }
  });
}

/** Write several documents atomically (mirrors a client writeBatch). */
export function commitBatch(fs: Firestore, writes: Array<{ path: [string, string]; data: DocumentData }>): Promise<void> {
  const batch = writeBatch(fs);
  for (const w of writes) batch.set(doc(fs, w.path[0], w.path[1]), w.data);
  return batch.commit();
}
