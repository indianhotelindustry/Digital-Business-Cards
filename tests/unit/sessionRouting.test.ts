import { describe, expect, it } from 'vitest';
import { resolveDestination, type SessionFacts } from '../../shared/domain/sessionRouting';

const none: SessionFacts = { isAppOwner: false, profile: null, companyStatus: null };
const admin = (status = 'active', companyStatus = 'active'): SessionFacts => ({
  isAppOwner: false, companyStatus,
  profile: { role: 'company_admin', accountType: 'company', status, companyId: 'co_x' },
});
const employee: SessionFacts = { isAppOwner: false, companyStatus: 'active', profile: { role: 'employee', accountType: 'company', status: 'active', companyId: 'co_x' } };
const individual: SessionFacts = { isAppOwner: false, companyStatus: null, profile: { role: 'employee', accountType: 'individual', status: 'active', companyId: null } };
const owner: SessionFacts = { isAppOwner: true, companyStatus: null, profile: { role: 'app_owner', accountType: null, status: 'active', companyId: null } };

describe('D34 session routing', () => {
  it('D34-AUTH-003 unknown Google user: company login is refused, individual login has no account', () => {
    expect(resolveDestination('company_login', none)).toEqual({ kind: 'not_company_admin' });
    expect(resolveDestination('individual_login', none)).toEqual({ kind: 'no_account' });
  });
  it('unknown Google user may register', () => {
    expect(resolveDestination('register_company', none)).toEqual({ kind: 'register_company' });
    expect(resolveDestination('create_free_card', none)).toEqual({ kind: 'register_individual' });
  });
  it('D34-AUTH-004 company owner/admin enters the company workspace', () => {
    expect(resolveDestination('company_login', admin())).toEqual({ kind: 'company_workspace' });
  });
  it('D34-AUTH-005 an employee is not a company admin', () => {
    expect(resolveDestination('company_login', employee)).toEqual({ kind: 'not_company_admin' });
    expect(resolveDestination('individual_login', employee)).toEqual({ kind: 'employee_workspace' });
  });
  it('individuals enter the individual workspace', () => {
    expect(resolveDestination('individual_login', individual)).toEqual({ kind: 'individual_workspace' });
  });
  it('a company admin using "Join / Login to Account" is sent to their real context', () => {
    expect(resolveDestination('individual_login', admin())).toEqual({ kind: 'company_workspace' });
  });
  it('D34-AUTH-009 existing accounts never register again', () => {
    expect(resolveDestination('register_company', admin())).toEqual({ kind: 'already_registered', existing: 'company' });
    expect(resolveDestination('create_free_card', admin())).toEqual({ kind: 'already_registered', existing: 'company' });
    expect(resolveDestination('register_company', individual)).toEqual({ kind: 'already_registered', existing: 'individual' });
    expect(resolveDestination('create_free_card', employee)).toEqual({ kind: 'already_registered', existing: 'employee' });
  });
  it('D34-AUTH-022 inactive accounts and suspended companies are restricted for every intent', () => {
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card'] as const) {
      expect(resolveDestination(intent, admin('suspended'))).toEqual({ kind: 'account_inactive', status: 'suspended' });
      expect(resolveDestination(intent, admin('active', 'suspended'))).toEqual({ kind: 'account_inactive', status: 'suspended' });
    }
  });
  it('legacy pending_approval is reported as pending_activation', () => {
    expect(resolveDestination('company_login', admin('pending_approval'))).toEqual({ kind: 'account_inactive', status: 'pending_activation' });
  });
  it('D34-AUTH-019 the App Owner always reaches the App Owner workspace', () => {
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card'] as const) {
      expect(resolveDestination(intent, owner)).toEqual({ kind: 'app_owner_workspace' });
    }
  });
});
