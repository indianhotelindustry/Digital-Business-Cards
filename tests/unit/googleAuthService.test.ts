import { describe, expect, it, vi } from 'vitest';

// The service imports the Firebase client instance, which resolves the deployment
// environment at import time; the pure helpers under test do not need it.
vi.mock('../../src/lib/firebase', () => ({ auth: {} }));

const { describeGoogleError, hasGoogleProvider } = await import('../../src/services/googleAuthService');

describe('google auth service', () => {
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
  it('detects a linked Google provider', () => {
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }] } as never)).toBe(false);
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] } as never)).toBe(true);
    expect(hasGoogleProvider(null)).toBe(false);
  });
});
