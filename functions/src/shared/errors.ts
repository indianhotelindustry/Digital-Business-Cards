import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

export function fail(code: FunctionsErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new HttpsError(code, message, details);
}

export const deny = (message: string): never => fail('permission-denied', message);
export const invalid = (message: string): never => fail('invalid-argument', message);
