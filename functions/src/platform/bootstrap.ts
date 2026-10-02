// ============================================================================
// Production Firestore bootstrap (Directive 27 Phase 2)
// ============================================================================
// Deterministic, idempotent creation of the platform configuration a fresh
// production database needs:
//   plans/*                 default plans (INITIAL_PLANS)
//   featureCatalogue/*      feature catalogue (FEATURE_CATALOGUE + dependencies)
//   globalPolicies/platform global policy (INITIAL_GLOBAL_POLICY; payments stay off)
//   platformConfig/deployment  reserved slugs + bootstrap metadata
// Every document is CREATE-IF-MISSING: an existing document is never
// overwritten (drift is reported instead), so running it twice changes
// nothing. It never touches customer collections and never creates demo
// companies, employees, subscriptions, invoices, pilots or payment events.
// Counters: none are global; usageCounters/* are created on demand by the
// backend when usage is first measured.

import { db } from '../shared/firebase';
import { serverNow } from '../shared/time';
import { appendAudit, type AuditActor } from '../audit/ledger';
import { seedControlPlane } from '../entitlements/admin';
import { POLICY_DOC as POLICY_DOC_ID } from '../entitlements/controlPlane';
import { FEATURE_CATALOGUE, INITIAL_PLANS } from '../../../shared/domain/catalogue';
import { RESERVED_SLUGS } from '../../../shared/domain/slugRules';

export const BOOTSTRAP_VERSION = 1;
export const PLATFORM_CONFIG_DOC = 'deployment';

/** Collections the bootstrap may create documents in — nothing else. */
export const BOOTSTRAP_COLLECTIONS = ['plans', 'featureCatalogue', 'globalPolicies', 'platformConfig', 'entitlementAuditLogs', 'platformAuditLogs'] as const;
/** Customer / commercial collections the bootstrap must never write. */
export const CUSTOMER_COLLECTIONS = [
  'users', 'companies', 'employees', 'departments', 'digitalIdentityProfiles', 'cards', 'subscriptions', 'invoices',
  'paymentOrders', 'paymentEvents', 'entitlementOverrides', 'usageCounters', 'publishingRecords', 'slugs', 'leads', 'pilots',
] as const;

export interface BootstrapPlanItem {
  path: string;
  state: 'EXISTS' | 'WOULD_CREATE' | 'CREATED';
}

export interface BootstrapResult {
  bootstrapVersion: number;
  dryRun: boolean;
  items: BootstrapPlanItem[];
  created: string[];
  existing: string[];
  drift: Array<{ path: string; field: string; expected: unknown; actual: unknown }>;
}

const sortedReserved = () => [...RESERVED_SLUGS].sort();

/** Read-only inventory of what the bootstrap would create. */
export async function planBootstrap(): Promise<BootstrapPlanItem[]> {
  const firestore = db();
  const refs = [
    ...INITIAL_PLANS.map((p) => firestore.collection('plans').doc(p.id)),
    ...FEATURE_CATALOGUE.map((f) => firestore.collection('featureCatalogue').doc(f.id)),
    firestore.collection('globalPolicies').doc(POLICY_DOC_ID),
    firestore.collection('platformConfig').doc(PLATFORM_CONFIG_DOC),
  ];
  const snaps = await firestore.getAll(...refs);
  return snaps.map((s) => ({ path: s.ref.path, state: s.exists ? 'EXISTS' : 'WOULD_CREATE' }));
}

export async function bootstrapPlatform(actor: AuditActor, reasonText: string, opts: { dryRun?: boolean; environment: string }): Promise<BootstrapResult> {
  const before = await planBootstrap();
  const existing = before.filter((i) => i.state === 'EXISTS').map((i) => i.path);
  if (opts.dryRun) {
    return { bootstrapVersion: BOOTSTRAP_VERSION, dryRun: true, items: before, created: [], existing, drift: await detectDrift() };
  }

  // Control plane (plans, catalogue, policy): the same create-if-missing seed
  // the App Owner's bootstrapControlPlane callable uses.
  const { created } = await seedControlPlane(actor, reasonText);

  // Platform configuration document.
  const firestore = db();
  const cfgRef = firestore.collection('platformConfig').doc(PLATFORM_CONFIG_DOC);
  const cfgCreated = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(cfgRef);
    if (snap.exists) return false;
    tx.create(cfgRef, {
      id: PLATFORM_CONFIG_DOC,
      bootstrapVersion: BOOTSTRAP_VERSION,
      environment: opts.environment,
      reservedSlugs: sortedReserved(),
      reservedSlugsSource: 'shared/domain/slugRules.ts (enforced by the backend on every publish)',
      paymentsEnabled: false,
      createdAt: serverNow(),
      createdBy: actor.uid,
    });
    appendAudit(tx, 'platformAuditLogs', {
      action: 'PLATFORM_CONFIG_BOOTSTRAPPED', actor, targetType: 'global', targetId: 'platform_config', targetName: 'Platform configuration',
      previousValue: null, newValue: { bootstrapVersion: BOOTSTRAP_VERSION, reservedSlugs: RESERVED_SLUGS.size }, reason: reasonText, source: 'bootstrapPlatform',
    });
    return true;
  });
  const allCreated = [...created, ...(cfgCreated ? [cfgRef.path] : [])];
  const after = await planBootstrap();
  return {
    bootstrapVersion: BOOTSTRAP_VERSION,
    dryRun: false,
    items: after.map((i) => ({ ...i, state: allCreated.includes(i.path) ? 'CREATED' : i.state })),
    created: allCreated,
    existing,
    drift: await detectDrift(),
  };
}

/**
 * Existing documents that differ from the bootstrap defaults. Informational:
 * App Owner edits (e.g. pricing) are legitimate and are never overwritten.
 */
export async function detectDrift(): Promise<BootstrapResult['drift']> {
  const drift: BootstrapResult['drift'] = [];
  const cfg = await db().collection('platformConfig').doc(PLATFORM_CONFIG_DOC).get();
  if (cfg.exists) {
    const actual = (cfg.get('reservedSlugs') as string[] | undefined) ?? [];
    const expected = sortedReserved();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) drift.push({ path: cfg.ref.path, field: 'reservedSlugs', expected: expected.length, actual: actual.length });
    if (cfg.get('paymentsEnabled') !== false) drift.push({ path: cfg.ref.path, field: 'paymentsEnabled', expected: false, actual: cfg.get('paymentsEnabled') });
  }
  const plans = await db().getAll(...INITIAL_PLANS.map((p) => db().collection('plans').doc(p.id)));
  plans.forEach((s, i) => {
    if (!s.exists) return;
    const p = INITIAL_PLANS[i];
    for (const field of ['targetType', 'price', 'currency', 'billingCycle'] as const) {
      if (s.get(field) !== p[field]) drift.push({ path: s.ref.path, field, expected: p[field], actual: s.get(field) });
    }
  });
  return drift;
}
