import { callBackend } from '../lib/backend';
import type { Destination, SessionIntent } from '../../shared/domain/sessionRouting';

export interface SessionInfo { destination: Destination; displayName: string | null; companyName: string | null }

export interface RegistrationOutcome { created: boolean; destination: Destination }

export const sessionService = {
  resolve: (intent: SessionIntent) => callBackend<SessionInfo>('resolveSession', { intent }),
  /** "Create Free Card" workflow. */
  registerIndividual: (input: { displayName: string }) => callBackend<RegistrationOutcome>('registerIndividual', input),
  /** "Register as Company" workflow (Phase 1: Free company plan only). */
  registerCompany: (input: { displayName: string; companyName: string; planId: 'company_free' }) => callBackend<RegistrationOutcome>('registerCompany', input),
};
