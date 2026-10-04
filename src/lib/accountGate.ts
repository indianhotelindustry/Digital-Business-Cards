// ============================================================================
// DSBC ACCOUNT GATE (Directive 30)
// ============================================================================
// Pure decisions about the customer activation gate, kept free of React and
// Firebase so they can be unit-tested directly. The backend is the authority
// (every customer callable and Firestore rule requires an active account);
// this only decides what the browser shows.

/** Status a new self-registered customer holds until the App Owner approves. */
export const PENDING_APPROVAL_STATUS = 'pending_approval';

export function isPendingApproval(status: string | null): boolean {
  return status === PENDING_APPROVAL_STATUS;
}

/**
 * True when the awaiting-approval screen must replace the workspace.
 * Status alone decides: an unknown status (signed out, not fetched yet or a
 * failed lookup) never shows it, and the backend still refuses every request.
 * `no_account` (a signed-in identity with no DSBC profile yet) is NOT "awaiting":
 * this screen is only for `pending_approval`.
 */
export function shouldShowAwaitingApproval(status: string | null, _emailVerified: boolean): boolean {
  return isPendingApproval(status);
}
