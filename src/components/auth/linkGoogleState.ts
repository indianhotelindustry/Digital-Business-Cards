// ============================================================================
// DSBC LINK GOOGLE — explicit outcome state (Directive 45)
// ============================================================================
// Why this module exists: the first production linking attempt failed silently.
// The banner unmounted on success and said nothing on cancellation, so the
// customer reported the link as done while Firebase still had `password` only.
// Every outcome now has a named state and fixed customer-visible copy, decided
// here as pure logic (no Firebase, no DOM) so it is unit-testable like
// signInErrorCopy. Firebase Auth stays the authority on whether a link happened;
// this module only decides what the customer is told about the result.

export type LinkFailureReason =
  | 'credential_in_use'
  | 'cancelled'
  | 'popup_blocked'
  | 'network'
  | 'not_signed_in'
  | 'other';

export type LinkGoogleStateValue =
  | { kind: 'ready' }
  | { kind: 'linking' }
  | { kind: 'redirecting' }
  | { kind: 'linked'; email: string | null }
  | { kind: 'already_linked'; email: string | null }
  | { kind: 'failed'; reason: LinkFailureReason };

export const LINK_GOOGLE_COPY = {
  ready: 'DSBC is moving to Google sign-in. Link the Google account you will use, so you keep this same account and data.',
  linking: 'Linking Google account…',
  redirecting: 'Continue with Google to link your account.',
  linkedDetail: 'You can now sign in with Google using this account.',
  credentialInUse: 'That Google account is already linked to another DSBC account. Please contact the administrator.',
  cancelled: 'Google linking was cancelled. Your account has not been changed.',
  popupBlocked: 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  network: 'Google could not be linked right now. Please try again.',
  notSignedIn: 'Please sign in first, then link Google.',
  other: 'Google could not be linked. Please try again.',
} as const;

const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);
const IN_USE = new Set(['auth/credential-already-in-use', 'auth/account-exists-with-different-credential']);
const NETWORK = new Set(['auth/network-request-failed', 'auth/too-many-requests']);

/**
 * Classify a Firebase auth error code. `auth/provider-already-linked` is not a
 * failure — it means the desired end state already holds — so it maps to
 * 'already_linked' and the caller shows the linked state rather than an error.
 */
export function linkFailureFromCode(code: string): LinkFailureReason | 'already_linked' {
  if (code === 'auth/provider-already-linked') return 'already_linked';
  if (IN_USE.has(code)) return 'credential_in_use';
  if (CANCELLED.has(code)) return 'cancelled';
  if (code === 'auth/popup-blocked') return 'popup_blocked';
  if (NETWORK.has(code)) return 'network';
  if (code === 'auth/no-current-user') return 'not_signed_in';
  return 'other';
}

const FAILURE_COPY: Record<LinkFailureReason, string> = {
  credential_in_use: LINK_GOOGLE_COPY.credentialInUse,
  cancelled: LINK_GOOGLE_COPY.cancelled,
  popup_blocked: LINK_GOOGLE_COPY.popupBlocked,
  network: LINK_GOOGLE_COPY.network,
  not_signed_in: LINK_GOOGLE_COPY.notSignedIn,
  other: LINK_GOOGLE_COPY.other,
};

export interface LinkGoogleViewModel {
  message: string;
  detail: string | null;
  /** null hides the action: success states must not keep offering "Link Google". */
  actionLabel: string | null;
  busy: boolean;
  tone: 'prompt' | 'success' | 'error';
}

/** The single place that decides what the customer sees for a given state. */
export function linkGoogleView(state: LinkGoogleStateValue): LinkGoogleViewModel {
  switch (state.kind) {
    case 'ready':
      return { message: LINK_GOOGLE_COPY.ready, detail: null, actionLabel: 'Link Google', busy: false, tone: 'prompt' };
    case 'linking':
      return { message: LINK_GOOGLE_COPY.linking, detail: null, actionLabel: 'Link Google', busy: true, tone: 'prompt' };
    case 'redirecting':
      return { message: LINK_GOOGLE_COPY.redirecting, detail: null, actionLabel: 'Link Google', busy: true, tone: 'prompt' };
    case 'linked':
      return {
        message: state.email ? `Google account linked successfully. ${state.email} is now linked.` : 'Google account linked successfully.',
        detail: LINK_GOOGLE_COPY.linkedDetail,
        actionLabel: null,
        busy: false,
        tone: 'success',
      };
    case 'already_linked':
      return {
        message: state.email ? `Google account already linked. ${state.email}` : 'Google account already linked.',
        detail: null,
        actionLabel: null,
        busy: false,
        tone: 'success',
      };
    case 'failed':
      return { message: FAILURE_COPY[state.reason], detail: null, actionLabel: 'Link Google', busy: false, tone: 'error' };
  }
}
