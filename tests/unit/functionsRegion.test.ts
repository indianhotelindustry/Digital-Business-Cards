import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Directive 31: resolvePublicEntity and submitPublicLead were defined in their
// own modules, imported (and so evaluated) before index.ts called
// setGlobalOptions. firebase-functions computes each endpoint's region when
// onCall() runs, so those two shipped to us-central1 while the browser called
// asia-south1 — every public card answered "Card Not Found".
// Load the real bundle with the production target and check every export.

const REGISTRY = JSON.parse(readFileSync('config/environments.json', 'utf8'));
const prod = REGISTRY.environments.production;

test('REGION-001 every deployed function uses the production target region', () => {
  const build = spawnSync(process.execPath, ['build.mjs'], { cwd: 'functions', encoding: 'utf8' });
  expect(build.status, build.stderr).toBe(0);

  const probe = `
    const m = require('./lib/index.js');
    const out = {};
    for (const [name, fn] of Object.entries(m)) if (fn && fn.__endpoint) out[name] = fn.__endpoint.region ?? null;
    process.stdout.write(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['-e', probe], {
    cwd: 'functions',
    encoding: 'utf8',
    env: {
      ...process.env,
      DSBC_ENVIRONMENT: 'production',
      GCLOUD_PROJECT: prod.firebase.projectId,
      DSBC_FIRESTORE_DATABASE: prod.firestoreDatabaseId,
      DSBC_FUNCTIONS_REGION: prod.functionsRegion,
      DSBC_PUBLIC_ORIGIN: prod.publicOrigin,
      PAYMENTS_ENABLED: 'false',
      FUNCTIONS_EMULATOR: 'false',
    },
  });
  expect(run.status, run.stderr).toBe(0);
  const regions = JSON.parse(run.stdout) as Record<string, string[]>;

  expect(Object.keys(regions)).toEqual(expect.arrayContaining(['resolvePublicEntity', 'submitPublicLead', 'setPublishingState']));
  const wrong = Object.entries(regions).filter(([, r]) => JSON.stringify(r) !== JSON.stringify([prod.functionsRegion]));
  expect(wrong).toEqual([]);
}, 60_000);
