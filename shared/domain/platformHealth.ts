// ============================================================================
// Platform health contract (Directive 27 Phase 4)
// ============================================================================
// Produced by the adminGetPlatformHealth callable (functions/src/platform/health.ts)
// and rendered by src/components/saas/PlatformHealthPanel.tsx. A state is only
// OK when the backend measured it at request time; anything it could not
// check is NOT_VERIFIED or NOT_CONFIGURED, never OK.

export type PlatformHealthState = 'OK' | 'DEGRADED' | 'FAIL' | 'DISABLED' | 'NOT_CONFIGURED' | 'NOT_VERIFIED';

export const PLATFORM_HEALTH_CHECKS = [
  'ENVIRONMENT',
  'AUTH',
  'APP_OWNER',
  'FIRESTORE',
  'INDEXES',
  'STORAGE',
  'FUNCTIONS',
  'PUBLIC_URL',
  'ENTITLEMENTS',
  'PUBLISHING',
  'AUDIT',
  'NOTIFICATIONS',
  'PAYMENTS',
  'WEBHOOK',
  'RECONCILIATION',
] as const;

export type PlatformHealthCheckId = (typeof PLATFORM_HEALTH_CHECKS)[number];

export interface PlatformHealthCheck {
  id: PlatformHealthCheckId;
  state: PlatformHealthState;
  detail: string;
  /** The authoritative source the backend measured. */
  source?: string;
  latencyMs?: number;
}

export interface PlatformHealthReport {
  generatedAt: string;
  environment: string;
  projectId: string;
  databaseId: string;
  region: string;
  overall: 'OK' | 'DEGRADED' | 'FAIL';
  checks: PlatformHealthCheck[];
}

/**
 * Fail closed: FAIL if anything failed or any required check is missing or
 * duplicated; OK only when every required check is OK or intentionally
 * DISABLED; anything else (NOT_VERIFIED, NOT_CONFIGURED, DEGRADED) is DEGRADED.
 */
export function overallHealth(checks: PlatformHealthCheck[]): PlatformHealthReport['overall'] {
  if (checks.some((c) => c.state === 'FAIL')) return 'FAIL';
  const ids = checks.map((c) => c.id);
  if (PLATFORM_HEALTH_CHECKS.some((id) => ids.filter((x) => x === id).length !== 1)) return 'FAIL';
  return checks.every((c) => c.state === 'OK' || c.state === 'DISABLED') ? 'OK' : 'DEGRADED';
}
