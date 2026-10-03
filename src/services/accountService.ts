// ============================================================================
// DSBC ACCOUNT SERVICE (Directive 30)
// ============================================================================
// Reads the signed-in customer's activation state through the backend. The
// callable needs sign-in but is deliberately not gated on an active account,
// so a pending customer can see "awaiting approval". It returns nothing else.

import { callBackend } from '../lib/backend';

export interface MyAccountState {
  status: string;
  emailVerified: boolean;
}

export const getMyAccountState = (): Promise<MyAccountState> => callBackend<MyAccountState>('getMyAccountState');
