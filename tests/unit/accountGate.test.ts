// Directive 30: the awaiting-approval decision is a pure function (no DOM).
import { describe, expect, it } from 'vitest';
import { isPendingApproval, shouldShowAwaitingApproval } from '../../src/lib/accountGate';

describe('accountGate', () => {
  it('REG-ui shows awaiting approval for a pending, verified account', () => {
    expect(shouldShowAwaitingApproval('pending_approval', true)).toBe(true);
  });

  it('REG-ui shows awaiting approval for a pending, unverified account too (status alone gates the workspace)', () => {
    expect(shouldShowAwaitingApproval('pending_approval', false)).toBe(true);
  });

  it('REG-ui shows nothing for an active account', () => {
    expect(shouldShowAwaitingApproval('active', true)).toBe(false);
  });

  it('REG-ui shows nothing while status is unknown (signed out or not yet fetched)', () => {
    expect(shouldShowAwaitingApproval(null, false)).toBe(false);
    expect(shouldShowAwaitingApproval(null, true)).toBe(false);
  });

  it('REG-ui does not treat other statuses as pending', () => {
    for (const s of ['suspended', 'rejected', 'PENDING_APPROVAL', '']) {
      expect(shouldShowAwaitingApproval(s, true)).toBe(false);
      expect(isPendingApproval(s)).toBe(false);
    }
  });

  it('isPendingApproval matches only pending_approval', () => {
    expect(isPendingApproval('pending_approval')).toBe(true);
    expect(isPendingApproval(null)).toBe(false);
  });
});
