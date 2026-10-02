// Directive 27 Phase 1: environment authority. The deployment target is
// chosen only at build time (VITE_DSBC_ENV from the committed .env.<mode>),
// fails closed, and the backend refuses to load for a mismatched target.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_REGISTRY, EnvironmentConfigurationError, resolveEnvironment, type EnvironmentRegistry } from '../../src/lib/environmentResolver';
import { assertBackendEnvironment, evaluateBackendEnvironment } from '../../functions/src/shared/environment';
import { runPreflight } from '../../scripts/directive27/preflight';

const clone = (): EnvironmentRegistry => JSON.parse(JSON.stringify(ENVIRONMENT_REGISTRY));
const PROD = ENVIRONMENT_REGISTRY.environments.production;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('ENV: client target resolution fails closed', () => {
  it('ENV-001 an unset or empty VITE_DSBC_ENV is refused (never guessed)', () => {
    expect(() => resolveEnvironment({})).toThrow(EnvironmentConfigurationError);
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: '' })).toThrow(/not set/);
  });

  it('ENV-002 an unknown environment name is refused', () => {
    for (const v of ['prod', 'PRODUCTION', 'live', 'dev', 'localhost']) expect(() => resolveEnvironment({ VITE_DSBC_ENV: v })).toThrow(/not one of/);
  });

  it('ENV-003 an undesignated target (staging) is refused instead of falling back', () => {
    expect(ENVIRONMENT_REGISTRY.environments.staging.configured).toBe(false);
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'staging' })).toThrow(/not designated/);
  });

  it('ENV-004 production resolves to the named DSBC database, bucket and region with demo features off', () => {
    const p = resolveEnvironment({ VITE_DSBC_ENV: 'production' });
    expect(p.isProduction).toBe(true);
    expect(p.firebase.projectId).toBe(PROD.firebase!.projectId);
    expect(p.firestoreDatabaseId).toBe(PROD.firestoreDatabaseId);
    expect(p.firestoreDatabaseId).not.toBe('');
    expect(p.firebase.storageBucket).toBe(PROD.firebase!.storageBucket);
    expect(p.functionsRegion).toBe(PROD.functionsRegion);
    expect(p.useEmulators).toBe(false);
    expect([p.demoDataAllowed, p.mockPersonasAllowed, p.developmentToolsAllowed, p.securityTestRunnerAllowed]).toEqual([false, false, false, false]);
    expect(p.payments).toBe('disabled');
  });

  it('ENV-005 production cannot be pointed at the emulators', () => {
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production', VITE_DSBC_USE_EMULATORS: 'true' })).toThrow(/emulators/);
  });

  it('ENV-006 a registry that weakens production is refused', () => {
    const defaultDb = clone();
    defaultDb.environments.production.firestoreDatabaseId = '(default)';
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production' }, defaultDb)).toThrow(/name its Firestore database/);
    const demo = clone();
    demo.environments.production.allow!.demoData = true;
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production' }, demo)).toThrow(/demo data/);
    const emu = clone();
    emu.environments.production.emulators = { ...emu.environments.development.emulators! };
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production' }, emu)).toThrow();
    const demoProject = clone();
    demoProject.environments.production.firebase!.projectId = 'demo-x';
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production' }, demoProject)).toThrow(/demo-\*/);
    const missing = clone();
    delete (missing.environments.production as { functionsRegion?: string }).functionsRegion;
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'production' }, missing)).toThrow(/functionsRegion/);
  });

  it('ENV-007 development always runs against the emulators of a demo-* project', () => {
    const d = resolveEnvironment({ VITE_DSBC_ENV: 'development' });
    expect(d.useEmulators).toBe(true);
    expect(d.firebase.projectId.startsWith('demo-')).toBe(true);
    const noEmu = clone();
    noEmu.environments.development.emulators!.required = false;
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'development' }, noEmu)).toThrow(/emulators/);
    const realProject = clone();
    realProject.environments.development.firebase!.projectId = PROD.firebase!.projectId;
    expect(() => resolveEnvironment({ VITE_DSBC_ENV: 'development' }, realProject)).toThrow(/demo-\*/);
  });

  it('ENV-008 the resolved environment is immutable at runtime', () => {
    const p = resolveEnvironment({ VITE_DSBC_ENV: 'production' });
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.firebase)).toBe(true);
    expect(() => {
      (p as { isProduction: boolean }).isProduction = false;
    }).toThrow();
  });

  it('ENV-009 nothing in the client infers the environment from the hostname, URL or localStorage', () => {
    for (const f of ['src/lib/environment.ts', 'src/lib/environmentResolver.ts', 'src/lib/firebase.ts', 'src/services/environmentConfig.ts', 'src/lib/runtimeFlags.ts']) {
      const text = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
      expect(text, f).not.toMatch(/location\.(hostname|host|href|search|hash)|localStorage|sessionStorage|URLSearchParams/);
    }
    const all = sources('src').map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(all).not.toMatch(/dsbc_env_override|setEnvironment\(/);
    expect(all).not.toMatch(/projectId:\s*["']v-nexus-lite["']/); // no hard-coded live project in client code
  });

  it('ENV-010 the committed mode files only select a target and carry no other values', () => {
    for (const [file, key] of [['.env.production', 'production'], ['.env.e2e', 'development'], ['.env.development', 'development'], ['.env.test', 'development'], ['.env.staging', 'staging']]) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
      expect(lines, file).toEqual([`VITE_DSBC_ENV=${key}`]);
    }
  });
});

describe('ENV: backend target check', () => {
  const dev = { DSBC_ENVIRONMENT: 'development', GCLOUD_PROJECT: 'demo-dsbc', DSBC_FIRESTORE_DATABASE: '(default)', DSBC_FUNCTIONS_REGION: 'us-central1', DSBC_PUBLIC_ORIGIN: '', FUNCTIONS_EMULATOR: 'true', PAYMENTS_ENABLED: 'false' };
  const prod = { DSBC_ENVIRONMENT: 'production', GCLOUD_PROJECT: PROD.firebase!.projectId, DSBC_FIRESTORE_DATABASE: PROD.firestoreDatabaseId, DSBC_FUNCTIONS_REGION: PROD.functionsRegion, DSBC_PUBLIC_ORIGIN: '', PAYMENTS_ENABLED: 'false' };

  it('ENV-011 the emulator and production parameter sets are accepted', () => {
    expect(evaluateBackendEnvironment(dev).problems).toEqual([]);
    expect(evaluateBackendEnvironment(prod).problems).toEqual([]);
  });

  it('ENV-012 every mismatch makes the backend refuse to load', () => {
    const cases: Array<[Record<string, string>, RegExp]> = [
      [{ ...prod, DSBC_ENVIRONMENT: '' }, /DSBC_ENVIRONMENT is not set/],
      [{ ...prod, DSBC_ENVIRONMENT: 'prod' }, /not one of/],
      [{ ...prod, DSBC_ENVIRONMENT: 'staging' }, /not designated/],
      [{ ...prod, GCLOUD_PROJECT: 'some-other-project' }, /Running in project/],
      [{ ...prod, DSBC_FIRESTORE_DATABASE: '' }, /DSBC_FIRESTORE_DATABASE/],
      [{ ...prod, DSBC_FIRESTORE_DATABASE: '(default)' }, /DSBC_FIRESTORE_DATABASE/],
      [{ ...prod, DSBC_FUNCTIONS_REGION: '' }, /DSBC_FUNCTIONS_REGION is not set/],
      [{ ...prod, DSBC_FUNCTIONS_REGION: 'us-central1' }, /DSBC_FUNCTIONS_REGION/],
      [{ ...prod, PAYMENTS_ENABLED: 'true' }, /PAYMENTS_ENABLED=true/],
      [{ ...prod, DSBC_PUBLIC_ORIGIN: 'https://evil.example' }, /DSBC_PUBLIC_ORIGIN/],
      [{ ...prod, FUNCTIONS_EMULATOR: 'true' }, /emulator/],
      [{ ...dev, FUNCTIONS_EMULATOR: 'false' }, /emulator-only/],
    ];
    for (const [env, msg] of cases) {
      expect(() => assertBackendEnvironment(env), JSON.stringify(env)).toThrow(msg);
    }
  });

  it('ENV-013 the backend entry point asserts the target before configuring any function', () => {
    const index = readFileSync('functions/src/index.ts', 'utf8');
    const assertAt = index.indexOf('assertBackendEnvironment()');
    expect(assertAt).toBeGreaterThan(0);
    expect(assertAt).toBeLessThan(index.indexOf('setGlobalOptions('));
    expect(index).toMatch(/setGlobalOptions\(\{ region: BACKEND_ENV\.region!/);
    expect(readFileSync('functions/src/shared/config.ts', 'utf8')).not.toMatch(/REGION\s*=/);
  });

  it('ENV-014 the committed backend parameter files match their registry targets', () => {
    for (const [file, project] of [['functions/.env.demo-dsbc', 'demo-dsbc'], [`functions/.env.${PROD.firebase!.projectId}`, PROD.firebase!.projectId]]) {
      const vars = Object.fromEntries(
        readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
      );
      const e = evaluateBackendEnvironment({ ...vars, GCLOUD_PROJECT: project, FUNCTIONS_EMULATOR: project.startsWith('demo-') ? 'true' : undefined });
      expect(e.problems, file).toEqual([]);
    }
  });
});

describe('ENV: deployment preflight', () => {
  it('ENV-015 the production preflight has no FAIL (only owner designations may block)', () => {
    const report = runPreflight({ target: 'production' });
    expect(report.checks.filter((c) => c.status === 'FAIL')).toEqual([]);
    const blocked = report.checks.filter((c) => c.status === 'BLOCKED').map((c) => c.id);
    for (const id of blocked) expect(['HOSTING_SITE_DESIGNATED', 'PUBLIC_ORIGIN_DESIGNATED', 'STAGING_DESIGNATED', 'BUNDLE']).toContain(id);
  });

  it('ENV-016 a bare "firebase deploy" targets the emulator project, never production', () => {
    const rc = JSON.parse(readFileSync('.firebaserc', 'utf8'));
    expect(rc.projects.default).toMatch(/^demo-/);
    const fb = JSON.parse(readFileSync('firebase.json', 'utf8'));
    expect(fb.hosting).toBeUndefined(); // the emulator config cannot deploy hosting
  });
});
