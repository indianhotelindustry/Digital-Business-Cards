// Directive 24 Phase 4 — real multi-tenant authorization.
// Every attack is executed as a real authenticated identity against another
// tenant's real document. Positive controls prove the same identities CAN do
// their legitimate work, so a denial is never an artefact of broken setup.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { createRulesEnv, dbFor, fullWorld, ID, loadFixtures, type Identity } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-01T00:00:00.000Z';

beforeAll(async () => {
  env = await createRulesEnv('phase4');
});
afterAll(async () => env?.cleanup());
beforeEach(async () => loadFixtures(env, fullWorld()));

type Op = (fs: Firestore) => Promise<unknown>;
const read = (c: string, id: string): Op => (fs) => getDoc(doc(fs, c, id));
const update = (c: string, id: string, data: Record<string, unknown>): Op => (fs) => updateDoc(doc(fs, c, id), data);
const create = (c: string, id: string, data: Record<string, unknown>): Op => (fs) => setDoc(doc(fs, c, id), data);
const remove = (c: string, id: string): Op => (fs) => deleteDoc(doc(fs, c, id));

function denied(who: Identity, ops: Record<string, Op>) {
  for (const [name, op] of Object.entries(ops)) {
    it(`DENIED: ${name}`, async () => {
      await assertFails(op(dbFor(env, who)));
    });
  }
}
function allowed(who: Identity, ops: Record<string, Op>) {
  for (const [name, op] of Object.entries(ops)) {
    it(`ALLOWED (control): ${name}`, async () => {
      await assertSucceeds(op(dbFor(env, who)));
    });
  }
}

// Privileged App Owner configuration / commercial authority.
const appOwnerConfigWrites = (selfUid: string, selfCompany: string | null): Record<string, Op> => ({
  'write plans (pricing)': update('plans', 'individual_pro', { price: 0 }),
  'create a plan': create('plans', 'free_forever', { id: 'free_forever', price: 0 }),
  'write global policy': update('globalPolicies', 'platform', { maintenanceMode: true }),
  'grant self an entitlement override': create('entitlementOverrides', 'ov_self', { id: 'ov_self', targetType: selfCompany ? 'company' : 'individual', targetId: selfCompany || selfUid, featureId: 'individual.analytics' }),
  'edit an existing entitlement override': update('entitlementOverrides', 'ov_acme', { featureId: 'everything' }),
  'create own subscription as PAID Pro': create('subscriptions', 'sub_self', { subscriptionId: 'sub_self', customerType: selfCompany ? 'company' : 'individual', customerId: selfCompany || selfUid, planId: 'company_pro', status: 'ACTIVE', paymentStatus: 'PAID' }),
  'upgrade an existing subscription': update('subscriptions', 'sub_acme', { planId: 'enterprise', status: 'ACTIVE' }),
  'create an invoice': create('invoices', 'inv_self', { invoiceId: 'inv_self', customerId: selfCompany || selfUid, amount: 0 }),
  'mark an invoice paid': update('invoices', 'inv_acme', { paymentStatus: 'PAID' }),
  'write entitlement audit log': create('entitlementAuditLogs', 'eal_self', { id: 'eal_self' }),
  'tamper with entitlement audit log': update('entitlementAuditLogs', 'eal_1', { action: 'NOTHING' }),
  'write commercial audit log': create('commercialAuditLogs', 'cal_self', { id: 'cal_self' }),
  'delete commercial audit log': remove('commercialAuditLogs', 'cal_1'),
  'read commercial audit log': read('commercialAuditLogs', 'cal_1'),
  'read entitlement audit log': read('entitlementAuditLogs', 'eal_1'),
  'read security audit log': read('securityAuditLogs', 'sal_1'),
  'write card templates': update('cardTemplates', 'classic', { name: 'Hijacked' }),
  'write security audit log': create('securityAuditLogs', 'sal_self', { id: 'sal_self' }),
  'modify a tenant record': update('tenants', 'ind_uid_ind_a', { ownerUid: selfUid }),
});

describe('Phase 4 — Company A user (employee) → Company B data', () => {
  denied(ID.employeeA, {
    'read B lead': read('leads', 'lead_b'),
    'read B lead note': read('leadNotes', 'ln_b'),
    'read B lead events': read('leadEvents', 'le_b'),
    'read B event': read('events', 'evt_b'),
    'read B event member': read('eventMembers', 'em_b'),
    'read B subscription': read('subscriptions', 'sub_nexus'),
    'read B invoice': read('invoices', 'inv_nexus'),
    'read B admin user profile': read('users', 'uid_admin_b'),
    'update B employee': update('employees', 'emp_b', { displayName: 'Tampered' }),
    'update B card': update('cards', 'card_b', { status: 'inactive' }),
    'update B company': update('companies', 'company_nexus', { name: 'Tampered' }),
    'update B department': update('departments', 'dept_b', { name: 'Tampered' }),
    'update B identity profile': update('digitalIdentityProfiles', 'emp_b', { headline: 'Tampered' }),
    'create a lead in B': create('leads', 'lead_x', { id: 'lead_x', companyId: 'company_nexus', name: 'x' }),
    'create a lead note in B': create('leadNotes', 'ln_x', { id: 'ln_x', companyId: 'company_nexus', authorUserId: 'uid_emp_a' }),
    'enrol self into a B event': create('eventMembers', 'em_x', { id: 'em_x', companyId: 'company_nexus', eventId: 'evt_b', employeeId: 'emp_a' }),
  });
});

describe('Phase 4 — Company A admin → Company B data', () => {
  denied(ID.adminA, {
    'update B company': update('companies', 'company_nexus', { name: 'Tampered' }),
    'suspend B company': update('companies', 'company_nexus', { status: 'suspended' }),
    'create department in B': create('departments', 'dept_x', { id: 'dept_x', companyId: 'company_nexus', name: 'x', status: 'active' }),
    'create employee in B': create('employees', 'emp_x', { id: 'emp_x', companyId: 'company_nexus', departmentId: null, status: 'active' }),
    'update B employee': update('employees', 'emp_b', { designation: 'Tampered' }),
    'move B employee into A': update('employees', 'emp_b', { companyId: 'company_acme' }),
    'delete B employee': remove('employees', 'emp_b'),
    'delete B card': remove('cards', 'card_b'),
    'delete B department': remove('departments', 'dept_b'),
    'read B leads': read('leads', 'lead_b'),
    'update B lead': update('leads', 'lead_b', { status: 'won' }),
    'read B event': read('events', 'evt_b'),
    'update B event': update('events', 'evt_b', { name: 'Tampered' }),
    'create campaign in B': create('campaigns', 'camp_x', { id: 'camp_x', companyId: 'company_nexus', status: 'active' }),
    'read B subscription': read('subscriptions', 'sub_nexus'),
    'read B entitlement override': read('entitlementOverrides', 'ov_ind_b'),
    'create card in A bound to a B employee': create('cards', 'card_x', { id: 'card_x', companyId: 'company_acme', employeeId: 'emp_b', templateId: 'classic', publicSlug: 'x', status: 'active' }),
    'assign A employee to a B department': update('employees', 'emp_a', { departmentId: 'dept_b' }),
    'create A employee in a B department': create('employees', 'emp_y', { id: 'emp_y', companyId: 'company_acme', departmentId: 'dept_b', status: 'active' }),
  });
});

describe('Phase 4 — Individual A → Individual B data', () => {
  denied(ID.individualA, {
    'read B profile': read('users', 'uid_ind_b'),
    'read B tenant': read('tenants', 'ind_uid_ind_b'),
    'read B contact': read('contacts', 'contact_ind_b'),
    'update B contact': update('contacts', 'contact_ind_b', { displayName: 'Tampered' }),
    'delete B contact': remove('contacts', 'contact_ind_b'),
    'create contact owned by B': create('contacts', 'c_x', { id: 'c_x', ownerUserId: 'uid_ind_b', displayName: 'x' }),
    'read B relationship note': read('relationshipNotes', 'note_ind_b'),
    'delete B relationship note': remove('relationshipNotes', 'note_ind_b'),
    'read B follow-up': read('followUps', 'fu_ind_b'),
    'update B follow-up': update('followUps', 'fu_ind_b', { status: 'done' }),
    'read B subscription': read('subscriptions', 'sub_ind_b'),
    'read B entitlement override': read('entitlementOverrides', 'ov_ind_b'),
    'update B profile': update('users', 'uid_ind_b', { displayName: 'Tampered' }),
  });
});

describe('Phase 4 — Employee → company administration (own company)', () => {
  denied(ID.employeeA, {
    'create department': create('departments', 'dept_x', { id: 'dept_x', companyId: 'company_acme', name: 'x', status: 'active' }),
    'create employee': create('employees', 'emp_x', { id: 'emp_x', companyId: 'company_acme', departmentId: null, status: 'active' }),
    'update company profile': update('companies', 'company_acme', { name: 'Tampered' }),
    'update a colleague': update('employees', 'emp_a2', { displayName: 'Tampered' }),
    'change own companyId': update('employees', 'emp_a', { companyId: 'company_nexus' }),
    'change own status': update('employees', 'emp_a', { status: 'inactive' }),
    'change own department': update('employees', 'emp_a', { departmentId: 'dept_x' }),
    'delete own card': remove('cards', 'card_a'),
    'create a card': create('cards', 'card_x', { id: 'card_x', companyId: 'company_acme', employeeId: 'emp_a', status: 'active' }),
    'delete a lead': remove('leads', 'lead_a'),
    'create an event': create('events', 'evt_x', { id: 'evt_x', companyId: 'company_acme' }),
    'read company invoices (billing is admin-only)': read('invoices', 'inv_acme'),
  });
  allowed(ID.employeeA, {
    'update own bio': update('employees', 'emp_a', { bio: 'Hello', updatedAt: T }),
    'read own company leads': read('leads', 'lead_a'),
    'create a lead in own company': create('leads', 'lead_new', { id: 'lead_new', companyId: 'company_acme', name: 'n' }),
    'read company subscription (needed for plan display)': read('subscriptions', 'sub_acme'),
  });
});

describe('Phase 4 — Company admin → App Owner configuration', () => {
  denied(ID.adminA, {
    ...appOwnerConfigWrites('uid_admin_a', 'company_acme'),
    'change own company plan': update('companies', 'company_acme', { planId: 'enterprise' }),
    'change own company status': update('companies', 'company_acme', { status: 'suspended' }),
    'change own company owner': update('companies', 'company_acme', { ownerUid: 'uid_admin_a' }),
    'promote self to app_owner': update('users', 'uid_admin_a', { role: 'app_owner' }),
  });
});

describe('Phase 4 — Normal user (individual) → App Owner configuration', () => {
  denied(ID.individualA, appOwnerConfigWrites('uid_ind_a', null));
});

describe('Phase 4 — Unauthenticated → protected resources', () => {
  denied(ID.unauthenticated, {
    'read a user profile': read('users', 'uid_admin_a'),
    'read a tenant': read('tenants', 'ind_uid_ind_a'),
    'read leads': read('leads', 'lead_a'),
    'read lead notes': read('leadNotes', 'ln_a'),
    'read events': read('events', 'evt_a'),
    'read contacts': read('contacts', 'contact_ind_a'),
    'read relationship notes': read('relationshipNotes', 'note_ind_a'),
    'read follow-ups': read('followUps', 'fu_ind_a'),
    'read connections': read('connections', 'conn_ab'),
    'read connection events': read('connectionEvents', 'cevt_ab'),
    'read subscriptions': read('subscriptions', 'sub_acme'),
    'read invoices': read('invoices', 'inv_acme'),
    'read entitlement overrides': read('entitlementOverrides', 'ov_acme'),
    'read entitlement audit logs': read('entitlementAuditLogs', 'eal_1'),
    'read commercial audit logs': read('commercialAuditLogs', 'cal_1'),
    'update an employee': update('employees', 'emp_a', { displayName: 'Tampered' }),
    'update a card': update('cards', 'card_a', { status: 'inactive' }),
    'update a company': update('companies', 'company_acme', { name: 'Tampered' }),
    'write a plan': update('plans', 'individual_pro', { price: 0 }),
  });
  allowed(ID.unauthenticated, {
    'read an active company (public mini-website)': read('companies', 'company_acme'),
    'read an active card (public card)': read('cards', 'card_a'),
    'read an active employee (public card)': read('employees', 'emp_a'),
    'read plans (public pricing)': read('plans', 'individual_pro'),
  });
});

describe('Phase 4 — Suspended company admin', () => {
  denied(ID.suspendedAdmin, {
    'update own suspended company': update('companies', 'company_suspended', { name: 'Back online' }),
    'create department in suspended company': create('departments', 'dept_s', { id: 'dept_s', companyId: 'company_suspended', name: 'x', status: 'active' }),
    'update employee in suspended company': update('employees', 'emp_susp', { designation: 'x' }),
  });
});

describe('Phase 4 — legitimate tenant work (positive controls)', () => {
  allowed(ID.adminA, {
    'update own company description': update('companies', 'company_acme', { description: 'Updated', updatedAt: T }),
    'create department in own company': create('departments', 'dept_new', { id: 'dept_new', companyId: 'company_acme', name: 'New', description: '', status: 'active', createdAt: T, updatedAt: T }),
    'create employee in own company': create('employees', 'emp_new', { id: 'emp_new', companyId: 'company_acme', departmentId: 'dept_a', firstName: 'N', lastName: 'E', displayName: 'N E', designation: 'x', email: 'n@x.test', phone: '', status: 'active', createdAt: T, updatedAt: T }),
    'create card for own employee': create('cards', 'card_new', { id: 'card_new', companyId: 'company_acme', employeeId: 'emp_a2', templateId: 'classic', publicSlug: 'emp-a2', status: 'active', createdAt: T, updatedAt: T }),
    'read own company leads': read('leads', 'lead_a'),
    'read own company subscription': read('subscriptions', 'sub_acme'),
    'read own company invoice': read('invoices', 'inv_acme'),
    'read own company entitlement override': read('entitlementOverrides', 'ov_acme'),
  });
  allowed(ID.individualA, {
    'read own profile': read('users', 'uid_ind_a'),
    'read own tenant': read('tenants', 'ind_uid_ind_a'),
    'read own contact': read('contacts', 'contact_ind_a'),
    'create own contact': create('contacts', 'c_own', { id: 'c_own', ownerUserId: 'uid_ind_a', displayName: 'Mine', sourceType: 'manual', createdAt: T, updatedAt: T }),
    'read own subscription': read('subscriptions', 'sub_ind_a'),
  });
  allowed(ID.individualB, {
    'read own entitlement override': read('entitlementOverrides', 'ov_ind_b'),
  });
  allowed(ID.appOwner, {
    'read any subscription': read('subscriptions', 'sub_nexus'),
    'read commercial audit log': read('commercialAuditLogs', 'cal_1'),
    'read security audit log': read('securityAuditLogs', 'sal_1'),
    'read any tenant': read('tenants', 'ind_uid_ind_b'),
  });
});
