// ============================================================================
// Directive 27 Phase 1/8 — deployment preflight (offline, read-only)
// ============================================================================
//   npx tsx scripts/directive27/preflight.ts [--target production] [--dist dist] [--out <file>]
// Proves, without touching any Firebase project, that every place a
// deployment target is named agrees with config/environments.json:
//   * the client build selector (.env.<mode>) and resolver,
//   * the backend parameters (functions/.env.<projectId>) and backend check,
//   * the deploy configuration (firebase.production.json, .firebaserc),
//   * the built bundle (dist/) — built for the target, 404 page present.
// It also lists what still BLOCKS a deployment (things only the App Owner can
// designate or verify). It never deploys and never contacts a project.
// Exit 0 = no FAIL (blockers may remain); exit 1 = a FAIL.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ENVIRONMENT_REGISTRY, resolveEnvironment, type EnvironmentKey, type EnvironmentTarget } from '../../src/lib/environmentResolver';
import { evaluateBackendEnvironment } from '../../functions/src/shared/environment';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface PreflightCheck {
  id: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  detail: string;
}

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const json = (rel: string) => JSON.parse(read(rel));
const dotenv = (rel: string): Record<string, string> =>
  Object.fromEntries(
    read(rel)
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );

/**
 * Directive 28: production may only be deployed into a Firebase project used
 * by DSBC alone. Anything else (a shared project, or no recorded boundary)
 * blocks the deployment.
 */
export function evaluateBoundary(target: EnvironmentTarget | undefined): { ok: boolean; detail: string } {
  const b = target?.boundary;
  if (!b) return { ok: false, detail: 'No production boundary is recorded (config/environments.json production.boundary); a shared project is never assumed safe.' };
  if (b.dedicatedProject !== true) {
    return { ok: false, detail: `Production project ${target?.firebase?.projectId} is shared with: ${(b.sharedWith ?? ['unknown']).join('; ')}. DSBC needs a dedicated Firebase project (${b.decision ?? 'docs/directive-28'}).` };
  }
  return { ok: true, detail: `Production project ${target?.firebase?.projectId} is dedicated to DSBC.` };
}

export function runPreflight(opts: { target?: EnvironmentKey; dist?: string } = {}) {
  const key: EnvironmentKey = opts.target ?? 'production';
  const checks: PreflightCheck[] = [];
  const add = (id: string, ok: boolean, detail: string, failStatus: 'FAIL' | 'BLOCKED' = 'FAIL') =>
    checks.push({ id, status: ok ? 'PASS' : failStatus, detail });
  const attempt = (id: string, fn: () => string) => {
    try {
      add(id, true, fn());
    } catch (err) {
      add(id, false, (err as Error).message);
    }
  };

  // ---- Client -------------------------------------------------------------
  const modeSelectors: Record<string, EnvironmentKey> = {
    '.env.production': 'production', '.env.staging': 'staging', '.env.development': 'development', '.env.e2e': 'development', '.env.test': 'development',
  };
  for (const [file, expected] of Object.entries(modeSelectors)) {
    attempt(`CLIENT_SELECTOR ${file}`, () => {
      const vars = dotenv(file);
      const extra = Object.keys(vars).filter((k) => k !== 'VITE_DSBC_ENV');
      if (extra.length) throw new Error(`${file} may only set VITE_DSBC_ENV; found ${extra.join(', ')}.`);
      if (vars.VITE_DSBC_ENV !== expected) throw new Error(`${file} selects ${vars.VITE_DSBC_ENV}, expected ${expected}.`);
      return `${file} selects ${expected}.`;
    });
  }
  let target: ReturnType<typeof resolveEnvironment> | null = null;
  attempt('CLIENT_RESOLVES', () => {
    target = resolveEnvironment({ VITE_DSBC_ENV: key });
    return `${key} resolves: ${target.firebase.projectId} / ${target.firestoreDatabaseId || '(default)'} / ${target.functionsRegion}, emulators ${target.useEmulators}.`;
  });
  attempt('CLIENT_REFUSES_EMULATOR_OVERRIDE', () => {
    if (key === 'development') return 'n/a for development.';
    try {
      resolveEnvironment({ VITE_DSBC_ENV: key, VITE_DSBC_USE_EMULATORS: 'true' });
    } catch {
      return `${key} refuses VITE_DSBC_USE_EMULATORS=true.`;
    }
    throw new Error(`${key} accepted an emulator override.`);
  });
  if (!target) return finish(key, checks);
  const t = target as ReturnType<typeof resolveEnvironment>;
  const reg = ENVIRONMENT_REGISTRY.environments[key];

  // ---- Backend ------------------------------------------------------------
  const backendEnvFile = `functions/.env.${t.firebase.projectId}`;
  attempt('BACKEND_PARAMS', () => {
    if (!existsSync(join(root, backendEnvFile))) throw new Error(`${backendEnvFile} is missing.`);
    const vars = dotenv(backendEnvFile);
    const e = evaluateBackendEnvironment({ ...vars, GCLOUD_PROJECT: t.firebase.projectId });
    if (!e.ok) throw new Error(e.problems.join(' '));
    if (vars.PAYMENTS_ENABLED !== 'false') throw new Error(`${backendEnvFile}: PAYMENTS_ENABLED must be false.`);
    return `${backendEnvFile} matches the registry (project, database, region, origin, payments off).`;
  });
  attempt('BACKEND_REFUSES_WRONG_DATABASE', () => {
    const vars = dotenv(backendEnvFile);
    const e = evaluateBackendEnvironment({ ...vars, GCLOUD_PROJECT: t.firebase.projectId, DSBC_FIRESTORE_DATABASE: '(default)' });
    if (e.ok) throw new Error('The backend check accepted the (default) database.');
    return 'The backend refuses to start against the (default) database.';
  });

  // ---- Deploy configuration --------------------------------------------------
  if (key === 'production') {
    attempt('DEPLOY_CONFIG', () => {
      const fb = json('firebase.production.json');
      const fsDb = (fb.firestore ?? []).map((f: { database: string }) => f.database);
      if (fsDb.length !== 1 || fsDb[0] !== reg.firestoreDatabaseId) throw new Error(`firebase.production.json firestore targets ${JSON.stringify(fsDb)}, expected [${reg.firestoreDatabaseId}].`);
      const buckets = (fb.storage ?? []).map((s: { bucket: string }) => s.bucket);
      if (buckets.length !== 1 || buckets[0] !== t.firebase.storageBucket) throw new Error(`storage targets ${JSON.stringify(buckets)}, expected [${t.firebase.storageBucket}].`);
      const hosting = fb.hosting?.[0];
      if (hosting?.target !== reg.hosting?.target) throw new Error(`hosting target ${hosting?.target}, expected ${reg.hosting?.target}.`);
      const rewrites = JSON.stringify(hosting.rewrites ?? []);
      if (!rewrites.includes('(card|profile|company)')) throw new Error('hosting rewrites do not cover /card, /profile, /company.');
      if (rewrites.includes('"source":"**"')) throw new Error('a catch-all rewrite would turn every unknown path into HTTP 200.');
      return `firebase.production.json: database ${fsDb[0]}, bucket ${buckets[0]}, hosting target ${hosting.target}, public routes rewritten, unknown paths 404.`;
    });
    attempt('DEPLOY_PROJECT_ALIAS', () => {
      const rc = json('.firebaserc');
      if (!String(rc.projects?.default || '').startsWith('demo-')) throw new Error(`.firebaserc default is ${rc.projects?.default}; it must be a demo-* project so a bare "firebase deploy" cannot reach production.`);
      if (rc.projects?.production !== t.firebase.projectId) throw new Error(`.firebaserc production alias is ${rc.projects?.production}, expected ${t.firebase.projectId}.`);
      return `.firebaserc: default ${rc.projects.default} (emulator), production alias ${rc.projects.production}.`;
    });
  }

  // ---- Bundle ---------------------------------------------------------------
  const dist = opts.dist ?? 'dist';
  const distDir = join(root, dist);
  if (!existsSync(join(distDir, 'index.html'))) {
    add('BUNDLE', false, `${dist}/index.html not found; run "npx vite build" (mode ${key === 'production' ? 'production' : key}).`, 'BLOCKED');
  } else {
    attempt('BUNDLE', () => {
      const assets = readdirSync(join(distDir, 'assets')).filter((f) => f.endsWith('.js'));
      const text = assets.map((f) => readFileSync(join(distDir, 'assets', f), 'utf8')).join('\n');
      if (!text.includes(`"${key}"`) && !text.includes(`'${key}'`)) throw new Error(`${dist} was not built with VITE_DSBC_ENV=${key}.`);
      if (!existsSync(join(distDir, '404.html'))) throw new Error(`${dist}/404.html is missing.`);
      if (/localStorage\.getItem\(["']dsbc_env_override/.test(text)) throw new Error('bundle still reads an environment override from localStorage.');
      return `${dist}: built for ${key}, 404.html present, no browser environment override.`;
    });
    // Build artifact identity (overnight directive Phase 6): the deployed revision must be provable.
    const infoFile = join(distDir, 'build-info.json');
    if (!existsSync(infoFile)) {
      add('BUILD_IDENTITY', false, `${dist}/build-info.json is missing; rebuild with "npx vite build".`, 'FAIL');
    } else {
      const info = JSON.parse(readFileSync(infoFile, 'utf8'));
      const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
      const wrongTarget = info.envKey !== key || info.projectId !== t.firebase.projectId || info.firestoreDatabaseId !== (t.firestoreDatabaseId || '(default)') || info.functionsRegion !== t.functionsRegion;
      if (wrongTarget) {
        add('BUILD_IDENTITY', false, `${dist}/build-info.json describes ${info.envKey}: ${info.projectId} / ${info.firestoreDatabaseId} / ${info.functionsRegion}, not this target.`, 'FAIL');
      } else if (info.commit !== head) {
        add('BUILD_IDENTITY', false, `${dist} was built at ${String(info.commit).slice(0, 7)}, HEAD is ${head.slice(0, 7)}; rebuild before deploying.`, 'BLOCKED');
      } else {
        add('BUILD_IDENTITY', true, `${dist} = commit ${head.slice(0, 7)} for ${info.projectId} / ${info.firestoreDatabaseId}${info.treeClean ? '' : ' (built from a dirty working tree: not a release build)'}.`);
      }
    }
  }

  // ---- What only the App Owner can designate / verify ------------------------------
  if (key === 'production') {
    const boundary = evaluateBoundary(reg);
    add('PRODUCTION_BOUNDARY', boundary.ok, boundary.detail, 'BLOCKED');
  }
  add('HOSTING_SITE_DESIGNATED', Boolean(reg.hosting?.site), reg.hosting?.site ? `hosting site ${reg.hosting.site}.` : 'No DSBC hosting site is designated (config/environments.json hosting.site, then firebase target:apply hosting dsbc-web <site>).', 'BLOCKED');
  add('PUBLIC_ORIGIN_DESIGNATED', Boolean(reg.publicOrigin), reg.publicOrigin ? `public origin ${reg.publicOrigin}.` : 'No public origin is designated; share links and QR codes would carry the hosting default domain.', 'BLOCKED');
  add('STAGING_DESIGNATED', ENVIRONMENT_REGISTRY.environments.staging.configured === true,
    ENVIRONMENT_REGISTRY.environments.staging.configured ? 'staging target designated.' : 'No staging project is designated; nothing can be rehearsed on real infrastructure before production.', 'BLOCKED');
  return finish(key, checks);
}

function finish(key: EnvironmentKey, checks: PreflightCheck[]) {
  const fail = checks.filter((c) => c.status === 'FAIL').length;
  const blocked = checks.filter((c) => c.status === 'BLOCKED').length;
  return {
    schema: 'dsbc.directive27.preflight/v1',
    generatedAt: new Date().toISOString(),
    target: key,
    status: fail ? 'FAIL' : blocked ? 'BLOCKED' : 'PASS',
    counts: { pass: checks.length - fail - blocked, fail, blocked },
    checks,
  };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const report = runPreflight({ target: opt('target') as EnvironmentKey | undefined, dist: opt('dist') });
  const out = resolve(root, opt('out') ?? 'docs/directive-27/evidence/preflight.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  for (const c of report.checks) console.log(`${c.status.padEnd(7)} ${c.id}: ${c.detail}`);
  console.log(`preflight ${report.target}: ${report.status} (${report.counts.pass} pass, ${report.counts.fail} fail, ${report.counts.blocked} blocked) -> ${out}`);
  process.exit(report.status === 'FAIL' ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
