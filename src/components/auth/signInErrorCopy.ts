// Directive 34: fixed sign-in/registration copy for backend failures. The UI
// never shows a raw Cloud Function or SDK message (codes such as "internal" or
// server text); every refusal maps to one of these sentences by error code.
import { BackendError } from '../../lib/backend';

export const SIGN_IN_ERROR_COPY = {
  unreachable: "Can't reach DSBC right now. Please try again.",
  unauthenticated: 'Your sign-in expired. Please continue with Google again.',
  permissionDenied: "This Google account can't do that. Use a different Google account or contact DSBC support.",
  invalidArgument: 'Please check the details and try again.',
  failedPrecondition: 'Paid plans are not available yet. Choose the Free plan.',
} as const;

export function signInErrorCopy(err: unknown): string {
  if (!(err instanceof BackendError)) return SIGN_IN_ERROR_COPY.unreachable;
  switch (err.code) {
    case 'unauthenticated':
      return SIGN_IN_ERROR_COPY.unauthenticated;
    case 'permission-denied':
      return SIGN_IN_ERROR_COPY.permissionDenied;
    case 'invalid-argument':
      return SIGN_IN_ERROR_COPY.invalidArgument;
    // The only failed-precondition the Phase 1 registration callables raise is a non-free plan.
    case 'failed-precondition':
      return SIGN_IN_ERROR_COPY.failedPrecondition;
    default:
      // unavailable, internal, deadline-exceeded, not-found, unknown and anything else.
      return SIGN_IN_ERROR_COPY.unreachable;
  }
}
