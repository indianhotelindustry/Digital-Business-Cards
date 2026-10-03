// ============================================================================
// DSBC ACCOUNT SERVICE (Directive 30)
// ============================================================================
// Reads the signed-in customer's activation state through the backend. The
// callable needs sign-in but is deliberately not gated on an active account,
// so a pending customer can see "awaiting approval". It returns nothing else.

import { callBackend } from '../lib/backend';

export interface MyAccountState {
  status: string;
  emailVerified: boolean;
}

export const getMyAccountState = (): Promise<MyAccountState> => callBackend<MyAccountState>('getMyAccountState');

/** One pending registration, as returned by adminListPendingCustomers (real fields only). */
export interface PendingCustomer {
  uid: string;
  displayName: string;
  email: string;
  accountType: string;
  companyName: string | null;
  createdAt: string | null;
  emailVerified: boolean;
  status: string;
}

export interface ApproveCustomerInput {
  customerType: 'individual' | 'company';
  customerId: string;
  reason: string;
}

export interface ApproveCustomerResult {
  customerType: 'individual' | 'company';
  customerId: string;
  status: string;
  alreadyActive: boolean;
}

/** App Owner only: pending registrations awaiting activation. */
export const adminListPendingCustomers = (): Promise<{ pending: PendingCustomer[] }> =>
  callBackend<{ pending: PendingCustomer[] }>('adminListPendingCustomers');

/** App Owner only: activates one pending customer; a reason is required. */
export const approveCustomer = (input: ApproveCustomerInput): Promise<ApproveCustomerResult> =>
  callBackend<ApproveCustomerResult>('approveCustomer', { ...input });
