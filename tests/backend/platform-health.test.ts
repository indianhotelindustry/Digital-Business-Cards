// Directive 27 Phase 4 — Platform Health over the real callable
// (Cloud Functions + Auth + Firestore + Storage emulators). Every check must
// be measured from its authoritative source and the verdict must fail closed.
import { beforeAll, describe, expect, it } from 'vitest';
import { adminAuth, adminDb, call, createUser, ok, resetEmulators, type TestUser } from './support/backendEnv';
import { PLATFORM_HEALTH_CHECKS, type PlatformHealthReport } from '../../shared/domain/platformHealth';

let owner: TestUser;
const health = (who: TestUser | null, data: unknown = {}) => call<PlatformHealthReport>('adminGetPlatformHealth', data, who);
const byId = (r: PlatformHealthReport) => Object.fromEntries(r.checks.map((c) => [c.id, c]));

beforeAll(async () => {
  await resetEmulators();
  owner = await createUser('u_health_owner', { claims: { platformRole: 'app_owner' } });
});

describe('HEALTH: platform health callable', () => {
  it('HEALTH-101 only a verified App Owner may measure platform health', async () => {
    const customer = await createUser('u_health_customer');
    const unverifiedOwner = await createUser('u_health_unverified', { claims: { platformRole: 'app_owner' }, verified: false });
    for (const who of [null, customer, unverifiedOwner]) {
      const r = await health(who);
      expect(r.ok, who?.uid ?? 'anonymous').toBe(false);
    }
    expect((await health(owner, { forceOk: true })).ok).toBe(false); // no payload can steer the result
  });

  it('HEALTH-102 an un-bootstrapped platform is FAIL, with every required check measured and sourced', async () => {
    const report = await ok<PlatformHealthReport>('adminGetPlatformHealth', {}, owner);
    expect(report.checks.map((c) => c.id).sort()).toEqual([...PLATFORM_HEALTH_CHECKS].sort());
    for (const c of report.checks) expect(c.source, c.id).toBeTruthy();
    const c = byId(report);
    expect(c.ENVIRONMENT.state, c.ENVIRONMENT.detail).toBe('OK');
    expect(c.ENVIRONMENT.detail).toMatch(/development target: project demo-dsbc/);
    expect(c.AUTH.state, c.AUTH.detail).toBe('OK');
    expect(c.APP_OWNER.state, c.APP_OWNER.detail).toBe('DEGRADED'); // u_health_unverified holds the claim without a verified email
    expect(c.FIRESTORE.state, c.FIRESTORE.detail).toBe('OK');
    expect(c.INDEXES.state, c.INDEXES.detail).toBe('OK');
    expect(c.STORAGE.state, c.STORAGE.detail).toBe('OK');
    expect(c.FUNCTIONS.state, c.FUNCTIONS.detail).toBe('OK');
    expect(c.ENTITLEMENTS.state, c.ENTITLEMENTS.detail).toBe('FAIL');
    expect(c.PUBLISHING.state, c.PUBLISHING.detail).toBe('DEGRADED');
    expect(c.PUBLIC_URL.state, c.PUBLIC_URL.detail).toBe('NOT_CONFIGURED');
    expect(c.NOTIFICATIONS.state, c.NOTIFICATIONS.detail).toBe('NOT_CONFIGURED');
    expect(c.PAYMENTS.state, c.PAYMENTS.detail).toBe('DISABLED');
    expect(c.WEBHOOK.state, c.WEBHOOK.detail).toBe('DISABLED');
    expect(c.RECONCILIATION.state, c.RECONCILIATION.detail).toBe('NOT_VERIFIED');
    expect(report.overall).toBe('FAIL');
    expect(report.projectId).toBe('demo-dsbc');
  });

  it('HEALTH-103 bootstrapping and a reconciler run turn those checks OK; unconfigured parts keep it from OK', async () => {
    await ok('bootstrapControlPlane', { reason: 'D27 health test bootstrap' }, owner);
    await adminDb.doc('platformConfig/deployment').set({ id: 'deployment', bootstrapVersion: 1, reservedSlugs: ['admin', 'app'], paymentsEnabled: false });
    await ok('adminReconcileNow', {}, owner);
    await adminAuth.setCustomUserClaims('u_health_unverified', null);
    // Records exactly as setPublishingState writes them (publishingState field).
    await adminDb.doc('publishingRecords/co_x').set({ id: 'co_x', entityType: 'company', tenantId: 'co_x', publishingState: 'PUBLISHED', slug: 'x-co' });
    await adminDb.doc('publishingRecords/emp_x').set({ id: 'emp_x', entityType: 'card', tenantId: 'co_x', publishingState: 'UNPUBLISHED', slug: 'x-emp' });

    const report = await ok<PlatformHealthReport>('adminGetPlatformHealth', {}, owner);
    const c = byId(report);
    expect(c.ENTITLEMENTS.state, c.ENTITLEMENTS.detail).toBe('OK');
    expect(c.PUBLISHING.state, c.PUBLISHING.detail).toBe('OK');
    expect(c.PUBLISHING.detail).toMatch(/; 1 published records/);
    expect(c.RECONCILIATION.state, c.RECONCILIATION.detail).toBe('OK');
    expect(c.APP_OWNER.state, c.APP_OWNER.detail).toBe('OK');
    expect(c.APP_OWNER.detail).toMatch(/1 active App Owner/);
    // No public origin and no notification provider: never reported as healthy.
    expect(report.overall).toBe('DEGRADED');
  });

  it('HEALTH-104 a reconciler heartbeat older than 26 hours is DEGRADED, never OK', async () => {
    await adminDb.doc('platformConfig/reconciliation').set({ lastRunAt: new Date(Date.now() - 30 * 3600 * 1000), examined: 0, changed: 0 });
    const c = byId(await ok<PlatformHealthReport>('adminGetPlatformHealth', {}, owner));
    expect(c.RECONCILIATION.state, c.RECONCILIATION.detail).toBe('DEGRADED');
  });
});
