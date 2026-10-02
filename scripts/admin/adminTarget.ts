// ============================================================================
// Admin-script target resolution & safety guard (Directive 24 Phases 2-3)
// ============================================================================
// Every Admin-SDK script resolves its target here. Rules:
//   * Emulator targets (FIRESTORE_EMULATOR_HOST set) are always allowed.
//   * A real project must be named twice: --project <id> --confirm-project <id>.
//   * Demo seeding is refused for anything that looks like production
//     (project id contains "prod", is listed in DSBC_PRODUCTION_PROJECT_IDS, or
//     is the production project of config/environments.json), and for any real
//     project unless --allow-non-emulator is given.
//   * Directive 27: every real-project operation must name its Firestore
//     database (--database). The production project hosts other apps'
//     databases, so "(default)" is never assumed; for the registry production
//     project the database must be exactly the registered DSBC database.

import { ENVIRONMENT_REGISTRY } from '../../src/lib/environmentResolver';

export interface AdminArgs {
  [key: string]: string | boolean | undefined;
}

export interface AdminTarget {
  projectId: string;
  databaseId: string;
  emulator: boolean;
}

export function parseArgs(argv: string[]): AdminArgs {
  const out: AdminArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** Production project + database from config/environments.json. */
export const PRODUCTION_TARGET = {
  projectId: ENVIRONMENT_REGISTRY.environments.production.firebase!.projectId,
  databaseId: ENVIRONMENT_REGISTRY.environments.production.firestoreDatabaseId!,
};

export type AdminPurpose = 'seed-demo' | 'grant-app-owner' | 'bootstrap' | 'migrate';

export function isProductionLike(projectId: string, env: Record<string, string | undefined> = process.env): boolean {
  const listed = (env.DSBC_PRODUCTION_PROJECT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return /prod/i.test(projectId) || listed.includes(projectId) || projectId === PRODUCTION_TARGET.projectId;
}

export function resolveAdminTarget(
  args: AdminArgs,
  purpose: AdminPurpose,
  env: Record<string, string | undefined> = process.env
): AdminTarget {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const projectId = (typeof args.project === 'string' && args.project) || (emulator ? env.GCLOUD_PROJECT || 'demo-dsbc' : '');
  const databaseId = (typeof args.database === 'string' && args.database) || '(default)';

  if (!projectId) throw new Error('Missing --project <id>.');

  if (emulator) {
    if (!projectId.startsWith('demo-') && args['confirm-project'] !== projectId) {
      throw new Error(`Emulator target "${projectId}" is not a demo-* project; repeat it with --confirm-project ${projectId}.`);
    }
    return { projectId, databaseId, emulator };
  }

  if (args['confirm-project'] !== projectId) {
    throw new Error(`Refusing to touch real project "${projectId}" without --confirm-project ${projectId}.`);
  }

  if (typeof args.database !== 'string' || !args.database) {
    throw new Error(`Refusing to touch real project "${projectId}" without --database <id>; the database is never assumed.`);
  }
  if (projectId === PRODUCTION_TARGET.projectId && databaseId !== PRODUCTION_TARGET.databaseId) {
    throw new Error(`Project ${projectId} is the DSBC production project; its DSBC database is ${PRODUCTION_TARGET.databaseId}, not "${databaseId}" (other databases there belong to other apps).`);
  }

  if (purpose === 'seed-demo') {
    if (isProductionLike(projectId, env)) {
      throw new Error(`Refusing to seed demo data into production-like project "${projectId}".`);
    }
    if (args['allow-non-emulator'] !== true) {
      throw new Error('Demo data is meant for the emulator. Pass --allow-non-emulator to seed a real DEVELOPMENT project.');
    }
  }

  return { projectId, databaseId, emulator };
}
