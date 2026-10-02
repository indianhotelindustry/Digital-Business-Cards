// ============================================================================
// DSBC runtime environment (Directive 27 Phases 1-2)
// ============================================================================
// The environment this bundle was BUILT for. VITE_DSBC_ENV is replaced at build
// time from the committed .env.<mode> file, so the value cannot be changed from
// the browser (no hostname inference, no localStorage, no URL switch).
// A bundle without a valid, designated environment does not start:
// src/main.tsx renders a configuration error instead of the app.

import { EnvironmentConfigurationError, resolveEnvironment, type ResolvedEnvironment } from './environmentResolver';

export type { AppEnvironment, ResolvedEnvironment } from './environmentResolver';

let resolved: ResolvedEnvironment | null = null;
let failure: EnvironmentConfigurationError | null = null;
try {
  resolved = resolveEnvironment({
    VITE_DSBC_ENV: import.meta.env?.VITE_DSBC_ENV,
    VITE_DSBC_USE_EMULATORS: import.meta.env?.VITE_DSBC_USE_EMULATORS,
  });
} catch (err) {
  failure = err instanceof EnvironmentConfigurationError ? err : new EnvironmentConfigurationError(String(err));
}

/** The configuration error, if this bundle may not start. */
export const ENVIRONMENT_ERROR: EnvironmentConfigurationError | null = failure;

/** The resolved environment; throws if the bundle is misconfigured. */
export function currentEnvironment(): ResolvedEnvironment {
  if (!resolved) throw failure ?? new EnvironmentConfigurationError('environment unresolved');
  return resolved;
}

/**
 * Origin used in share links and QR codes: the designated public origin of the
 * target when one is configured, otherwise the origin serving this bundle.
 */
export function canonicalOrigin(): string {
  return resolved?.publicOrigin || window.location.origin;
}
