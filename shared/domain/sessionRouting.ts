// Directive 34 Phase 1: where a signed-in Google identity goes. Pure; the
// backend feeds it server records (never browser state). The intent is only
// the entry point the person chose; it never grants anything.
export type SessionIntent = 'company_login' | 'individual_login' | 'register_company' | 'create_free_card';
export const SESSION_INTENTS: readonly SessionIntent[] = ['company_login', 'individual_login', 'register_company', 'create_free_card'];

export interface SessionFacts {
  isAppOwner: boolean;
  profile: null | { role: string | null; accountType: string | null; status: string | null; companyId: string | null };
  companyStatus: string | null;
}

export type Destination =
  | { kind: 'app_owner_workspace' }
  | { kind: 'company_workspace' }
  | { kind: 'employee_workspace' }
  | { kind: 'individual_workspace' }
  | { kind: 'register_company' }
  | { kind: 'register_individual' }
  | { kind: 'already_registered'; existing: 'company' | 'individual' | 'employee' }
  | { kind: 'not_company_admin' }
  | { kind: 'no_account' }
  | { kind: 'account_inactive'; status: string };

const normalised = (status: string | null) => (status === 'pending_approval' ? 'pending_activation' : status || 'pending_activation');

export function resolveDestination(intent: SessionIntent, facts: SessionFacts): Destination {
  if (facts.isAppOwner) return { kind: 'app_owner_workspace' };
  const p = facts.profile;
  if (!p) {
    if (intent === 'register_company') return { kind: 'register_company' };
    if (intent === 'create_free_card') return { kind: 'register_individual' };
    return intent === 'company_login' ? { kind: 'not_company_admin' } : { kind: 'no_account' };
  }
  if (p.status !== 'active') return { kind: 'account_inactive', status: normalised(p.status) };
  if (p.companyId && facts.companyStatus !== 'active') return { kind: 'account_inactive', status: normalised(facts.companyStatus) };

  const existing: 'company' | 'individual' | 'employee' =
    p.role === 'company_admin' ? 'company' : p.accountType === 'individual' && !p.companyId ? 'individual' : 'employee';
  if (intent === 'register_company' || intent === 'create_free_card') return { kind: 'already_registered', existing };
  if (existing === 'company') return { kind: 'company_workspace' };
  if (intent === 'company_login') return { kind: 'not_company_admin' };
  return existing === 'individual' ? { kind: 'individual_workspace' } : { kind: 'employee_workspace' };
}
