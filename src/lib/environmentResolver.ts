// ============================================================================
// DSBC deployment-target resolution (Directive 27 Phases 1-2)
// ============================================================================
// Pure function shared by the Vite build (vite.config.ts), the browser
// (src/lib/environment.ts), the deployment preflight and the unit tests.
//
// The environment is chosen ONLY by the build-time variable VITE_DSBC_ENV,
// which comes from the committed .env.<mode> files. It is never inferred from
// the hostname, the URL, localStorage or any other runtime input, and anything
// missing, unknown or undesignated fails closed (throws) instead of falling
// back to PRODUCTION or to a default.

import registryJson from '../../config/environments.json';

export type AppEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type EnvironmentKey = 'development' | 'staging' | 'production';
export const ENVIRONMENT_KEYS: readonly EnvironmentKey[] = ['development', 'staging', 'production'];

export interface FirebaseWebConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
}

export interface EmulatorConfig {
  required: boolean;
  auth?: string;
  firestoreHost?: string;
  firestorePort?: number;
  storageHost?: string;
  storagePort?: number;
  functionsHost?: string;
  functionsPort?: number;
}

export interface EnvironmentTarget {
  environment: AppEnvironment;
  configured: boolean;
  notConfiguredReason?: string;
  emulators?: EmulatorConfig;
  firebase?: FirebaseWebConfig;
  firestoreDatabaseId?: string;
  firestoreLocation?: string;
  firestoreEdition?: string;
  functionsRegion?: string;
  hosting?: { target: string; site: string | null };
  publicOrigin?: string | null;
  allow?: { demoData: boolean; mockPersonas: boolean; developmentTools: boolean; securityTestRunner: boolean };
  payments?: 'disabled' | 'test' | 'live';
}

export interface EnvironmentRegistry {
  schema: string;
  environments: Record<EnvironmentKey, EnvironmentTarget>;
}

export interface ResolvedEnvironment {
  key: EnvironmentKey;
  environment: AppEnvironment;
  isProduction: boolean;
  isStaging: boolean;
  isDevelopment: boolean;
  firebase: FirebaseWebConfig;
  /** '' means the (default) database (emulator only). */
  firestoreDatabaseId: string;
  functionsRegion: string;
  useEmulators: boolean;
  emulators: EmulatorConfig;
  hostingSite: string | null;
  publicOrigin: string | null;
  demoDataAllowed: boolean;
  mockPersonasAllowed: boolean;
  developmentToolsAllowed: boolean;
  securityTestRunnerAllowed: boolean;
  payments: 'disabled' | 'test' | 'live';
}

export class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(`DSBC environment configuration error: ${message}`);
    this.name = 'EnvironmentConfigurationError';
  }
}

export const ENVIRONMENT_REGISTRY = registryJson as unknown as EnvironmentRegistry;

export interface EnvironmentInput {
  VITE_DSBC_ENV?: string;
  VITE_DSBC_USE_EMULATORS?: string;
}

const fail = (msg: string): never => {
  throw new EnvironmentConfigurationError(msg);
};

export function resolveEnvironment(input: EnvironmentInput, registry: EnvironmentRegistry = ENVIRONMENT_REGISTRY): ResolvedEnvironment {
  const raw = input.VITE_DSBC_ENV;
  if (raw === undefined || raw === '') fail('VITE_DSBC_ENV is not set. Build with an explicit mode (production, staging, development, e2e); the environment is never guessed.');
  const key = raw as EnvironmentKey;
  if (!ENVIRONMENT_KEYS.includes(key)) fail(`VITE_DSBC_ENV="${raw}" is not one of ${ENVIRONMENT_KEYS.join(', ')}.`);

  const target = registry.environments[key];
  if (!target) fail(`No "${key}" entry in config/environments.json.`);
  if (target.configured !== true) fail(`The ${key} target is not designated: ${target.notConfiguredReason || 'configured is not true'}.`);

  const firebase = target.firebase ?? fail(`${key}: firebase web configuration missing.`);
  for (const f of ['projectId', 'appId', 'apiKey', 'authDomain', 'storageBucket', 'messagingSenderId'] as const) {
    if (!firebase[f]) fail(`${key}: firebase.${f} missing.`);
  }
  const allow = target.allow ?? fail(`${key}: allow flags missing.`);
  const emulators = target.emulators ?? fail(`${key}: emulators section missing.`);
  const region = target.functionsRegion || fail(`${key}: functionsRegion missing.`);
  const dbId = target.firestoreDatabaseId || fail(`${key}: firestoreDatabaseId missing (use "(default)" explicitly).`);
  const payments = target.payments ?? fail(`${key}: payments mode missing.`);

  const useEmulators = emulators.required === true;
  if (input.VITE_DSBC_USE_EMULATORS === 'true' && !useEmulators) fail(`${key} may not be pointed at the emulators.`);

  if (key === 'production') {
    if (firebase.projectId.startsWith('demo-')) fail('production may not target a demo-* project.');
    if (dbId === '(default)') fail('production must name its Firestore database explicitly; "(default)" is not the DSBC database.');
    if (useEmulators) fail('production may not use the emulators.');
    if (allow.demoData || allow.mockPersonas || allow.developmentTools || allow.securityTestRunner) {
      fail('production may not allow demo data, mock personas, development tools or the security test runner.');
    }
  }
  if (key === 'development' && !useEmulators) fail('development must run against the emulators so it never touches real data.');
  if (useEmulators) {
    if (!firebase.projectId.startsWith('demo-')) fail(`${key}: an emulator target must use a demo-* project so it can never reach real services.`);
    for (const f of ['auth', 'firestoreHost', 'firestorePort', 'storageHost', 'storagePort', 'functionsHost', 'functionsPort'] as const) {
      if (emulators[f] === undefined || emulators[f] === '') fail(`${key}: emulators.${f} missing.`);
    }
  }

  return Object.freeze({
    key,
    environment: target.environment,
    isProduction: key === 'production',
    isStaging: key === 'staging',
    isDevelopment: key === 'development',
    firebase: Object.freeze({ ...firebase }),
    firestoreDatabaseId: dbId === '(default)' ? '' : dbId,
    functionsRegion: region,
    useEmulators,
    emulators: Object.freeze({ ...emulators }),
    hostingSite: target.hosting?.site ?? null,
    publicOrigin: target.publicOrigin ?? null,
    demoDataAllowed: allow.demoData === true,
    mockPersonasAllowed: allow.mockPersonas === true,
    developmentToolsAllowed: allow.developmentTools === true,
    securityTestRunnerAllowed: allow.securityTestRunner === true,
    payments,
  });
}
