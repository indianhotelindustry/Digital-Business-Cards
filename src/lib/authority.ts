// ============================================================================
// DSBC CLIENT AUTHORITY DERIVATION (Directive 24 Phase 2)
// ============================================================================
// Decides which role the UI may act as. This is presentation only — Firestore
// rules remain the enforcement point — but the UI must never *display*
// platform authority the backend would not grant:
//
//   * App Owner requires a Firebase session whose ID token carries the
//     server-set claim platformRole == 'app_owner' AND a verified email.
//     users/{uid}.role == 'app_owner' alone is not enough.
//   * Profiles that do not come from a Firebase session (demo personas) are
//     honoured only when demo features are enabled (DEVELOPMENT).

import type { UserRole } from '../types';

export const APP_OWNER_CLAIM = 'platformRole';
export const APP_OWNER_CLAIM_VALUE = 'app_owner';

export interface AuthorityInputs {
  profileRole: UserRole | null | undefined;
  isFirebaseSession: boolean;
  hasVerifiedOwnerClaim: boolean;
  demoFeaturesEnabled: boolean;
}

export function hasVerifiedOwnerClaim(claims: Record<string, unknown> | null | undefined, emailVerified: boolean): boolean {
  return emailVerified === true && claims?.[APP_OWNER_CLAIM] === APP_OWNER_CLAIM_VALUE;
}

export function deriveEffectiveRole(inputs: AuthorityInputs): UserRole | null {
  const role = inputs.profileRole ?? null;
  if (!role) return null;

  if (!inputs.isFirebaseSession) {
    // Demo persona / non-authenticated profile.
    return inputs.demoFeaturesEnabled ? role : null;
  }

  if (role === 'app_owner') {
    return inputs.hasVerifiedOwnerClaim ? 'app_owner' : null;
  }
  return role;
}
