import { beforeEach, describe, expect, it, vi } from 'vitest';

// The service imports the Firebase client instance, which resolves the deployment
// environment at import time; the tests supply a mutable stand-in instead.
const authStub = vi.hoisted(() => ({ currentUser: null as unknown }));
vi.mock('../../src/lib/firebase', () => ({ auth: authStub }));

const signInWithPopup = vi.fn();
const signInWithRedirect = vi.fn();
const getRedirectResult = vi.fn();
const linkWithPopup = vi.fn();
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  signInWithRedirect: (...a: unknown[]) => signInWithRedirect(...a),
  getRedirectResult: (...a: unknown[]) => getRedirectResult(...a),
  linkWithPopup: (...a: unknown[]) => linkWithPopup(...a),
}));

const { describeGoogleError, hasGoogleProvider, signInWithGoogle, completeGoogleRedirect, linkGoogleToCurrentUser } = await import(
  '../../src/services/googleAuthService'
);

const store = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
  authStub.currentUser = null;
  signInWithPopup.mockReset();
  signInWithRedirect.mockReset();
  getRedirectResult.mockReset();
  linkWithPopup.mockReset();
});

describe('google auth service (pure helpers)', () => {
  it('cancellation is quiet', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      expect(describeGoogleError({ code })).toMatchObject({ cancelled: true });
    }
  });
  it('an email that already has a DSBC account is told to sign in once and link, never merged', () => {
    const e = describeGoogleError({ code: 'auth/account-exists-with-different-credential' });
    expect(e.cancelled).toBe(false);
    expect(e.message).toMatch(/existing account/i);
    expect(e.message).toMatch(/link/i);
  });
  it('a Google account already used by another sign-in is never merged', () => {
    expect(describeGoogleError({ code: 'auth/credential-already-in-use' }).message).toMatch(/different Google account/i);
  });
  it('raw Firebase text never reaches the user', () => {
    const e = describeGoogleError({ code: 'auth/internal-error', message: 'Firebase: INTERNAL ASSERTION FAILED (auth/internal-error).' });
    expect(e.message).not.toMatch(/Firebase|auth\//);
  });
  it('popup-blocked and not-signed-in have friendly guidance without raw codes', () => {
    const blocked = describeGoogleError({ code: 'auth/popup-blocked' });
    expect(blocked.message).toBe('Your browser blocked the Google window. Allow pop-ups for this site and try again.');
    const noUser = describeGoogleError({ code: 'auth/no-current-user' });
    expect(noUser.message).toBe('Please sign in first.');
    for (const e of [blocked, noUser]) {
      expect(e.cancelled).toBe(false);
      expect(e.message).not.toMatch(/Firebase|auth\//);
    }
  });
  it('detects a linked Google provider', () => {
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }] } as never)).toBe(false);
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] } as never)).toBe(true);
    expect(hasGoogleProvider(null)).toBe(false);
  });
});

describe('signInWithGoogle', () => {
  it('returns the popup user on success', async () => {
    const user = { uid: 'u1' };
    signInWithPopup.mockResolvedValue({ user });
    await expect(signInWithGoogle('create_free_card')).resolves.toBe(user);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-environment'])('%s falls back to redirect and remembers the intent', async (code) => {
    signInWithPopup.mockRejectedValue({ code });
    signInWithRedirect.mockResolvedValue(undefined);
    await expect(signInWithGoogle('register_company')).resolves.toBe('redirecting');
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(store.get('dsbc_google_intent')).toBe('register_company');
  });

  it('a non-fallback error is re-thrown and no redirect starts', async () => {
    const err = { code: 'auth/popup-closed-by-user' };
    signInWithPopup.mockRejectedValue(err);
    await expect(signInWithGoogle('company_login')).rejects.toBe(err);
    expect(signInWithRedirect).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });
});

describe('completeGoogleRedirect', () => {
  it('returns the user with the stored intent and removes it', async () => {
    const user = { uid: 'u2' };
    getRedirectResult.mockResolvedValue({ user });
    store.set('dsbc_google_intent', 'individual_login');
    await expect(completeGoogleRedirect()).resolves.toEqual({ user, intent: 'individual_login' });
    expect(store.has('dsbc_google_intent')).toBe(false);
  });

  it('a tampered stored intent becomes null', async () => {
    const user = { uid: 'u3' };
    getRedirectResult.mockResolvedValue({ user });
    store.set('dsbc_google_intent', 'platform_admin');
    await expect(completeGoogleRedirect()).resolves.toEqual({ user, intent: null });
    expect(store.has('dsbc_google_intent')).toBe(false);
  });

  it('returns null when there is no redirect result', async () => {
    getRedirectResult.mockResolvedValue(null);
    store.set('dsbc_google_intent', 'company_login');
    await expect(completeGoogleRedirect()).resolves.toBeNull();
  });
});

describe('linkGoogleToCurrentUser', () => {
  it('throws auth/no-current-user when nobody is signed in', async () => {
    await expect(linkGoogleToCurrentUser()).rejects.toMatchObject({ code: 'auth/no-current-user' });
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  // D45: the caller must be able to NAME the linked Google account in the success
  // message, so the outcome carries the email instead of a bare string.
  it('is a no-op when Google is already linked, and reports the linked Google email', async () => {
    authStub.currentUser = { providerData: [{ providerId: 'password' }, { providerId: 'google.com', email: 'kavya@saffron-studio.test' }], getIdToken: vi.fn() };
    await expect(linkGoogleToCurrentUser()).resolves.toEqual({ outcome: 'already_linked', email: 'kavya@saffron-studio.test' });
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  it('links to the current user (same UID), refreshes the token, and reports the linked Google email', async () => {
    const getIdToken = vi.fn(async () => 'token');
    const user = { providerData: [{ providerId: 'password' }], getIdToken };
    authStub.currentUser = user;
    const linked = { providerData: [{ providerId: 'password' }, { providerId: 'google.com', email: 'kavya@saffron-studio.test' }], getIdToken };
    linkWithPopup.mockResolvedValue({ user: linked });
    await expect(linkGoogleToCurrentUser()).resolves.toEqual({ outcome: 'linked', email: 'kavya@saffron-studio.test' });
    expect(linkWithPopup).toHaveBeenCalledTimes(1);
    expect(linkWithPopup.mock.calls[0][0]).toBe(user);
    expect(getIdToken).toHaveBeenCalledWith(true);
  });

  it('reports a null email when Google exposes none, so the caller still confirms success', async () => {
    const getIdToken = vi.fn(async () => 'token');
    const user = { providerData: [{ providerId: 'password' }], getIdToken };
    authStub.currentUser = user;
    linkWithPopup.mockResolvedValue({ user: { providerData: [{ providerId: 'google.com' }], getIdToken } });
    await expect(linkGoogleToCurrentUser()).resolves.toEqual({ outcome: 'linked', email: null });
  });
});
