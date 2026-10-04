import { describe, expect, it, vi } from 'vitest';

// lib/backend imports the Firebase client instance; the mapping needs only the error class.
vi.mock('../../src/lib/firebase', () => ({ functions: {} }));

const { BackendError } = await import('../../src/lib/backend');
const { signInErrorCopy, SIGN_IN_ERROR_COPY } = await import('../../src/components/auth/signInErrorCopy');

const RAW = 'Firebase: auth/internal-error raw server text ALREADY_EXISTS tenant co_123';
const backend = (code: string) => new BackendError(code, RAW, { raw: RAW });

describe('signInErrorCopy (D34: no raw backend or SDK text on the sign-in screen)', () => {
  it.each([
    ['unavailable', SIGN_IN_ERROR_COPY.unreachable],
    ['internal', SIGN_IN_ERROR_COPY.unreachable],
    ['deadline-exceeded', SIGN_IN_ERROR_COPY.unreachable],
    ['not-found', SIGN_IN_ERROR_COPY.unreachable],
    ['unknown', SIGN_IN_ERROR_COPY.unreachable],
    ['already-exists', SIGN_IN_ERROR_COPY.unreachable],
    ['unauthenticated', SIGN_IN_ERROR_COPY.unauthenticated],
    ['permission-denied', SIGN_IN_ERROR_COPY.permissionDenied],
    ['invalid-argument', SIGN_IN_ERROR_COPY.invalidArgument],
    ['failed-precondition', SIGN_IN_ERROR_COPY.failedPrecondition],
  ])('BackendError %s maps to fixed copy', (code, expected) => {
    expect(signInErrorCopy(backend(code))).toBe(expected);
  });

  it('exact copy for each mapping', () => {
    expect(SIGN_IN_ERROR_COPY).toEqual({
      unreachable: "Can't reach DSBC right now. Please try again.",
      unauthenticated: 'Your sign-in expired. Please continue with Google again.',
      permissionDenied: "This Google account can't do that. Use a different Google account or contact DSBC support.",
      invalidArgument: 'Please check the details and try again.',
      failedPrecondition: 'Paid plans are not available yet. Choose the Free plan.',
    });
  });

  it.each([
    ['a plain Error', new Error(RAW)],
    ['an SDK-shaped error', Object.assign(new Error(RAW), { code: 'functions/internal' })],
    ['a string', RAW],
    ['undefined', undefined],
  ])('non-BackendError (%s) maps to the unreachable copy', (_label, err) => {
    expect(signInErrorCopy(err)).toBe(SIGN_IN_ERROR_COPY.unreachable);
  });

  it('no output contains Firebase, auth/, internal or the raw server message', () => {
    const codes = ['unavailable', 'internal', 'deadline-exceeded', 'not-found', 'unknown', 'unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition', 'resource-exhausted'];
    const outputs = [...codes.map((c) => signInErrorCopy(backend(c))), signInErrorCopy(new Error(RAW)), signInErrorCopy(RAW)];
    for (const out of outputs) {
      expect(out).not.toMatch(/Firebase/i);
      expect(out).not.toContain('auth/');
      expect(out).not.toMatch(/internal/i);
      expect(out).not.toContain(RAW);
      expect(out).not.toContain('ALREADY_EXISTS');
    }
  });
});
