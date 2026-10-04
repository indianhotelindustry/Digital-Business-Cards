// Directive 34 Phase 1 — registration is backend-only.
// registerIndividual / registerCompany (Admin SDK) create accounts; a browser
// can no longer create its own users/tenants/companies documents. The App
// Owner's client-side company create stays until Phase 2. Emulator only.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { buildRegistrationDocuments } from '../../src/services/registrationModel';
import { commitBatch, createRulesEnv, dbFor, fullWorld, ID, loadFixtures, type Identity } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-04T00:00:00.000Z';

const newbie: Identity = {
  label: 'new Google user',
  uid: 'newbie',
  token: { email: 'newbie@x.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
};

beforeAll(async () => {
  env = await createRulesEnv('d34-registration-closed');
});
afterAll(async () => env?.cleanup());
beforeEach(async () => loadFixtures(env, fullWorld()));

describe('D34-AUTH-023 browser cannot create its own account', () => {
  it('a signed-in browser cannot create users/tenants/companies for itself', async () => {
    const db = dbFor(env, newbie);
    await assertFails(setDoc(doc(db, 'users/newbie'), {
      id: 'newbie', email: 'newbie@x.test', displayName: 'N', role: 'company_admin', companyId: 'co_newbie', employeeId: null,
      status: 'active', accountType: 'company', tenantId: 'co_newbie', createdAt: T, updatedAt: T,
    }));
    await assertFails(setDoc(doc(db, 'tenants/co_newbie'), {
      id: 'co_newbie', kind: 'company', ownerUid: 'newbie', companyId: 'co_newbie', status: 'active', createdAt: T,
    }));
    await assertFails(setDoc(doc(db, 'companies/co_newbie'), {
      id: 'co_newbie', name: 'N', ownerUid: 'newbie', kind: 'company', status: 'pending_approval', planId: 'company_free',
    }));
  });

  it('a pending self-registration batch (individual) is denied', async () => {
    const d = buildRegistrationDocuments({ uid: 'newbie', email: 'newbie@x.test', displayName: 'N', accountType: 'individual', status: 'pending_approval', now: T });
    await assertFails(commitBatch(dbFor(env, newbie), [
      { path: ['tenants', d.tenant.id], data: d.tenant },
      { path: ['users', 'newbie'], data: d.user },
    ]));
  });

  it('a pending self-registration batch (company) is denied', async () => {
    const d = buildRegistrationDocuments({ uid: 'newbie', email: 'newbie@x.test', displayName: 'N', accountType: 'company', companyName: 'N Co', status: 'pending_approval', now: T });
    await assertFails(commitBatch(dbFor(env, newbie), [
      { path: ['companies', d.company!.id], data: d.company },
      { path: ['tenants', d.tenant.id], data: d.tenant },
      { path: ['users', 'newbie'], data: d.user },
    ]));
  });

  it('the App Owner can still create a company from the browser (until Phase 2)', async () => {
    await assertSucceeds(setDoc(doc(dbFor(env, ID.appOwner), 'companies', 'co_owner_made'), {
      id: 'co_owner_made', name: 'Owner Made', status: 'active', planId: 'company_free', createdAt: T, updatedAt: T,
    }));
  });
});
