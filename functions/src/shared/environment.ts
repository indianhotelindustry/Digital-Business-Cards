// ============================================================================
// Backend deployment-target check (Directive 27 Phase 1)
// ============================================================================
// The backend runs for exactly one target of config/environments.json, named
// by DSBC_ENVIRONMENT in functions/.env.<projectId>. Everything the runtime
// can observe (project, Firestore database, region, payment switch, public
// origin) must agree with that registry entry. index.ts calls
// assertBackendEnvironment() at load, so a mismatch fails deploy discovery
// and cold start: a backend wired to the wrong project or database never
// serves a request. Platform Health reports the same evaluation.

import registryJson from '../../../config/environments.json';

type Key = 'development' | 'staging' | 'production';
const KEYS: readonly Key[] = ['development', 'staging', 'production'];

interface RegistryTarget {
  configured: boolean;
  notConfiguredReason?: string;
  firebase?: { projectId: string; storageBucket: string };
  firestoreDatabaseId?: string;
  functionsRegion?: string;
  publicOrigin?: string | null;
  payments?: 'disabled' | 'test' | 'live';
  emulators?: { required: boolean };
}

const REGISTRY = registryJson as unknown as { environments: Record<Key, RegistryTarget> };

export interface BackendEnvironment {
  ok: boolean;
  key: string | null;
  projectId: string | null;
  databaseId: string;
  region: string | null;
  publicOrigin: string;
  storageBucket: string | null;
  emulator: boolean;
  problems: string[];
}

const norm = (db: string | undefined) => (!db || db === '(default)' ? '(default)' : db);

export function evaluateBackendEnvironment(env: Record<string, string | undefined> = process.env): BackendEnvironment {
  const problems: string[] = [];
  const key = env.DSBC_ENVIRONMENT || null;
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || null;
  const databaseId = norm(env.DSBC_FIRESTORE_DATABASE);
  const region = env.DSBC_FUNCTIONS_REGION || null;
  const publicOrigin = env.DSBC_PUBLIC_ORIGIN || '';
  const emulator = env.FUNCTIONS_EMULATOR === 'true';
  let storageBucket: string | null = null;

  if (!key) problems.push('DSBC_ENVIRONMENT is not set (functions/.env.<projectId>); the target is never guessed.');
  else if (!KEYS.includes(key as Key)) problems.push(`DSBC_ENVIRONMENT="${key}" is not one of ${KEYS.join(', ')}.`);
  else {
    const t = REGISTRY.environments[key as Key];
    if (!t?.configured) problems.push(`The ${key} target is not designated: ${t?.notConfiguredReason || 'configured is not true'}.`);
    else {
      storageBucket = t.firebase?.storageBucket ?? null;
      if (!projectId) problems.push('The runtime project id (GCLOUD_PROJECT) is unknown.');
      else if (projectId !== t.firebase?.projectId) problems.push(`Running in project ${projectId}, but the ${key} target is ${t.firebase?.projectId}.`);
      if (databaseId !== norm(t.firestoreDatabaseId)) problems.push(`DSBC_FIRESTORE_DATABASE is ${databaseId}, but the ${key} target uses ${norm(t.firestoreDatabaseId)}.`);
      if (!region) problems.push('DSBC_FUNCTIONS_REGION is not set.');
      else if (region !== t.functionsRegion) problems.push(`DSBC_FUNCTIONS_REGION is ${region}, but the ${key} target uses ${t.functionsRegion}.`);
      if ((t.publicOrigin || '') !== publicOrigin) problems.push(`DSBC_PUBLIC_ORIGIN is "${publicOrigin}", but the ${key} target uses "${t.publicOrigin || ''}".`);
      if (t.payments === 'disabled' && env.PAYMENTS_ENABLED === 'true') problems.push(`PAYMENTS_ENABLED=true, but payments are disabled for the ${key} target.`);
      if (key === 'production' && emulator) problems.push('The production target may not run in the emulator.');
      if (t.emulators?.required && !emulator && env.FIRESTORE_EMULATOR_HOST === undefined) problems.push(`The ${key} target is emulator-only.`);
    }
  }
  return { ok: problems.length === 0, key, projectId, databaseId, region, publicOrigin, storageBucket, emulator, problems };
}

export class BackendEnvironmentError extends Error {}

/** Throws unless the runtime matches its registry target (fail closed). */
export function assertBackendEnvironment(env: Record<string, string | undefined> = process.env): BackendEnvironment {
  const e = evaluateBackendEnvironment(env);
  if (!e.ok) throw new BackendEnvironmentError(`DSBC backend refuses to start: ${e.problems.join(' ')}`);
  return e;
}
