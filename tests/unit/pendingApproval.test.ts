// Directive 30: the approve-button decision and approval target are pure (no DOM).
import { describe, expect, it } from 'vitest';
import { approvalTargetFor, canSubmitApproval, shouldShowApproveShortcut } from '../../src/lib/pendingApproval';

describe('pendingApproval', () => {
  it('REG-ui2 approve is blocked until a reason is entered', () => {
    expect(canSubmitApproval('')).toBe(false);
    expect(canSubmitApproval('   \n\t ')).toBe(false);
  });

  it('REG-ui2 approve is allowed once a non-blank reason is entered', () => {
    expect(canSubmitApproval('Verified real customer')).toBe(true);
    expect(canSubmitApproval('  ok  ')).toBe(true);
  });

  it('REG-ui2 an individual is approved by its uid', () => {
    expect(approvalTargetFor({ uid: 'u1', accountType: 'individual' })).toEqual({ customerType: 'individual', customerId: 'u1' });
  });

  it('REG-ui2 a company is approved by its co_<uid> tenant id', () => {
    expect(approvalTargetFor({ uid: 'u2', accountType: 'company' })).toEqual({ customerType: 'company', customerId: 'co_u2' });
  });

  it('REG-ui3 the approve shortcut shows only for a pending_approval row', () => {
    expect(shouldShowApproveShortcut('pending_approval')).toBe(true);
    expect(shouldShowApproveShortcut('active')).toBe(false);
    expect(shouldShowApproveShortcut('suspended')).toBe(false);
    expect(shouldShowApproveShortcut(null)).toBe(false);
    expect(shouldShowApproveShortcut(undefined)).toBe(false);
  });
});
