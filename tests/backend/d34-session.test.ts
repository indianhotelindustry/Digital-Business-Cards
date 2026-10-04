import { beforeAll, describe, expect, it } from 'vitest';
import { adminDb, call, createGoogleUser, createUser, ok, resetEmulators } from './support/backendEnv';

beforeAll(async () => {
  await resetEmulators();
});

describe('D34 account state', () => {
  it('a signed-in identity without a DSBC profile is no_account, not pending approval', async () => {
    const g = await createGoogleUser('g-no-profile', 'nobody@example.test');
    expect(await ok('getMyAccountState', {}, g)).toEqual({ status: 'no_account', emailVerified: true });
  });
  it('a Google identity carries sign_in_provider google.com in its ID token', async () => {
    const g = await createGoogleUser('g-provider', 'provider@example.test');
    const payload = JSON.parse(Buffer.from(g.token.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.firebase.sign_in_provider).toBe('google.com');
  });
  it('getMyAccountState still requires sign-in', async () => {
    expect((await call('getMyAccountState', {}, null)).status).toBe('UNAUTHENTICATED');
  });
  it('a password identity is still accepted in Phase 1', async () => {
    const u = await createUser('u-pw');
    expect((await ok('getMyAccountState', {}, u)).status).toBe('no_account');
  });
});

describe('D34 registerIndividual (Create Free Card)', () => {
  it('D34-AUTH-010 free individual is ACTIVE immediately, never queued for approval', async () => {
    const g = await createGoogleUser('g-ind', 'me@person.test');
    const r = await ok('registerIndividual', { displayName: 'Ravi' }, g);
    expect(r).toEqual({ created: true, destination: { kind: 'individual_workspace' } });
    expect((await adminDb.doc(`users/${g.uid}`).get()).data()).toMatchObject({ id: g.uid, role: 'employee', accountType: 'individual', companyId: null, employeeId: null, status: 'active', tenantId: `ind_${g.uid}` });
    expect((await adminDb.doc(`tenants/ind_${g.uid}`).get()).data()).toMatchObject({ kind: 'individual', status: 'active', commercial: { state: 'free', method: 'free' } });
    expect((await adminDb.collection('companies').where('ownerUid', '==', g.uid).get()).size).toBe(0);
    expect((await adminDb.collection('users').where('status', '==', 'pending_approval').get()).size).toBe(0);
    const audits = await adminDb.collection('commercialAuditLogs').where('targetId', '==', g.uid).where('action', '==', 'ACCOUNT_ACTIVATED').get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0].get('source')).toBe('Individual registration');
  });
  it('rejects company fields: the individual workflow never creates a company', async () => {
    const g = await createGoogleUser('g-ind2', 'me2@person.test');
    expect((await call('registerIndividual', { displayName: 'X', companyName: 'Sneaky Co' }, g)).status).toBe('INVALID_ARGUMENT');
  });
});

describe('D34 registerCompany (Register as Company)', () => {
  it('D34-AUTH-011 free company: one user, tenant and company, all ACTIVE, owned by the Google UID', async () => {
    const g = await createGoogleUser('g-co', 'owner@acme.test');
    const r = await ok('registerCompany', { displayName: 'Asha Owner', companyName: 'Acme Ltd', planId: 'company_free' }, g);
    expect(r).toEqual({ created: true, destination: { kind: 'company_workspace' } });
    expect((await adminDb.doc(`users/${g.uid}`).get()).data()).toMatchObject({ id: g.uid, role: 'company_admin', accountType: 'company', companyId: `co_${g.uid}`, status: 'active', email: 'owner@acme.test' });
    expect((await adminDb.doc(`tenants/co_${g.uid}`).get()).data()).toMatchObject({ kind: 'company', status: 'active', commercial: { state: 'free', method: 'free' } });
    expect((await adminDb.doc(`companies/co_${g.uid}`).get()).data()).toMatchObject({ ownerUid: g.uid, status: 'active', planId: 'company_free', name: 'Acme Ltd', kind: 'company' });
    const company = (await adminDb.doc(`companies/co_${g.uid}`).get()).data()!;
    expect(typeof company.createdAt).toBe('string');
    expect(typeof company.updatedAt).toBe('string');
    const audits = await adminDb.collection('commercialAuditLogs').where('targetId', '==', `co_${g.uid}`).where('action', '==', 'ACCOUNT_ACTIVATED').get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0].get('source')).toBe('Company registration');
  });
  it('Phase 1 offers the Free company plan only (paid plans are Phase 6)', async () => {
    const g = await createGoogleUser('g-paid', 'paid@acme.test');
    expect((await call('registerCompany', { displayName: 'P', companyName: 'Paid Co', planId: 'company_pro' }, g)).status).toBe('FAILED_PRECONDITION');
    expect((await adminDb.doc(`users/${g.uid}`).get()).exists).toBe(false);
  });
  it('validates names', async () => {
    const g = await createGoogleUser('g-names', 'names@acme.test');
    expect((await call('registerCompany', { displayName: 'N', companyName: '', planId: 'company_free' }, g)).status).toBe('INVALID_ARGUMENT');
    expect((await call('registerCompany', { displayName: 'N', companyName: 'x'.repeat(121), planId: 'company_free' }, g)).status).toBe('INVALID_ARGUMENT');
    expect((await call('registerCompany', { displayName: '', companyName: 'N', planId: 'company_free' }, g)).status).toBe('INVALID_ARGUMENT');
  });
});

describe('D34 registration safety', () => {
  it('D34-AUTH-009 / 030 registering twice (also concurrently, also across workflows) creates nothing new', async () => {
    const g = await createGoogleUser('g-dup', 'dup@acme.test');
    const [a, b] = await Promise.all([
      call('registerCompany', { displayName: 'D', companyName: 'Dup Co', planId: 'company_free' }, g),
      call('registerCompany', { displayName: 'D', companyName: 'Dup Co 2', planId: 'company_free' }, g),
    ]);
    expect([a, b].filter((r) => r.ok && r.data.created).length).toBe(1);
    expect(await ok('registerIndividual', { displayName: 'D' }, g)).toEqual({ created: false, destination: { kind: 'already_registered', existing: 'company' } });
    expect((await adminDb.collection('companies').where('ownerUid', '==', g.uid).get()).size).toBe(1);
    expect((await adminDb.collection('tenants').where('ownerUid', '==', g.uid).get()).size).toBe(1);
  });
  it('D34-AUTH-031 (Phase 1 scope) both workflows require a Google sign-in', async () => {
    const pw = await createUser('u-pw-reg');
    expect((await call('registerIndividual', { displayName: 'P' }, pw)).status).toBe('PERMISSION_DENIED');
    expect((await call('registerCompany', { displayName: 'P', companyName: 'P', planId: 'company_free' }, pw)).status).toBe('PERMISSION_DENIED');
    expect((await adminDb.doc(`users/${pw.uid}`).get()).exists).toBe(false);
  });
  it('D34-AUTH-023/025 the payload cannot choose role, company, owner, status, claims or payment state', async () => {
    const g = await createGoogleUser('g-forge', 'forge@acme.test');
    for (const extra of [{ role: 'app_owner' }, { companyId: 'co_other' }, { ownerUid: 'someone' }, { status: 'active' }, { platformRole: 'app_owner' }, { paymentStatus: 'PAID' }]) {
      expect((await call('registerCompany', { displayName: 'F', companyName: 'F', planId: 'company_free', ...extra }, g)).status).toBe('INVALID_ARGUMENT');
      expect((await call('registerIndividual', { displayName: 'F', ...extra }, g)).status).toBe('INVALID_ARGUMENT');
    }
    expect((await adminDb.doc(`users/${g.uid}`).get()).exists).toBe(false);
  });
});

describe('D34 resolveSession', () => {
  it('D34-AUTH-001/002/004 reads server records for the token UID', async () => {
    const g = await createGoogleUser('g-co', 'owner@acme.test'); // same sub as above → same UID
    expect(await ok('resolveSession', { intent: 'company_login' }, g)).toEqual({ destination: { kind: 'company_workspace' }, displayName: 'Asha Owner', companyName: 'Acme Ltd' });
  });
  it('D34-AUTH-003/005 an unknown Google identity is not a company admin and gets a genuine no-account state', async () => {
    const g = await createGoogleUser('g-stranger', 'stranger@else.test');
    expect(await ok('resolveSession', { intent: 'company_login' }, g)).toEqual({ destination: { kind: 'not_company_admin' }, displayName: null, companyName: null });
    expect((await ok('resolveSession', { intent: 'individual_login' }, g)).destination).toEqual({ kind: 'no_account' });
  });
  it('D34-AUTH-019/020 existing password accounts (App Owner, company owner) still resolve', async () => {
    const owner = await createUser('u-app-owner', { claims: { platformRole: 'app_owner' } });
    await adminDb.doc('users/u-app-owner').set({ id: 'u-app-owner', role: 'app_owner', status: 'active', companyId: null, employeeId: null, displayName: 'Owner', email: owner.email });
    expect((await ok('resolveSession', { intent: 'company_login' }, owner)).destination).toEqual({ kind: 'app_owner_workspace' });
    const admin = await createUser('u-ift');
    await adminDb.doc('companies/co_u-ift').set({ id: 'co_u-ift', name: 'Existing Co', status: 'active', ownerUid: 'u-ift', planId: 'company_free', kind: 'company' });
    await adminDb.doc('users/u-ift').set({ id: 'u-ift', role: 'company_admin', status: 'active', companyId: 'co_u-ift', employeeId: null, displayName: 'IFT', email: admin.email, accountType: 'company' });
    expect((await ok('resolveSession', { intent: 'company_login' }, admin)).destination).toEqual({ kind: 'company_workspace' });
  });
  it('D34-AUTH-022 a suspended company is restricted', async () => {
    const g = await createGoogleUser('g-susp', 'susp@acme.test');
    await ok('registerCompany', { displayName: 'S', companyName: 'Susp Co', planId: 'company_free' }, g);
    await adminDb.doc(`companies/co_${g.uid}`).update({ status: 'suspended' });
    expect((await ok('resolveSession', { intent: 'company_login' }, g)).destination).toEqual({ kind: 'account_inactive', status: 'suspended' });
  });
});
