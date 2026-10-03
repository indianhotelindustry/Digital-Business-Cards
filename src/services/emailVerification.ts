// ============================================================================
// Email verification (Directive 29)
// ============================================================================
// Firebase Authentication owns the verified state: it sends the link, the
// user opens it, and Firebase marks the account emailVerified. Nothing here
// grants authority.
//
//   * App Owner authority needs BOTH a verified email and the server-set
//     custom claim platformRole == 'app_owner' (src/lib/authority.ts,
//     functions/src/auth/identity.ts). Verifying an email never sets the
//     claim; only scripts/admin/setAppOwner.ts (Admin SDK) does.
//   * The backend reads email_verified from the ID TOKEN. A token minted
//     before verification still says false, so after verification the
//     client must reload the user AND force a new token (refreshVerificationState).
//   * No verification state is cached in browser storage.

import { sendEmailVerification, type User } from 'firebase/auth';

/** Client-side spacing between resend requests (Firebase also rate-limits on the server). */
export const RESEND_COOLDOWN_MS = 60_000;

export type VerificationErrorKind = 'SESSION_EXPIRED' | 'TOO_MANY_REQUESTS' | 'NETWORK' | 'INVALID_LINK' | 'UNKNOWN';

export interface VerificationError {
  kind: VerificationErrorKind;
  code: string | null;
  message: string;
}

const SESSION_CODES = new Set([
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/invalid-user-token',
  'auth/requires-recent-login',
  'auth/no-current-user',
]);

/** Maps a Firebase Auth error to something a user can act on. */
export function describeVerificationError(err: unknown): VerificationError {
  const code = typeof (err as { code?: unknown })?.code === 'string' ? (err as { code: string }).code : null;
  if (code && SESSION_CODES.has(code)) {
    return { kind: 'SESSION_EXPIRED', code, message: 'Your session has expired or this account is no longer active. Please sign in again.' };
  }
  if (code === 'auth/too-many-requests') {
    return { kind: 'TOO_MANY_REQUESTS', code, message: 'Too many verification emails were requested. Please wait a few minutes before trying again.' };
  }
  if (code === 'auth/network-request-failed') {
    return { kind: 'NETWORK', code, message: 'We could not reach the sign-in service. Check your connection and try again.' };
  }
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
    return { kind: 'INVALID_LINK', code, message: 'This verification link is invalid or has expired. Request a new verification email.' };
  }
  return { kind: 'UNKNOWN', code, message: 'Something went wrong while checking your email verification. Please try again.' };
}

export type SendResult = { sent: true } | { sent: false; alreadyVerified: true };

/**
 * Sends (or re-sends) the verification email for the signed-in user. The
 * user is reloaded first so an address verified in another tab is not sent
 * a pointless second link.
 */
export async function sendVerificationEmail(user: User): Promise<SendResult> {
  await user.reload();
  if (user.emailVerified) return { sent: false, alreadyVerified: true };
  await sendEmailVerification(user);
  return { sent: true };
}

export interface VerificationState {
  /** What the backend will see: the email_verified claim of a freshly minted ID token. */
  emailVerified: boolean;
  claims: Record<string, unknown>;
}

/**
 * Re-reads the account from Firebase Auth and forces a new ID token, so the
 * verified state AND the custom claims the backend sees are current.
 */
export async function refreshVerificationState(user: User): Promise<VerificationState> {
  await user.reload();
  const token = await user.getIdTokenResult(true);
  return { emailVerified: token.claims.email_verified === true, claims: token.claims as Record<string, unknown> };
}
