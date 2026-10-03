// Directive 29: email verification service. The backend trusts the
// email_verified claim of the ID token, so the client must reload the account
// AND force a new token; sending is skipped for already-verified accounts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmailVerification = vi.fn(async () => undefined);
vi.mock('firebase/auth', () => ({ sendEmailVerification: (...a: unknown[]) => sendEmailVerification(...(a as [])) }));

const { describeVerificationError, refreshVerificationState, sendVerificationEmail, RESEND_COOLDOWN_MS } = await import('../../src/services/emailVerification');

/** A stand-in for firebase/auth User: reload() reveals the server state; tokens are stale unless forced. */
function fakeUser(opts: { serverVerified: boolean; staleTokenVerified?: boolean; claims?: Record<string, unknown> }) {
  const calls: string[] = [];
  const user = {
    emailVerified: false,
    reload: vi.fn(async () => {
      calls.push('reload');
      user.emailVerified = opts.serverVerified;
    }),
    getIdTokenResult: vi.fn(async (force?: boolean) => {
      calls.push(`token:${force === true ? 'forced' : 'cached'}`);
      const verified = force === true ? opts.serverVerified : opts.staleTokenVerified ?? false;
      return { claims: { ...(opts.claims ?? {}), email_verified: verified } };
    }),
  };
  return { user: user as never, calls };
}

beforeEach(() => sendEmailVerification.mockClear());

describe('VERIFY-U01 sending the verification email', () => {
  it('sends to an unverified account after reloading it', async () => {
    const { user, calls } = fakeUser({ serverVerified: false });
    await expect(sendVerificationEmail(user)).resolves.toEqual({ sent: true });
    expect(calls[0]).toBe('reload');
    expect(sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it('does not send to an account that is already verified (e.g. verified in another tab)', async () => {
    const { user } = fakeUser({ serverVerified: true });
    await expect(sendVerificationEmail(user)).resolves.toEqual({ sent: false, alreadyVerified: true });
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('propagates provider errors (the caller maps them)', async () => {
    sendEmailVerification.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/too-many-requests' }));
    const { user } = fakeUser({ serverVerified: false });
    await expect(sendVerificationEmail(user)).rejects.toMatchObject({ code: 'auth/too-many-requests' });
  });

  it('keeps a client-side resend spacing of at least 30 s', () => {
    expect(RESEND_COOLDOWN_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe('VERIFY-U02 refreshing the verified state', () => {
  it('reloads, then forces a new ID token, and reports what that token says', async () => {
    const { user, calls } = fakeUser({ serverVerified: true, staleTokenVerified: false });
    const state = await refreshVerificationState(user);
    expect(calls).toEqual(['reload', 'token:forced']);
    expect(state.emailVerified).toBe(true);
  });

  it('a cached token minted before verification is never trusted', async () => {
    // If refreshVerificationState used the cached token, this account would look unverified forever.
    const { user } = fakeUser({ serverVerified: true, staleTokenVerified: false });
    expect((await refreshVerificationState(user)).emailVerified).toBe(true);
    const { user: unverified } = fakeUser({ serverVerified: false, staleTokenVerified: true });
    expect((await refreshVerificationState(unverified)).emailVerified).toBe(false);
  });

  it('returns the claims of the fresh token and never adds platformRole', async () => {
    const { user } = fakeUser({ serverVerified: true });
    const state = await refreshVerificationState(user);
    expect(state.claims.platformRole).toBeUndefined();
    const { user: owner } = fakeUser({ serverVerified: true, claims: { platformRole: 'app_owner' } });
    expect((await refreshVerificationState(owner)).claims.platformRole).toBe('app_owner');
  });
});

describe('VERIFY-U03 user-facing errors', () => {
  it.each([
    ['auth/user-token-expired', 'SESSION_EXPIRED'],
    ['auth/user-disabled', 'SESSION_EXPIRED'],
    ['auth/user-not-found', 'SESSION_EXPIRED'],
    ['auth/invalid-user-token', 'SESSION_EXPIRED'],
    ['auth/requires-recent-login', 'SESSION_EXPIRED'],
    ['auth/no-current-user', 'SESSION_EXPIRED'],
    ['auth/too-many-requests', 'TOO_MANY_REQUESTS'],
    ['auth/network-request-failed', 'NETWORK'],
    ['auth/invalid-action-code', 'INVALID_LINK'],
    ['auth/expired-action-code', 'INVALID_LINK'],
    ['auth/internal-error', 'UNKNOWN'],
  ])('%s -> %s', (code, kind) => {
    const e = describeVerificationError({ code });
    expect(e.kind).toBe(kind);
    expect(e.code).toBe(code);
    expect(e.message.length).toBeGreaterThan(20);
    expect(e.message).not.toMatch(/auth\//); // no raw Firebase codes shown to users
  });

  it('handles errors without a code', () => {
    expect(describeVerificationError(new Error('boom'))).toMatchObject({ kind: 'UNKNOWN', code: null });
    expect(describeVerificationError(undefined)).toMatchObject({ kind: 'UNKNOWN', code: null });
  });
});
