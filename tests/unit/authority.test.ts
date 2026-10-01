import { describe, expect, it } from 'vitest';
import { deriveEffectiveRole, hasVerifiedOwnerClaim } from '../../src/lib/authority';

const firebase = { isFirebaseSession: true, demoFeaturesEnabled: false };

describe('hasVerifiedOwnerClaim', () => {
  it('requires both the platformRole claim and a verified email', () => {
    expect(hasVerifiedOwnerClaim({ platformRole: 'app_owner' }, true)).toBe(true);
    expect(hasVerifiedOwnerClaim({ platformRole: 'app_owner' }, false)).toBe(false);
    expect(hasVerifiedOwnerClaim({}, true)).toBe(false);
    expect(hasVerifiedOwnerClaim({ platformRole: 'APP_OWNER' }, true)).toBe(false);
    expect(hasVerifiedOwnerClaim({ role: 'app_owner' }, true)).toBe(false);
    expect(hasVerifiedOwnerClaim(null, true)).toBe(false);
  });
});

describe('deriveEffectiveRole — Firebase sessions', () => {
  it('grants App Owner only with a verified claim', () => {
    expect(deriveEffectiveRole({ ...firebase, profileRole: 'app_owner', hasVerifiedOwnerClaim: true })).toBe('app_owner');
  });

  it('does NOT grant App Owner from users/{uid}.role alone', () => {
    expect(deriveEffectiveRole({ ...firebase, profileRole: 'app_owner', hasVerifiedOwnerClaim: false })).toBeNull();
  });

  it('keeps tenant roles from the authoritative profile', () => {
    expect(deriveEffectiveRole({ ...firebase, profileRole: 'company_admin', hasVerifiedOwnerClaim: false })).toBe('company_admin');
    expect(deriveEffectiveRole({ ...firebase, profileRole: 'employee', hasVerifiedOwnerClaim: false })).toBe('employee');
  });

  it('returns null when there is no profile', () => {
    expect(deriveEffectiveRole({ ...firebase, profileRole: null, hasVerifiedOwnerClaim: true })).toBeNull();
  });
});

describe('deriveEffectiveRole — demo personas (non-Firebase profiles)', () => {
  it('are ignored outside DEVELOPMENT, including App Owner', () => {
    for (const role of ['app_owner', 'company_admin', 'employee'] as const) {
      expect(deriveEffectiveRole({ profileRole: role, isFirebaseSession: false, hasVerifiedOwnerClaim: false, demoFeaturesEnabled: false })).toBeNull();
    }
  });

  it('are honoured in DEVELOPMENT', () => {
    expect(deriveEffectiveRole({ profileRole: 'app_owner', isFirebaseSession: false, hasVerifiedOwnerClaim: false, demoFeaturesEnabled: true })).toBe('app_owner');
  });
});
