// Directive 24 Phase 2 — authoritative identity & RBAC.
// Registration establishes identity + requested account type only; the client
// can never choose role, companyId, plan or App Owner status. App Owner comes
// only from a server-set custom claim on a verified identity.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { buildRegistrationDocuments } from '../../src/services/registrationModel';
import { commitBatch, createRulesEnv, dbFor, fullWorld, ID, loadFixtures, type Identity } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-01T00:00:00.000Z';

const newIndividual: Identity = { label: 'new individual', uid: 'uid_new_ind', token: { email: 'new-ind@dsbc.test', email_verified: false } };
const newCompanyOwner: Identity = { label: 'new company owner', uid: 'uid_new_co', token: { email: 'new-co@dsbc.test', email_verified: false } };

function registrationWrites(uid: string, email: string, accountType: 'individual' | 'company') {
  const docs = buildRegistrationDocuments({ uid, email, displayName: 'New Person', accountType, companyName: 'New Co', status: 'pending_approval', now: T });
  const writes: Array<{ path: [string, string]; data: any }> = [];
  if (docs.company) writes.push({ path: ['companies', docs.company.id], data: docs.company });
  writes.push({ path: ['tenants', docs.tenant.id], data: docs.tenant });
  writes.push({ path: ['users', uid], data: docs.user });
  return { docs, writes };
}

beforeAll(async () => {
  env = await createRulesEnv('phase2');
});
afterAll(async () => env?.cleanup());
beforeEach(async () => loadFixtures(env, fullWorld()));

describe('Phase 2 — registration (positive controls)', () => {
  it('individual registration creates identity + independent individual tenant', async () => {
    const { writes } = registrationWrites('uid_new_ind', 'new-ind@dsbc.test', 'individual');
    await assertSucceeds(commitBatch(dbFor(env, newIndividual), writes));
  });

  it('company registration creates company tenant; creator becomes its administrator', async () => {
    const { writes } = registrationWrites('uid_new_co', 'new-co@dsbc.test', 'company');
    await assertSucceeds(commitBatch(dbFor(env, newCompanyOwner), writes));
  });
});

describe('Phase 2 — registration attacks (must be DENIED)', () => {
  const attacker = newIndividual;
  const base = { id: 'uid_new_ind', email: 'new-ind@dsbc.test', displayName: 'X', employeeId: null, status: 'pending_approval', createdAt: T, updatedAt: T };

  it('self-assign company_admin of an EXISTING company (legacy client payload)', async () => {
    await assertFails(setDoc(doc(dbFor(env, attacker), 'users', 'uid_new_ind'), { ...base, role: 'company_admin', companyId: 'company_acme' }));
  });

  it('self-assign company_admin of an existing company inside a registration-shaped batch', async () => {
    const { docs } = registrationWrites('uid_new_ind', 'new-ind@dsbc.test', 'company');
    await assertFails(
      commitBatch(dbFor(env, attacker), [
        { path: ['tenants', docs.tenant.id], data: docs.tenant },
        { path: ['users', 'uid_new_ind'], data: { ...docs.user, companyId: 'company_acme', tenantId: docs.tenant.id } },
      ])
    );
  });

  it('self-assign role app_owner', async () => {
    const { writes, docs } = registrationWrites('uid_new_ind', 'new-ind@dsbc.test', 'individual');
    writes[writes.length - 1] = { path: ['users', 'uid_new_ind'], data: { ...docs.user, role: 'app_owner' } };
    await assertFails(commitBatch(dbFor(env, attacker), writes));
  });

  it('claim an existing employee identity (employeeId emp_a in company_acme)', async () => {
    await assertFails(setDoc(doc(dbFor(env, attacker), 'users', 'uid_new_ind'), { ...base, role: 'employee', companyId: 'company_acme', employeeId: 'emp_a' }));
  });

  it('choose a paid plan at registration', async () => {
    const { writes, docs } = registrationWrites('uid_new_co', 'new-co@dsbc.test', 'company');
    writes[0] = { path: ['companies', docs.company!.id], data: { ...docs.company, planId: 'company_pro' } };
    await assertFails(commitBatch(dbFor(env, newCompanyOwner), writes));
  });

  it('register a company under another user\'s tenant id', async () => {
    const { docs } = registrationWrites('uid_admin_a', 'admin-a@acme.test', 'company');
    await assertFails(
      commitBatch(dbFor(env, newCompanyOwner), [
        { path: ['companies', docs.company!.id], data: { ...docs.company, ownerUid: 'uid_new_co' } },
        { path: ['tenants', docs.tenant.id], data: { ...docs.tenant, ownerUid: 'uid_new_co' } },
        { path: ['users', 'uid_new_co'], data: { ...docs.user, id: 'uid_new_co', email: 'new-co@dsbc.test' } },
      ])
    );
  });

  it('inject a privileged field (platformRole) into the profile', async () => {
    const { writes, docs } = registrationWrites('uid_new_ind', 'new-ind@dsbc.test', 'individual');
    writes[writes.length - 1] = { path: ['users', 'uid_new_ind'], data: { ...docs.user, platformRole: 'app_owner' } };
    await assertFails(commitBatch(dbFor(env, attacker), writes));
  });

  it('register with an email that does not match the authenticated identity', async () => {
    const { writes } = registrationWrites('uid_new_ind', 'someone-else@dsbc.test', 'individual');
    await assertFails(commitBatch(dbFor(env, attacker), writes));
  });

  it('create a users document for another uid', async () => {
    const { writes } = registrationWrites('uid_other', 'new-ind@dsbc.test', 'individual');
    await assertFails(commitBatch(dbFor(env, attacker), writes));
  });

  it('unauthenticated registration write', async () => {
    const { writes } = registrationWrites('uid_new_ind', 'new-ind@dsbc.test', 'individual');
    await assertFails(commitBatch(dbFor(env, ID.unauthenticated), writes));
  });

  it('existing user creates a second (company) tenant after registration', async () => {
    const { docs } = registrationWrites('uid_ind_a', 'ind-a@dsbc.test', 'company');
    await assertFails(
      commitBatch(dbFor(env, ID.individualA), [
        { path: ['companies', docs.company!.id], data: docs.company },
        { path: ['tenants', docs.tenant.id], data: docs.tenant },
      ])
    );
  });
});

describe('Phase 2 — profile authority fields are immutable for the user', () => {
  it('user may update own displayName (positive control)', async () => {
    await assertSucceeds(updateDoc(doc(dbFor(env, ID.employeeA), 'users', 'uid_emp_a'), { displayName: 'Renamed', updatedAt: T }));
  });

  for (const [field, value] of [
    ['role', 'company_admin'],
    ['companyId', 'company_nexus'],
    ['employeeId', 'emp_b'],
    ['status', 'suspended'],
    ['accountType', 'company'],
    ['tenantId', 'co_uid_emp_a'],
    ['email', 'other@dsbc.test'],
  ] as const) {
    it(`user cannot change own ${field}`, async () => {
      await assertFails(updateDoc(doc(dbFor(env, ID.employeeA), 'users', 'uid_emp_a'), { [field]: value }));
    });
  }

  it('suspended user cannot reactivate themselves', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as any, 'users', 'uid_emp_a'), { status: 'suspended' });
    });
    await assertFails(updateDoc(doc(dbFor(env, ID.employeeA), 'users', 'uid_emp_a'), { status: 'active' }));
  });
});

describe('Phase 2 — App Owner authority', () => {
  const privilegedActions = (who: Identity): Record<string, () => Promise<unknown>> => ({
    'read another user profile': () => getDoc(doc(dbFor(env, who), 'users', 'uid_admin_b')),
    'suspend a company': () => updateDoc(doc(dbFor(env, who), 'companies', 'company_nexus'), { status: 'suspended' }),
    'change a company plan': () => updateDoc(doc(dbFor(env, who), 'companies', 'company_nexus'), { planId: 'company_pro' }),
    'write card templates': () => setDoc(doc(dbFor(env, who), 'cardTemplates', 'injected'), { id: 'injected' }),
    'read commercial audit log': () => getDoc(doc(dbFor(env, who), 'commercialAuditLogs', 'cal_1')),
    'delete a user': () => deleteDoc(doc(dbFor(env, who), 'users', 'uid_emp_b')),
  });

  describe('verified App Owner claim (positive controls)', () => {
    for (const [name, action] of Object.entries(privilegedActions(ID.appOwner))) {
      it(`App Owner can ${name}`, async () => {
        await assertSucceeds(action());
      });
    }
  });

  for (const impostor of [ID.ownerEmailImpostor, ID.legacyOwnerEmailUnverified, ID.docRoleImpostor, ID.unverifiedClaimOwner]) {
    describe(`impersonation: ${impostor.label}`, () => {
      for (const [name, action] of Object.entries(privilegedActions(impostor))) {
        it(`cannot ${name}`, async () => {
          await assertFails(action());
        });
      }
    });
  }
});
