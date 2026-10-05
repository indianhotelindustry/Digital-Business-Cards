// Directive 45: the Link Google action must report an explicit outcome for every
// case. The production incident was a silent success — the banner unmounted on
// success and the customer could not tell a completed link from an abandoned one.
// These tests pin the state machine and the exact customer-visible copy. Pure
// logic only, like signInErrorCopy: no Firebase import, no DOM.
import { describe, expect, it } from 'vitest';

const { LINK_GOOGLE_COPY, linkFailureFromCode, linkGoogleView } = await import(
  '../../src/components/auth/linkGoogleState'
);

describe('linkFailureFromCode (D45: every Google linking failure maps to a named reason)', () => {
  it.each([
    ['auth/credential-already-in-use', 'credential_in_use'],
    ['auth/account-exists-with-different-credential', 'credential_in_use'],
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/cancelled-popup-request', 'cancelled'],
    ['auth/user-cancelled', 'cancelled'],
    ['auth/popup-blocked', 'popup_blocked'],
    ['auth/network-request-failed', 'network'],
    ['auth/too-many-requests', 'network'],
    ['auth/no-current-user', 'not_signed_in'],
    ['auth/internal-error', 'other'],
    ['unknown', 'other'],
  ])('%s -> %s', (code, reason) => {
    expect(linkFailureFromCode(code)).toBe(reason);
  });

  it('a provider-already-linked error is not a failure: it is the already-linked state', () => {
    expect(linkFailureFromCode('auth/provider-already-linked')).toBe('already_linked');
  });
});

describe('linkGoogleView (D45: explicit state for every outcome)', () => {
  it('ready offers the action and claims nothing', () => {
    const v = linkGoogleView({ kind: 'ready' });
    expect(v.actionLabel).toBe('Link Google');
    expect(v.busy).toBe(false);
    expect(v.tone).toBe('prompt');
    expect(v.message).toBe(LINK_GOOGLE_COPY.ready);
  });

  it('linking shows a visible in-progress state, not a silent disabled button', () => {
    const v = linkGoogleView({ kind: 'linking' });
    expect(v.message).toBe(LINK_GOOGLE_COPY.linking);
    expect(v.busy).toBe(true);
    // The action stays rendered so the control does not disappear mid-flight.
    expect(v.actionLabel).toBe('Link Google');
  });

  it('linked states success explicitly and names the linked Google account', () => {
    const v = linkGoogleView({ kind: 'linked', email: 'sales@infuturetechnologies.com' });
    expect(v.tone).toBe('success');
    expect(v.message).toContain('Google account linked successfully.');
    expect(v.message).toContain('sales@infuturetechnologies.com');
    expect(v.detail).toBe(LINK_GOOGLE_COPY.linkedDetail);
    // Success must not keep offering the action.
    expect(v.actionLabel).toBeNull();
  });

  it('linked without a readable email still confirms success', () => {
    const v = linkGoogleView({ kind: 'linked', email: null });
    expect(v.tone).toBe('success');
    expect(v.message).toBe('Google account linked successfully.');
    expect(v.actionLabel).toBeNull();
  });

  it('already_linked never offers a misleading Link Google action', () => {
    const v = linkGoogleView({ kind: 'already_linked', email: 'sales@infuturetechnologies.com' });
    expect(v.tone).toBe('success');
    expect(v.message).toContain('Google account already linked.');
    expect(v.message).toContain('sales@infuturetechnologies.com');
    expect(v.actionLabel).toBeNull();
  });

  it.each([
    ['credential_in_use', LINK_GOOGLE_COPY.credentialInUse],
    ['cancelled', LINK_GOOGLE_COPY.cancelled],
    ['popup_blocked', LINK_GOOGLE_COPY.popupBlocked],
    ['network', LINK_GOOGLE_COPY.network],
    ['not_signed_in', LINK_GOOGLE_COPY.notSignedIn],
    ['other', LINK_GOOGLE_COPY.other],
  ])('failure %s shows fixed copy and keeps the action available to retry', (reason, expected) => {
    const v = linkGoogleView({ kind: 'failed', reason: reason as never });
    expect(v.message).toBe(expected);
    expect(v.tone).toBe('error');
    expect(v.actionLabel).toBe('Link Google');
    expect(v.busy).toBe(false);
  });

  it('cancelled says the account was not changed, so a customer is never left guessing', () => {
    expect(LINK_GOOGLE_COPY.cancelled).toContain('has not been changed');
  });

  it('credential_in_use directs to the administrator and never suggests a retry would fix it', () => {
    expect(LINK_GOOGLE_COPY.credentialInUse).toContain('already linked to another DSBC account');
    expect(LINK_GOOGLE_COPY.credentialInUse).toContain('administrator');
  });

  it('no customer-visible copy leaks a raw Firebase code', () => {
    for (const [key, text] of Object.entries(LINK_GOOGLE_COPY)) {
      expect(text, key).not.toMatch(/auth\/|Firebase|firebase|INTERNAL|undefined/);
    }
  });

  it('redirecting tells the customer what is about to happen and claims no success', () => {
    const v = linkGoogleView({ kind: 'redirecting' });
    expect(v.message).toBe(LINK_GOOGLE_COPY.redirecting);
    expect(v.tone).not.toBe('success');
    expect(v.busy).toBe(true);
  });
});
