// ============================================================================
// Google authentication (Directive 34 Phase 1)
// ============================================================================
// The ONE place DSBC talks to the Firebase Google provider. Every entry point
// (company login, join/login, register company, create free card) uses it;
// the intent only tells the app which screen to show next — the backend
// decides what the identity may do (resolveSession).
import { getRedirectResult, GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithRedirect, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { SessionIntent } from '../../shared/domain/sessionRouting';
import { SESSION_INTENTS } from '../../shared/domain/sessionRouting';

const INTENT_KEY = 'dsbc_google_intent'; // UI hint across a redirect only; never authority

function provider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

const REDIRECT_FALLBACK = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported']);

export async function signInWithGoogle(intent: SessionIntent): Promise<User | 'redirecting'> {
  try {
    return (await signInWithPopup(auth, provider())).user;
  } catch (err) {
    if (!REDIRECT_FALLBACK.has((err as { code?: string }).code || '')) throw err;
    try {
      sessionStorage.setItem(INTENT_KEY, intent);
    } catch {
      /* storage unavailable: the user re-chooses the entry point after returning */
    }
    await signInWithRedirect(auth, provider());
    return 'redirecting';
  }
}

export async function completeGoogleRedirect(): Promise<{ user: User; intent: SessionIntent | null } | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  let intent: SessionIntent | null = null;
  try {
    const stored = sessionStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    intent = SESSION_INTENTS.includes(stored as SessionIntent) ? (stored as SessionIntent) : null;
  } catch {
    intent = null;
  }
  return { user: result.user, intent };
}

/** Link Google to the signed-in (password) account: same Firebase UID, user-mediated, never by email matching. */
export async function linkGoogleToCurrentUser(): Promise<'linked' | 'already_linked'> {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/no-current-user' });
  if (hasGoogleProvider(user)) return 'already_linked';
  await linkWithPopup(user, provider());
  await user.getIdToken(true);
  return 'linked';
}

export function hasGoogleProvider(user: Pick<User, 'providerData'> | null): boolean {
  return !!user?.providerData?.some((p) => p?.providerId === 'google.com');
}

const MESSAGES: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'This email already has a DSBC account. Use "Existing account? Sign in with email" once, then choose "Link Google" — your account and data stay the same.',
  'auth/credential-already-in-use': 'That Google account is already used by a different DSBC sign-in. Choose a different Google account.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/no-current-user': 'Please sign in first.',
  'auth/provider-already-linked': 'Google is already linked to this account.',
  'auth/unauthorized-domain': 'Google sign-in is not available on this address. Please use the official DSBC link.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact DSBC support.',
};
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

export function describeGoogleError(err: unknown): { code: string; message: string; cancelled: boolean } {
  const code = (err as { code?: string })?.code || 'unknown';
  if (CANCELLED.has(code)) return { code, message: 'Google sign-in was cancelled.', cancelled: true };
  return { code, message: MESSAGES[code] || 'Google sign-in did not complete. Please try again.', cancelled: false };
}
