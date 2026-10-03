// Directive 27 Phases 2-3: production bootstrap and existing-customer
// migration, executed with the real Admin SDK code paths against the Auth +
// Firestore emulators (npm run test:integration). Never touches a real project.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { runBootstrap } from '../../scripts/admin/bootstrapProduction';
import { template } from '../../scripts/admin/migrateCustomers';
import { BOOTSTRAP_COLLECTIONS, CUSTOMER_COLLECTIONS } from '../../functions/src/platform/bootstrap';
import { discoverCustomers, executeMigration, MigrationRefused, validateApproval, type MigrationApproval } from '../../functions/src/platform/migration';
import { FEATURE_CATALOGUE, INITIAL_PLANS } from '../../shared/domain/catalogue';

const PROJECT = 'demo-dsbc';
let app: App;
let auth: Auth;
let db: Firestore;

async function clearEmulators() {
  const r1 = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const r2 = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  if (!r1.ok || !r2.ok) throw new Error(`Failed to clear emulators (${r1.status}/${r2.status})`);
}

async function inventory(collections: readonly string[]) {
  const out: Record<string, number> = {};
  for (const c of collections) out[c] = (await db.collection(c).count().get()).data().count;
  return out;
}

async function dump(collections: string[]) {
  const out: Record<string, unknown> = {};
  for (const c of collections) {
    for (const d of (await db.collection(c).get()).docs) out[`${c}/${d.id}`] = d.data();
  }
  return out;
}

const bootstrap = (extra: Record<string, string | boolean> = {}) => runBootstrap({ reason: 'D27 integration test', ...extra });

async function makeOwner(uid = 'owner_1', verified = true) {
  await auth.createUser({ uid, email: `${uid}@owner.dsbc.test`, emailVerified: verified, password: 'secret123' });
  await auth.setCustomUserClaims(uid, { platformRole: 'app_owner' });
  await db.collection('users').doc(uid).set({ id: uid, role: 'app_owner', email: `${uid}@owner.dsbc.test`, status: 'active' });
  return uid;
}

/** A pre-D25 company: content but no subscription. */
async function legacyCompany(id: string, opts: { adminVerified?: boolean; planId?: string; email?: string } = {}) {
  const adminUid = `${id}_admin`;
  const email = opts.email ?? `${adminUid}@customer-mail.in`;
  await auth.createUser({ uid: adminUid, email, emailVerified: opts.adminVerified ?? true, password: 'secret123' });
  await db.collection('companies').doc(id).set({ id, name: `Company ${id}`, status: 'active', branding: { primaryColor: '#123456' }, ...(opts.planId ? { planId: opts.planId } : {}) });
  await db.collection('users').doc(adminUid).set({ id: adminUid, role: 'company_admin', companyId: id, email, status: 'active' });
  await db.collection('employees').doc(`${id}_emp1`).set({ id: `${id}_emp1`, companyId: id, displayName: 'Employee One', title: 'Sales' });
  await db.collection('digitalIdentityProfiles').doc(`${id}_emp1`).set({ employeeId: `${id}_emp1`, companyId: id, headline: 'Hello' });
  await db.collection('publishingRecords').doc(id).set({ entityId: id, entityType: 'company', tenantId: id, publishingState: 'PUBLISHED', slug: id });
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Integration tests require the Auth and Firestore emulators (npm run test:integration).');
  }
  app = initializeApp({ projectId: PROJECT }, 'production-ops');
  auth = getAuth(app);
  db = getFirestore(app);
});
afterAll(async () => app && deleteApp(app));
beforeEach(clearEmulators);

describe('BOOT: production bootstrap', () => {
  it('BOOT-001 a dry run reports what it would create and writes nothing', async () => {
    const report = await bootstrap({ 'dry-run': true });
    expect(report.dryRun).toBe(true);
    expect(report.created).toEqual([]);
    expect(report.items.every((i) => i.state === 'WOULD_CREATE')).toBe(true);
    expect(Object.values(await inventory([...BOOTSTRAP_COLLECTIONS, ...CUSTOMER_COLLECTIONS])).every((n) => n === 0)).toBe(true);
  });

  it('BOOT-002 creates plans, feature catalogue, global policy and platform configuration, and nothing else', async () => {
    await legacyCompany('acme_real');
    const before = await dump([...CUSTOMER_COLLECTIONS]);
    const report = await bootstrap();
    expect(report.status).toBe('PASS');
    expect(report.customerCollectionsUnchanged).toBe(true);
    expect(report.created).toHaveLength(INITIAL_PLANS.length + FEATURE_CATALOGUE.length + 2);
    expect((await db.collection('plans').count().get()).data().count).toBe(INITIAL_PLANS.length);
    expect((await db.collection('featureCatalogue').count().get()).data().count).toBe(FEATURE_CATALOGUE.length);
    expect((await db.collection('globalPolicies').doc('platform').get()).exists).toBe(true);
    const cfg = (await db.collection('platformConfig').doc('deployment').get()).data()!;
    expect(cfg.paymentsEnabled).toBe(false);
    expect(cfg.reservedSlugs).toContain('admin');
    expect(cfg.environment).toBe('development');
    expect(await dump([...CUSTOMER_COLLECTIONS])).toEqual(before);
    // Every creation is in the audit ledger.
    expect((await db.collection('entitlementAuditLogs').where('action', '==', 'CONTROL_PLANE_BOOTSTRAPPED').get()).size).toBe(1);
    expect((await db.collection('platformAuditLogs').where('action', '==', 'PLATFORM_CONFIG_BOOTSTRAPPED').get()).size).toBe(1);
  });

  it('BOOT-003 is idempotent and never overwrites App Owner changes (drift is reported instead)', async () => {
    await bootstrap();
    await db.collection('plans').doc(INITIAL_PLANS[1].id).update({ price: 4242 });
    const before = await dump(['plans', 'featureCatalogue', 'globalPolicies', 'platformConfig']);
    const auditBefore = (await db.collection('entitlementAuditLogs').count().get()).data().count;
    const second = await bootstrap();
    expect(second.created).toEqual([]);
    expect(second.items.every((i) => i.state === 'EXISTS')).toBe(true);
    expect(second.drift).toContainEqual(expect.objectContaining({ path: `plans/${INITIAL_PLANS[1].id}`, field: 'price', actual: 4242 }));
    expect(await dump(['plans', 'featureCatalogue', 'globalPolicies', 'platformConfig'])).toEqual(before);
    expect((await db.collection('entitlementAuditLogs').count().get()).data().count).toBe(auditBefore);
  });

  it('BOOT-004 never creates demo customers, subscriptions, invoices, payments or pilots', async () => {
    await bootstrap();
    expect(Object.values(await inventory(CUSTOMER_COLLECTIONS)).every((n) => n === 0)).toBe(true);
    expect((await auth.listUsers()).users).toHaveLength(0);
  });

  it('BOOT-005 refuses to run without an audited reason', async () => {
    await expect(runBootstrap({})).rejects.toThrow(/--reason/);
  });

  it('BOOT-006 the browser never seeds: no client code calls a seed or bootstrap path', () => {
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    })('src');
    const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(text).not.toMatch(/\.bootstrapControlPlane\(|seedControlPlane|seedDemoData\(|bootstrapPlatform/);
  });
});

describe('BOOT: customerActivationMode policy field (D30)', () => {
  it('BOOT-004 bootstrap writes customerActivationMode=manual_approval and reports zero drift', async () => {
    const report = await bootstrap();
    expect(report.status).toBe('PASS');
    expect((await db.collection('globalPolicies').doc('platform').get()).get('customerActivationMode')).toBe('manual_approval');
    expect(report.drift).toEqual([]);
    expect((await bootstrap()).drift).toEqual([]);
  });

  it('BOOT-005 an App Owner change of customerActivationMode, or a legacy policy without it, is not drift', async () => {
    await bootstrap();
    await db.collection('globalPolicies').doc('platform').update({ customerActivationMode: 'auto' });
    expect((await bootstrap()).drift).toEqual([]);
    await db.collection('globalPolicies').doc('platform').update({ customerActivationMode: FieldValue.delete() });
    expect((await bootstrap()).drift).toEqual([]);
  });
});

describe('MIG: existing-customer migration', () => {
  async function world() {
    await bootstrap();
    const owner = await makeOwner();
    await legacyCompany('acme_real');
    await legacyCompany('beta_paid', { planId: 'company_pro' });
    await legacyCompany('gamma_unverified', { adminVerified: false });
    await legacyCompany('company_acme', { email: 'admin@acme.example.com' }); // legacy in-app demo id
    // An individual with a profile, and one already migrated.
    await auth.createUser({ uid: 'indiv_1', email: 'indiv1@customer-mail.in', emailVerified: true, password: 'secret123' });
    await db.collection('users').doc('indiv_1').set({ id: 'indiv_1', role: 'individual', email: 'indiv1@customer-mail.in', status: 'active' });
    await db.collection('digitalIdentityProfiles').doc('indiv_1').set({ individualId: 'indiv_1', headline: 'Solo' });
    await auth.createUser({ uid: 'indiv_2', email: 'indiv2@customer-mail.in', emailVerified: true, password: 'secret123' });
    await db.collection('users').doc('indiv_2').set({ id: 'indiv_2', role: 'individual', email: 'indiv2@customer-mail.in', status: 'active' });
    await db.collection('subscriptions').doc('individual_indiv_2').set({ customerType: 'individual', customerId: 'indiv_2', planId: 'individual_free', status: 'ACTIVE' });
    // A profile whose company no longer exists.
    await db.collection('users').doc('orphan_1').set({ id: 'orphan_1', role: 'employee', companyId: 'gone_co', status: 'active' });
    return owner;
  }

  const CONTENT = ['companies', 'employees', 'digitalIdentityProfiles', 'publishingRecords', 'users', 'cards', 'departments'];
  const withoutPlanMirror = (d: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(d).map(([k, v]) => [k, k.startsWith('companies/') ? { ...(v as object), planId: undefined } : v]));

  it('MIG-001 discovery is read-only and classifies every customer', async () => {
    await world();
    const before = await dump([...CUSTOMER_COLLECTIONS, ...BOOTSTRAP_COLLECTIONS]);
    const preview = await discoverCustomers();
    expect(await dump([...CUSTOMER_COLLECTIONS, ...BOOTSTRAP_COLLECTIONS])).toEqual(before);

    const by = Object.fromEntries(preview.customers.map((c) => [c.key, c]));
    expect(by['company:acme_real'].subscription.proposal).toBe('ASSIGN_FREE');
    expect(by['company:acme_real'].content).toMatchObject({ employees: 1, profiles: 1, publishingState: 'PUBLISHED' });
    expect(by['company:beta_paid'].flags).toContain('LEGACY_PAID_PLAN_CLAIM');
    expect(by['company:beta_paid'].subscription.proposal).toBe('OWNER_DECISION_REQUIRED');
    expect(by['company:gamma_unverified'].flags).toContain('NO_VERIFIED_IDENTITY');
    expect(by['company:gamma_unverified'].subscription.proposal).toBe('OWNER_DECISION_REQUIRED');
    expect(by['company:company_acme'].flags).toContain('DEMO_CANDIDATE');
    expect(by['individual:indiv_1'].subscription.proposal).toBe('ASSIGN_FREE');
    expect(by['individual:indiv_2'].subscription.proposal).toBe('NONE_NEEDED');
    expect(preview.excluded.map((e) => e.ref)).toEqual(['users/orphan_1', 'users/owner_1']);
    // Nothing paid is ever proposed.
    expect(preview.customers.every((c) => c.subscription.proposedPlanId === null || /_free$/.test(c.subscription.proposedPlanId))).toBe(true);
    expect(preview.previewHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('MIG-002 the approval must come from a verified App Owner', async () => {
    await world();
    await auth.createUser({ uid: 'not_owner', email: 'x@customer-mail.in', emailVerified: true, password: 'secret123' });
    await makeOwner('owner_unverified', false);
    const preview = await discoverCustomers();
    for (const uid of ['not_owner', 'owner_unverified', 'nobody']) {
      await expect(validateApproval(template(preview, uid), preview), uid).rejects.toThrow(MigrationRefused);
    }
  });

  it('MIG-003 a preview approved before the data changed is refused (hash mismatch)', async () => {
    const owner = await world();
    const approval = template(await discoverCustomers(), owner);
    await db.collection('employees').doc('acme_real_emp2').set({ id: 'acme_real_emp2', companyId: 'acme_real', displayName: 'New hire' });
    await expect(executeMigration(approval, 'run_stale_01')).rejects.toThrow(/preview hash mismatch/);
    expect((await db.collection('subscriptions').count().get()).data().count).toBe(1);
    expect((await db.collection('migrationRuns').doc('run_stale_01').get()).exists).toBe(false);
  });

  it('MIG-004 demo candidates, existing subscriptions and unevidenced grants are refused', async () => {
    const owner = await world();
    const preview = await discoverCustomers();
    const base = template(preview, owner);
    const bad: Array<[string, MigrationApproval['decisions'][string]]> = [
      ['company:company_acme', { action: 'ASSIGN_FREE' }],
      ['individual:indiv_2', { action: 'ASSIGN_FREE' }],
      ['company:beta_paid', { action: 'GRANT_COMPLIMENTARY', planId: 'company_pro', durationDays: 365, evidence: '' }],
      ['company:beta_paid', { action: 'GRANT_COMPLIMENTARY', planId: 'individual_pro', durationDays: 365, evidence: 'INV-2025-0042 paid by bank transfer' }],
      ['company:beta_paid', { action: 'GRANT_COMPLIMENTARY', planId: 'company_pro', durationDays: 0, evidence: 'INV-2025-0042 paid by bank transfer' }],
      ['company:unknown_co', { action: 'ASSIGN_FREE' }],
    ];
    for (const [key, decision] of bad) {
      const approval = { ...base, decisions: { ...base.decisions, [key]: decision } };
      await expect(validateApproval(approval, preview), `${key} ${JSON.stringify(decision)}`).rejects.toThrow(MigrationRefused);
    }
  });

  it('MIG-005 executes only approved decisions, preserves content and keeps an audit trail', async () => {
    const owner = await world();
    const preview = await discoverCustomers();
    const approval: MigrationApproval = template(preview, owner);
    // The template pre-fills only plain free mappings; everything needing a decision starts as SKIP.
    expect(approval.decisions['company:beta_paid']).toEqual({ action: 'SKIP' });
    expect(approval.decisions['company:company_acme']).toEqual({ action: 'SKIP' });
    approval.decisions['company:beta_paid'] = { action: 'GRANT_COMPLIMENTARY', planId: 'company_pro', durationDays: 365, evidence: 'INV-2025-0042 paid by bank transfer' };
    const content = await dump(CONTENT);

    const out = await executeMigration(approval, 'run_main_01');
    const outcome = Object.fromEntries(out.results.map((r) => [r.key, r.outcome]));
    expect(outcome).toMatchObject({
      'company:acme_real': 'ASSIGNED_FREE', 'individual:indiv_1': 'ASSIGNED_FREE', 'company:beta_paid': 'GRANTED_COMPLIMENTARY',
      'company:company_acme': 'SKIPPED', 'company:gamma_unverified': 'SKIPPED', 'individual:indiv_2': 'SKIPPED',
    });
    expect(out.results.find((r) => r.key === 'company:beta_paid')!.legacyPlanId).toBe('company_pro');

    const subs = Object.fromEntries((await db.collection('subscriptions').get()).docs.map((d) => [d.id, d.data()]));
    expect(subs.company_acme_real).toMatchObject({ planId: 'company_free' });
    expect(subs.company_beta_paid).toMatchObject({ planId: 'company_pro', status: 'COMPLIMENTARY' });
    expect(subs.company_company_acme).toBeUndefined();
    expect(subs.company_gamma_unverified).toBeUndefined();
    expect(subs.individual_indiv_2).toEqual({ customerType: 'individual', customerId: 'indiv_2', planId: 'individual_free', status: 'ACTIVE' });
    expect(Object.values(subs).some((s) => (s as { paymentStatus?: string }).paymentStatus === 'PAID')).toBe(false);

    // Content is untouched (only the companies.planId display mirror follows the new subscription).
    expect(withoutPlanMirror(await dump(CONTENT))).toEqual(withoutPlanMirror(content));

    const run = (await db.collection('migrationRuns').doc('run_main_01').get()).data()!;
    expect(run.status).toBe('COMPLETED');
    expect(run.previewHash).toBe(preview.previewHash);
    expect(run.approvedByUid).toBe(owner);
    const platformAudit = await db.collection('platformAuditLogs').where('action', '==', 'CUSTOMER_MIGRATION_EXECUTED').get();
    expect(platformAudit.size).toBe(1);
    const commercial = await db.collection('commercialAuditLogs').get();
    expect(commercial.docs.map((d) => d.get('targetId')).sort()).toEqual(['acme_real', 'beta_paid', 'indiv_1']);
    expect(commercial.docs.every((d) => String(d.get('reason')).includes('run_main_01'))).toBe(true);
  });

  it('MIG-006 is idempotent: a second run finds nothing to do and cannot replay the approval or the run id', async () => {
    const owner = await world();
    const approval = template(await discoverCustomers(), owner);
    await executeMigration(approval, 'run_first_01');
    const subsAfterFirst = await dump(['subscriptions']);

    // Replaying the same approval: the data changed (subscriptions exist), so the hash no longer matches.
    await expect(executeMigration(approval, 'run_second_01')).rejects.toThrow(/preview hash mismatch/);
    // Reusing a run id is refused before any write.
    const fresh = template(await discoverCustomers(), owner);
    await expect(executeMigration(fresh, 'run_first_01')).rejects.toThrow(/already exists/);

    const again = await discoverCustomers();
    expect(again.customers.find((c) => c.key === 'company:acme_real')!.subscription.proposal).toBe('NONE_NEEDED');
    expect(again.customers.find((c) => c.key === 'individual:indiv_1')!.subscription.proposal).toBe('NONE_NEEDED');
    const second = await executeMigration(template(again, owner), 'run_second_02');
    expect(second.results.every((r) => r.outcome === 'SKIPPED')).toBe(true);
    expect(await dump(['subscriptions'])).toEqual(subsAfterFirst);
  });

  it('MIG-007 a malformed run id is refused', async () => {
    const owner = await world();
    const approval = template(await discoverCustomers(), owner);
    for (const id of ['', 'x', '../escape', 'a'.repeat(65)]) {
      await expect(executeMigration(approval, id), id).rejects.toThrow(/runId/);
    }
  });
});
