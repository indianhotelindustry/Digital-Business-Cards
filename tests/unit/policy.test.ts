import { describe, expect, it } from 'vitest';
import { INITIAL_GLOBAL_POLICY } from '../../shared/domain/catalogue';

describe('global policy defaults', () => {
  it('REG-030 default customer activation mode is manual_approval', () => {
    expect(INITIAL_GLOBAL_POLICY.customerActivationMode).toBe('manual_approval');
  });
});
