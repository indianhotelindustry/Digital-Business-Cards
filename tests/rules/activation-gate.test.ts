// Directive 30 — customer activation gate (Task 7).
// Registration creates an account as 'pending_approval'; only the backend can
// make it 'active'. Content writes require an ACTIVE account on top of the
// existing ownership / membership checks. Emulator only.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { buildRegistrationDocuments } from '../../src/services/registrationModel';
import { commitBatch, createRulesEnv, dbFor, fullWorld, ID, loadFixtures, type FixtureSet, type Identity } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-01T00:00:00.000Z';

const verified = (email: string) => ({ email, email_verified: true });

// A pending company admin of an existing (active) company: the strongest
// "pending but otherwise authorised" actor. Only the account status differs
// from ID.adminA.
const pendingAdmin: Identity = { label: 'pending company admin of company_acme', uid: 'uid_pend_admin', token: verified('pend-admin@acme.test') };
// A pending individual (no company) with a tenant of their own.
const pendingIndividual: Identity = { label: 'pending individual', uid: 'uid_pend_ind', token: verified('pend-ind@dsbc.test') };
const activeIndividual = ID.individualA;

function world(): FixtureSet {
  const w = fullWorld();
  w.users.uid_pend_admin = {
    id: 'uid_pend_admin', email: 'pend-admin@acme.test', displayName: 'Pending Admin', role: 'company_admin', companyId: 'company_acme',
    employeeId: null, status: 'pending_approval', createdAt: T, updatedAt: T,
  };
  w.users.uid_pend_ind = {
    id: 'uid_pend_ind', email: 'pend-ind@dsbc.test', displayName: 'Pending Ind', role: 'employee', companyId: null, employeeId: null,
    status: 'pending_approval', accountType: 'individual', tenantId: 'ind_uid_pend_ind', createdAt: T, updatedAt: T,
  };
  w.tenants.ind_uid_pend_ind = { id: 'ind_uid_pend_ind', kind: 'individual', ownerUid: 'uid_pend_ind', companyId: null, status: 'pending_approval', createdAt: T };
  return w;
}

const newCard = (id: string, companyId: string, employeeId: string) => ({
  id, companyId, employeeId, templateId: 'classic', publicSlug: id, status: 'active', createdAt: T, updatedAt: T,
});

beforeAll(async () => {
  env = await createRulesEnv('activation-gate');
});
afterAll(async () => env?.cleanup());
beforeEach(async () => loadFixtures(env, world()));

describe('REG-006/009 pending accounts cannot write customer content', () => {
  it('pending company admin cannot create a card in their own company', async () => {
    await assertFails(setDoc(doc(dbFor(env, pendingAdmin), 'cards', 'pend_card'), newCard('pend_card', 'company_acme', 'emp_a2')));
  });

  it('pending company admin cannot update an existing card', async () => {
    await assertFails(updateDoc(doc(dbFor(env, pendingAdmin), 'cards', 'card_a'), { templateId: 'modern', updatedAt: T }));
  });

  it('pending company admin cannot create a digital identity profile', async () => {
    await assertFails(
      setDoc(doc(dbFor(env, pendingAdmin), 'digitalIdentityProfiles', 'emp_a2'), { employeeId: 'emp_a2', companyId: 'company_acme', headline: 'x', updatedAt: T })
    );
  });

  it('pending company admin cannot edit company content', async () => {
    await assertFails(updateDoc(doc(dbFor(env, pendingAdmin), 'companies', 'company_acme'), { description: 'edited', updatedAt: T }));
  });

  it('pending company admin cannot create a lead or a lead event', async () => {
    await assertFails(setDoc(doc(dbFor(env, pendingAdmin), 'leads', 'lead_p'), { id: 'lead_p', companyId: 'company_acme', name: 'x', status: 'new', createdAt: T }));
    await assertFails(setDoc(doc(dbFor(env, pendingAdmin), 'leadEvents', 'le_p'), { id: 'le_p', companyId: 'company_acme', leadId: 'lead_a', type: 'CREATED' }));
  });

  // These Connect collections were previously gated only by isSignedIn(), so
  // they prove the isActiveAccount() gate on its own.
  it('pending individual cannot create personal Connect data', async () => {
    const fs = dbFor(env, pendingIndividual);
    await assertFails(setDoc(doc(fs, 'contacts', 'c_p'), { id: 'c_p', ownerUserId: 'uid_pend_ind', displayName: 'x', sourceType: 'manual', createdAt: T, updatedAt: T }));
    await assertFails(setDoc(doc(fs, 'relationshipNotes', 'n_p'), { id: 'n_p', ownerUserId: 'uid_pend_ind', body: 'x' }));
    await assertFails(setDoc(doc(fs, 'followUps', 'f_p'), { id: 'f_p', ownerUserId: 'uid_pend_ind', title: 'x', status: 'pending' }));
  });

  it('pending individual cannot create a connection or connection event', async () => {
    const fs = dbFor(env, pendingIndividual);
    await assertFails(
      setDoc(doc(fs, 'connections', 'conn_p'), { id: 'conn_p', requesterUserId: 'uid_pend_ind', recipientUserId: 'uid_ind_b', recipientCompanyId: 'company_nexus', status: 'requested' })
    );
    await assertFails(
      setDoc(doc(fs, 'connectionEvents', 'ce_p'), { id: 'ce_p', connectionId: 'conn_ab', participantUserIds: ['uid_ind_a', 'uid_ind_b'], eventType: 'NOTE', actorUserId: 'uid_pend_ind' })
    );
  });
});

describe('REG-021 active accounts can write their content (positive controls)', () => {
  it('active company admin can create a card for an employee of their company', async () => {
    await assertSucceeds(setDoc(doc(dbFor(env, ID.adminA), 'cards', 'act_card'), newCard('act_card', 'company_acme', 'emp_a2')));
  });

  it('active company admin can update company content', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(env, ID.adminA), 'companies', 'company_acme'), { description: 'edited', updatedAt: T }));
  });

  it('active individual can create personal Connect data', async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(env, activeIndividual), 'contacts', 'c_act'), { id: 'c_act', ownerUserId: 'uid_ind_a', displayName: 'x', sourceType: 'manual', createdAt: T, updatedAt: T })
    );
  });

  it('active employee can write their own digital identity profile', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(env, ID.employeeA), 'digitalIdentityProfiles', 'emp_a'), { headline: 'Updated', updatedAt: T }));
  });
});

describe('REG-001 registration must create pending_approval, never active', () => {
  const uid = 'uid_new_ind';
  const registrant: Identity = { label: 'new individual', uid, token: { email: 'new-ind@dsbc.test', email_verified: false } };
  const coUid = 'uid_new_co';
  const coRegistrant: Identity = { label: 'new company owner', uid: coUid, token: { email: 'new-co@dsbc.test', email_verified: false } };

  const individualDocs = () => buildRegistrationDocuments({ uid, email: 'new-ind@dsbc.test', displayName: 'New', accountType: 'individual', status: 'pending_approval', now: T });
  const companyDocs = () => buildRegistrationDocuments({ uid: coUid, email: 'new-co@dsbc.test', displayName: 'New', accountType: 'company', companyName: 'New Co', status: 'pending_approval', now: T });

  it('browser-side individual registration batch is denied: registration is backend-only (Directive 34)', async () => {
    const d = individualDocs();
    await assertFails(
      commitBatch(dbFor(env, registrant), [
        { path: ['tenants', d.tenant.id], data: d.tenant },
        { path: ['users', uid], data: d.user },
      ])
    );
  });

  it('a users document created as active is denied', async () => {
    const d = individualDocs();
    await assertFails(
      commitBatch(dbFor(env, registrant), [
        { path: ['tenants', d.tenant.id], data: d.tenant },
        { path: ['users', uid], data: { ...d.user, status: 'active' } },
      ])
    );
  });

  it('a tenant created as active is denied', async () => {
    const d = individualDocs();
    await assertFails(
      commitBatch(dbFor(env, registrant), [
        { path: ['tenants', d.tenant.id], data: { ...d.tenant, status: 'active' } },
        { path: ['users', uid], data: d.user },
      ])
    );
  });

  it('a company created as active is denied', async () => {
    const d = companyDocs();
    await assertFails(
      commitBatch(dbFor(env, coRegistrant), [
        { path: ['companies', d.company!.id], data: { ...d.company, status: 'active' } },
        { path: ['tenants', d.tenant.id], data: d.tenant },
        { path: ['users', coUid], data: d.user },
      ])
    );
  });

  it('browser-side company registration batch (all three documents pending) is denied: registration is backend-only (Directive 34)', async () => {
    const d = companyDocs();
    await assertFails(
      commitBatch(dbFor(env, coRegistrant), [
        { path: ['companies', d.company!.id], data: d.company },
        { path: ['tenants', d.tenant.id], data: d.tenant },
        { path: ['users', coUid], data: d.user },
      ])
    );
  });

  it('any other status value at creation is denied', async () => {
    const d = individualDocs();
    for (const status of ['suspended', 'approved', 'ACTIVE', '']) {
      await assertFails(
        commitBatch(dbFor(env, registrant), [
          { path: ['tenants', d.tenant.id], data: d.tenant },
          { path: ['users', uid], data: { ...d.user, status } },
        ])
      );
    }
  });
});

describe('REG-023 a customer cannot change account status', () => {
  it('pending user cannot self-activate', async () => {
    await assertFails(updateDoc(doc(dbFor(env, pendingIndividual), 'users', 'uid_pend_ind'), { status: 'active', updatedAt: T }));
    await assertFails(updateDoc(doc(dbFor(env, pendingAdmin), 'users', 'uid_pend_admin'), { status: 'active', updatedAt: T }));
  });

  it('pending user cannot activate their own tenant', async () => {
    await assertFails(updateDoc(doc(dbFor(env, pendingIndividual), 'tenants', 'ind_uid_pend_ind'), { status: 'active' }));
  });

  it('active user cannot change status (e.g. un-suspend / re-pend) on user, tenant or company', async () => {
    await assertFails(updateDoc(doc(dbFor(env, ID.individualA), 'users', 'uid_ind_a'), { status: 'pending_approval', updatedAt: T }));
    await assertFails(updateDoc(doc(dbFor(env, ID.individualA), 'tenants', 'ind_uid_ind_a'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(dbFor(env, ID.adminA), 'companies', 'company_acme'), { status: 'suspended' }));
  });

  it('active user can still rename themselves (users update stays displayName/updatedAt only)', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(env, ID.employeeA), 'users', 'uid_emp_a'), { displayName: 'Renamed', updatedAt: T }));
  });
});

describe('REG-022 a pending user cannot write another tenant', () => {
  it('pending company admin cannot write cards or profiles of another company', async () => {
    const fs = dbFor(env, pendingAdmin);
    await assertFails(setDoc(doc(fs, 'cards', 'other_card'), newCard('other_card', 'company_nexus', 'emp_b')));
    await assertFails(updateDoc(doc(fs, 'cards', 'card_b'), { templateId: 'modern', updatedAt: T }));
    await assertFails(updateDoc(doc(fs, 'digitalIdentityProfiles', 'emp_b'), { headline: 'hijack', updatedAt: T }));
  });

  it('pending individual cannot write another tenant content', async () => {
    const fs = dbFor(env, pendingIndividual);
    await assertFails(setDoc(doc(fs, 'cards', 'other_card'), newCard('other_card', 'company_acme', 'emp_a2')));
    await assertFails(setDoc(doc(fs, 'cards', 'other_card2'), { ownerUid: 'someoneelse' }));
    await assertFails(setDoc(doc(fs, 'leads', 'lead_x'), { id: 'lead_x', companyId: 'company_nexus', name: 'x', status: 'new', createdAt: T }));
  });

  it('active user still cannot write another tenant (gate does not widen access)', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.adminA), 'cards', 'other_card'), newCard('other_card', 'company_nexus', 'emp_b')));
  });
});

describe('Server-only collections stay closed for active customers', () => {
  it('active admin cannot write audit, subscription, invoice, entitlement or platformConfig documents', async () => {
    const fs = dbFor(env, ID.adminA);
    await assertFails(setDoc(doc(fs, 'platformAuditLogs', 'x'), { id: 'x' }));
    await assertFails(setDoc(doc(fs, 'subscriptions', 'sub_x'), { subscriptionId: 'sub_x', customerType: 'company', customerId: 'company_acme', planId: 'company_pro', status: 'ACTIVE' }));
    await assertFails(setDoc(doc(fs, 'invoices', 'inv_x'), { invoiceId: 'inv_x', customerType: 'company', customerId: 'company_acme', amount: 0 }));
    await assertFails(setDoc(doc(fs, 'entitlementOverrides', 'ov_x'), { id: 'ov_x', targetType: 'company', targetId: 'company_acme', featureId: 'company.analytics' }));
    await assertFails(setDoc(doc(fs, 'platformConfig', 'x'), { id: 'x' }));
  });
});
