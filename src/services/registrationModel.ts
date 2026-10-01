// ============================================================================
// DSBC REGISTRATION DOCUMENT MODEL (Directive 24 Phase 2)
// ============================================================================
// Pure builder for the documents a new account writes in its single
// registration batch. The client supplies identity and the *requested*
// account type only. Role, tenant id, company id and plan are derived here
// and independently re-checked by firestore.rules, so a modified client
// cannot choose them:
//
//   individual -> users/{uid}  role 'employee', companyId null, tenant ind_<uid>
//                 tenants/ind_<uid>
//   company    -> users/{uid}  role 'company_admin', companyId co_<uid>
//                 tenants/co_<uid>, companies/co_<uid> (plan company_free)
//
// App Owner can never be produced by registration.

import type { AccountType, Company, UserProfile } from '../types';

export interface TenantRecord {
  id: string;
  kind: AccountType;
  ownerUid: string;
  companyId: string | null;
  status: 'active';
  createdAt: string;
}

export interface RegistrationInput {
  uid: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  companyName?: string;
  now?: string;
}

export interface RegistrationDocuments {
  user: UserProfile;
  tenant: TenantRecord;
  company: Company | null;
}

export const individualTenantId = (uid: string) => `ind_${uid}`;
export const companyTenantId = (uid: string) => `co_${uid}`;
export const DEFAULT_COMPANY_PLAN_ID = 'company_free';
export const MAX_NAME_LENGTH = 120;

function requireName(value: string | undefined, label: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error(`${label} must be at most ${MAX_NAME_LENGTH} characters.`);
  return trimmed;
}

export function buildRegistrationDocuments(input: RegistrationInput): RegistrationDocuments {
  if (!input.uid) throw new Error('Registration requires an authenticated user.');
  if (!input.email) throw new Error('Registration requires a verified email identity.');
  if (input.accountType !== 'individual' && input.accountType !== 'company') {
    throw new Error('Unknown account type.');
  }

  const uid = input.uid;
  const displayName = requireName(input.displayName, 'Name');
  const now = input.now ?? new Date().toISOString();

  if (input.accountType === 'individual') {
    const tenantId = individualTenantId(uid);
    return {
      user: {
        id: uid,
        email: input.email,
        displayName,
        role: 'employee',
        companyId: null,
        employeeId: null,
        status: 'active',
        accountType: 'individual',
        tenantId,
        createdAt: now,
        updatedAt: now,
      },
      tenant: { id: tenantId, kind: 'individual', ownerUid: uid, companyId: null, status: 'active', createdAt: now },
      company: null,
    };
  }

  const companyName = requireName(input.companyName, 'Company name');
  const companyId = companyTenantId(uid);
  return {
    user: {
      id: uid,
      email: input.email,
      displayName,
      role: 'company_admin',
      companyId,
      employeeId: null,
      status: 'active',
      accountType: 'company',
      tenantId: companyId,
      createdAt: now,
      updatedAt: now,
    },
    tenant: { id: companyId, kind: 'company', ownerUid: uid, companyId, status: 'active', createdAt: now },
    company: {
      id: companyId,
      name: companyName,
      legalName: companyName,
      website: '',
      email: input.email,
      phone: '',
      address: '',
      description: '',
      branding: { primaryColor: '#0f766e' },
      status: 'active',
      planId: DEFAULT_COMPANY_PLAN_ID,
      kind: 'company',
      ownerUid: uid,
      createdAt: now,
      updatedAt: now,
    },
  };
}
