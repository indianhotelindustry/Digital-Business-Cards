import { describe, expect, it } from 'vitest';
import { buildRegistrationDocuments } from '../../src/services/registrationModel';

const T = '2026-10-01T00:00:00.000Z';

describe('buildRegistrationDocuments — individual', () => {
  const docs = buildRegistrationDocuments({ uid: 'u1', email: 'a@b.test', displayName: '  Asha  ', accountType: 'individual', now: T });

  it('creates an independent individual tenant owned by the user', () => {
    expect(docs.tenant).toEqual({ id: 'ind_u1', kind: 'individual', ownerUid: 'u1', companyId: null, status: 'active', createdAt: T });
    expect(docs.company).toBeNull();
  });

  it('derives role/membership; companyId stays null so entitlements resolve as individual', () => {
    expect(docs.user).toMatchObject({ id: 'u1', role: 'employee', companyId: null, employeeId: null, accountType: 'individual', tenantId: 'ind_u1', status: 'active', displayName: 'Asha' });
  });
});

describe('buildRegistrationDocuments — company', () => {
  const docs = buildRegistrationDocuments({ uid: 'u2', email: 'c@d.test', displayName: 'Ravi', accountType: 'company', companyName: 'Ravi Co', now: T });

  it('creates a company tenant whose creator is its administrator', () => {
    expect(docs.user).toMatchObject({ role: 'company_admin', companyId: 'co_u2', tenantId: 'co_u2', accountType: 'company' });
    expect(docs.tenant).toMatchObject({ id: 'co_u2', kind: 'company', ownerUid: 'u2', companyId: 'co_u2' });
  });

  it('always starts on the free company plan, owned by the creator', () => {
    expect(docs.company).toMatchObject({ id: 'co_u2', name: 'Ravi Co', planId: 'company_free', status: 'active', kind: 'company', ownerUid: 'u2' });
  });
});

describe('buildRegistrationDocuments — input that must never influence authority', () => {
  it('ignores any extra role/companyId/plan fields smuggled into the input', () => {
    const smuggled = { uid: 'u3', email: 'e@f.test', displayName: 'X', accountType: 'individual', role: 'app_owner', companyId: 'company_acme', planId: 'individual_pro' } as any;
    const docs = buildRegistrationDocuments(smuggled);
    expect(docs.user.role).toBe('employee');
    expect(docs.user.companyId).toBeNull();
    expect(JSON.stringify(docs)).not.toContain('app_owner');
    expect(JSON.stringify(docs)).not.toContain('company_acme');
    expect(JSON.stringify(docs)).not.toContain('individual_pro');
  });

  it('rejects unknown account types (e.g. an attempt to request "app_owner")', () => {
    expect(() => buildRegistrationDocuments({ uid: 'u4', email: 'g@h.test', displayName: 'X', accountType: 'app_owner' as any })).toThrow(/account type/i);
  });

  it('requires a company name for company accounts and a name for everyone', () => {
    expect(() => buildRegistrationDocuments({ uid: 'u5', email: 'i@j.test', displayName: 'X', accountType: 'company' })).toThrow(/Company name/);
    expect(() => buildRegistrationDocuments({ uid: 'u6', email: 'k@l.test', displayName: '   ', accountType: 'individual' })).toThrow(/Name/);
  });

  it('requires an authenticated uid and email', () => {
    expect(() => buildRegistrationDocuments({ uid: '', email: 'x@y.test', displayName: 'X', accountType: 'individual' })).toThrow();
    expect(() => buildRegistrationDocuments({ uid: 'u7', email: '', displayName: 'X', accountType: 'individual' })).toThrow();
  });
});
