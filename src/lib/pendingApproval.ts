// ============================================================================
// DSBC PENDING APPROVAL (Directive 30)
// ============================================================================
// Pure decisions for the App Owner pending-customers queue, kept free of React
// and Firebase so they can be unit-tested directly. The backend remains the
// authority (approveCustomer re-validates the reason, the caller and the
// customer's verified email).

import { companyTenantId } from '../services/registrationModel';

/** Approve stays disabled until the App Owner has written a non-blank reason. */
export function canSubmitApproval(reason: string): boolean {
  return reason.trim().length > 0;
}

export interface ApprovalTarget {
  customerType: 'individual' | 'company';
  customerId: string;
}

/**
 * Maps a pending-list row to the approveCustomer target: an individual is
 * identified by its uid, a company by its co_<uid> tenant/company id.
 */
export function approvalTargetFor(row: { uid: string; accountType: string }): ApprovalTarget {
  return row.accountType === 'company'
    ? { customerType: 'company', customerId: companyTenantId(row.uid) }
    : { customerType: 'individual', customerId: row.uid };
}
