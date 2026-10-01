// Directive 24 Phase 3 — the bootstrap backdoor must be gone.
// A missing document must never grant privileges. Every write below must be
// denied in every database state, both unauthenticated and as a signed-in user
// that has no profile/tenant yet.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { buildRegistrationDocuments } from '../../src/services/registrationModel';
import { createRulesEnv, dbFor, fullWorld, ID, loadFixtures, type FixtureSet } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-01T00:00:00.000Z';

const world = fullWorld();
const withoutAcme = (): FixtureSet => {
  const w = fullWorld();
  delete w.companies.company_acme;
  return w;
};
const freshlyRegisteredCompany = (): FixtureSet => {
  const d = buildRegistrationDocuments({ uid: 'uid_brand_new', email: 'brand-new@dsbc.test', displayName: 'B', accountType: 'company', companyName: 'Brand New', now: T });
  return { companies: { [d.company!.id]: d.company! }, tenants: { [d.tenant.id]: d.tenant }, users: { uid_brand_new: d.user } };
};

const DATABASE_STATES: Record<string, () => FixtureSet> = {
  'empty database': () => ({}),
  'partially initialized (company_nexus only, no company_acme)': () => ({ companies: { company_nexus: world.companies.company_nexus } }),
  'company_acme deleted from a full database': withoutAcme,
  'only a newly registered tenant exists': freshlyRegisteredCompany,
};

// Writes the baseline rules allowed whenever companies/company_acme was absent.
const BOOTSTRAP_WRITES: Record<string, (fs: Firestore, uid: string | null) => Promise<void>> = {
  'create companies/company_acme': (fs) => setDoc(doc(fs, 'companies', 'company_acme'), { ...world.companies.company_acme }),
  'create demo App Owner users/user_app_owner_demo': (fs) =>
    setDoc(doc(fs, 'users', 'user_app_owner_demo'), { id: 'user_app_owner_demo', email: 'owner@saas-cards.io', displayName: 'Owner', role: 'app_owner', companyId: null, employeeId: null, status: 'active', createdAt: T, updatedAt: T }),
  'create demo company admin users/user_admin_acme_demo': (fs) =>
    setDoc(doc(fs, 'users', 'user_admin_acme_demo'), { id: 'user_admin_acme_demo', email: 'a@x.test', displayName: 'A', role: 'company_admin', companyId: 'company_acme', employeeId: null, status: 'active', createdAt: T, updatedAt: T }),
  'create cardTemplates/classic': (fs) => setDoc(doc(fs, 'cardTemplates', 'classic'), { id: 'classic', name: 'Hijacked' }),
  'create plans/individual_pro': (fs) => setDoc(doc(fs, 'plans', 'individual_pro'), { id: 'individual_pro', price: 0 }),
  'create globalPolicies/platform': (fs) => setDoc(doc(fs, 'globalPolicies', 'platform'), { id: 'platform', maintenanceMode: true }),
  'create entitlementOverrides': (fs, uid) => setDoc(doc(fs, 'entitlementOverrides', 'ov_injected'), { id: 'ov_injected', targetType: 'individual', targetId: uid || 'x', featureId: 'individual.analytics' }),
  'create entitlementAuditLogs': (fs) => setDoc(doc(fs, 'entitlementAuditLogs', 'eal_injected'), { id: 'eal_injected' }),
  'create subscriptions (self-granted Pro)': (fs, uid) => setDoc(doc(fs, 'subscriptions', 'sub_injected'), { subscriptionId: 'sub_injected', customerType: 'individual', customerId: uid || 'x', planId: 'individual_pro', status: 'ACTIVE', paymentStatus: 'PAID' }),
  'create invoices': (fs, uid) => setDoc(doc(fs, 'invoices', 'inv_injected'), { invoiceId: 'inv_injected', customerType: 'individual', customerId: uid || 'x', amount: 0 }),
  'create commercialAuditLogs': (fs) => setDoc(doc(fs, 'commercialAuditLogs', 'cal_injected'), { id: 'cal_injected' }),
  'create departments in company_acme': (fs) => setDoc(doc(fs, 'departments', 'dept_injected'), { id: 'dept_injected', companyId: 'company_acme', name: 'x', status: 'active' }),
  'create employees in company_acme': (fs) => setDoc(doc(fs, 'employees', 'emp_injected'), { id: 'emp_injected', companyId: 'company_acme', departmentId: null, status: 'active' }),
  'create cards in company_acme': (fs) => setDoc(doc(fs, 'cards', 'card_injected'), { id: 'card_injected', companyId: 'company_acme', employeeId: 'emp_a', status: 'active' }),
  'create contacts for another user': (fs) => setDoc(doc(fs, 'contacts', 'c_injected'), { id: 'c_injected', ownerUserId: 'uid_ind_a', displayName: 'x' }),
  'create relationshipNotes for another user': (fs) => setDoc(doc(fs, 'relationshipNotes', 'n_injected'), { id: 'n_injected', ownerUserId: 'uid_ind_a' }),
  'create followUps for another user': (fs) => setDoc(doc(fs, 'followUps', 'f_injected'), { id: 'f_injected', ownerUserId: 'uid_ind_a' }),
  'create connections between other users': (fs) => setDoc(doc(fs, 'connections', 'conn_injected'), { id: 'conn_injected', requesterUserId: 'uid_ind_a', recipientUserId: 'uid_ind_b', recipientCompanyId: 'company_acme', status: 'accepted' }),
  'create connectionEvents': (fs) => setDoc(doc(fs, 'connectionEvents', 'ce_injected'), { id: 'ce_injected', connectionId: 'conn_ab', participantUserIds: ['uid_ind_a'], eventType: 'CONNECTION_REQUESTED', actorUserId: 'x' }),
  'create events in company_acme': (fs) => setDoc(doc(fs, 'events', 'evt_injected'), { id: 'evt_injected', companyId: 'company_acme' }),
  'create eventMembers in company_acme': (fs) => setDoc(doc(fs, 'eventMembers', 'em_injected'), { id: 'em_injected', companyId: 'company_acme', employeeId: 'emp_a' }),
  'create campaigns in company_acme': (fs) => setDoc(doc(fs, 'campaigns', 'camp_injected'), { id: 'camp_injected', companyId: 'company_acme', status: 'active' }),
  'create leads in company_acme': (fs) => setDoc(doc(fs, 'leads', 'lead_injected'), { id: 'lead_injected', companyId: 'company_acme' }),
  'create leadNotes in company_acme': (fs) => setDoc(doc(fs, 'leadNotes', 'ln_injected'), { id: 'ln_injected', companyId: 'company_acme', authorUserId: 'x' }),
  'create leadEvents in company_acme': (fs) => setDoc(doc(fs, 'leadEvents', 'le_injected'), { id: 'le_injected', companyId: 'company_acme' }),
  'create digitalIdentityProfiles in company_acme': (fs) => setDoc(doc(fs, 'digitalIdentityProfiles', 'emp_injected'), { employeeId: 'emp_injected', companyId: 'company_acme' }),
};

beforeAll(async () => {
  env = await createRulesEnv('phase3');
});
afterAll(async () => env?.cleanup());

for (const [stateName, buildState] of Object.entries(DATABASE_STATES)) {
  describe(`Phase 3 — ${stateName}`, () => {
    beforeEach(async () => loadFixtures(env, buildState()));

    for (const actor of [ID.unauthenticated, ID.freshUser]) {
      describe(actor.label, () => {
        for (const [name, write] of Object.entries(BOOTSTRAP_WRITES)) {
          it(`DENIED: ${name}`, async () => {
            await assertFails(write(dbFor(env, actor), actor.uid));
          });
        }
      });
    }
  });
}
