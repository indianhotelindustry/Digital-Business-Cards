import { beforeAll, describe, expect, it } from 'vitest';
import { call, createGoogleUser, createUser, ok, resetEmulators } from './support/backendEnv';

beforeAll(async () => {
  await resetEmulators();
});

describe('D34 account state', () => {
  it('a signed-in identity without a DSBC profile is no_account, not pending approval', async () => {
    const g = await createGoogleUser('g-no-profile', 'nobody@example.test');
    expect(await ok('getMyAccountState', {}, g)).toEqual({ status: 'no_account', emailVerified: true });
  });
  it('a Google identity carries sign_in_provider google.com in its ID token', async () => {
    const g = await createGoogleUser('g-provider', 'provider@example.test');
    const payload = JSON.parse(Buffer.from(g.token.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.firebase.sign_in_provider).toBe('google.com');
  });
  it('getMyAccountState still requires sign-in', async () => {
    expect((await call('getMyAccountState', {}, null)).status).toBe('UNAUTHENTICATED');
  });
  it('a password identity is still accepted in Phase 1', async () => {
    const u = await createUser('u-pw');
    expect((await ok('getMyAccountState', {}, u)).status).toBe('no_account');
  });
});
