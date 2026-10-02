import { describe, expect, it } from 'vitest';
import { isProductionLike, parseArgs, resolveAdminTarget } from '../../scripts/admin/adminTarget';

const real = {}; // no FIRESTORE_EMULATOR_HOST
const emu = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', GCLOUD_PROJECT: 'demo-dsbc' };

describe('parseArgs', () => {
  it('parses flags and values', () => {
    expect(parseArgs(['--project', 'p', '--revoke', '--email', 'a@b'])).toEqual({ project: 'p', revoke: true, email: 'a@b' });
  });
});

describe('resolveAdminTarget — emulator', () => {
  it('allows demo-* emulator projects without confirmation', () => {
    expect(resolveAdminTarget({}, 'seed-demo', emu)).toEqual({ projectId: 'demo-dsbc', databaseId: '(default)', emulator: true });
  });
});

describe('resolveAdminTarget — real projects', () => {
  it('requires --confirm-project matching --project', () => {
    expect(() => resolveAdminTarget({ project: 'dsbc-dev' }, 'grant-app-owner', real)).toThrow(/confirm-project/);
    expect(() => resolveAdminTarget({ project: 'dsbc-dev', 'confirm-project': 'other' }, 'grant-app-owner', real)).toThrow(/confirm-project/);
    expect(resolveAdminTarget({ project: 'dsbc-dev', 'confirm-project': 'dsbc-dev', database: '(default)' }, 'grant-app-owner', real).emulator).toBe(false);
  });

  it('never seeds demo data into production-like projects', () => {
    const args = { project: 'dsbc-prod', 'confirm-project': 'dsbc-prod', database: '(default)', 'allow-non-emulator': true };
    expect(() => resolveAdminTarget(args, 'seed-demo', real)).toThrow(/production-like/);
    const listed = { project: 'customer-live', 'confirm-project': 'customer-live', database: '(default)', 'allow-non-emulator': true };
    expect(() => resolveAdminTarget(listed, 'seed-demo', { DSBC_PRODUCTION_PROJECT_IDS: 'customer-live, other' })).toThrow(/production-like/);
  });

  it('requires --allow-non-emulator to seed a real development project', () => {
    expect(() => resolveAdminTarget({ project: 'dsbc-dev', 'confirm-project': 'dsbc-dev', database: '(default)' }, 'seed-demo', real)).toThrow(/allow-non-emulator/);
    expect(resolveAdminTarget({ project: 'dsbc-dev', 'confirm-project': 'dsbc-dev', database: '(default)', 'allow-non-emulator': true }, 'seed-demo', real).projectId).toBe('dsbc-dev');
  });

  it('flags production-like ids', () => {
    expect(isProductionLike('dsbc-production', {})).toBe(true);
    expect(isProductionLike('dsbc-dev', {})).toBe(false);
  });
});
