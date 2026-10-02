// ============================================================================
// App Owner platform health (Directive 27 Phase 4)
// ============================================================================
// Every check is MEASURED when the App Owner asks, against its authoritative
// source: the Auth service, the bound Firestore database, the real bucket,
// the registry (config/environments.json) via shared/environment.ts, the
// control-plane documents, the deployed hosting origin. A check the backend
// cannot perform reports NOT_VERIFIED / NOT_CONFIGURED and a check that
// throws reports FAIL: nothing is OK by assumption (contrast: the Directive 20
// tab hard-coded "HEALTHY / 99.98%"). overallHealth() is OK only when every
// check is OK or intentionally DISABLED.

import { adminAuth, bucket, db, DATABASE_ID } from '../shared/firebase';
import { toIso } from '../shared/time';
import { obj } from '../shared/validate';
import { APP_OWNER_CLAIM, requireAppOwner, type Caller } from '../auth/identity';
import type { BackendEnvironment } from '../shared/environment';
import { INITIAL_PLANS } from '../../../shared/domain/catalogue';
import { overallHealth, type PlatformHealthCheck, type PlatformHealthCheckId, type PlatformHealthReport, type PlatformHealthState } from '../../../shared/domain/platformHealth';
import { PLATFORM_CONFIG_DOC } from './bootstrap';

export const RECONCILIATION_DOC = 'reconciliation';
/** The reconciler runs every 24 hours; allow two hours of slack. */
const RECONCILIATION_MAX_AGE_MS = 26 * 3600 * 1000;
/** Safety bound for the App Owner census (Auth listUsers pages of 1000). */
const MAX_USERS_SCANNED = 20000;

export interface HealthContext {
  backendEnvironment: BackendEnvironment;
  paymentsEnabled: boolean;
  paymentKeyIdConfigured: boolean;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

type Outcome = { state: PlatformHealthState; detail: string; source: string };

async function measure(id: PlatformHealthCheckId, source: string, fn: () => Promise<Omit<Outcome, 'source'>>): Promise<PlatformHealthCheck> {
  const t = Date.now();
  try {
    const r = await fn();
    return { id, source, ...r, latencyMs: Date.now() - t };
  } catch (err) {
    return { id, source, state: 'FAIL', detail: `Check failed: ${(err as Error).message}`.slice(0, 300), latencyMs: Date.now() - t };
  }
}

/**
 * Every query shape the backend issues, run with limit(1). A missing composite
 * index surfaces as FAILED_PRECONDITION (gRPC 9) here instead of at the first
 * customer request.
 */
export const REQUIRED_QUERY_SHAPES: Array<{ name: string; run: () => Promise<unknown> }> = [
  { name: 'users by companyId+role', run: () => db().collection('users').where('companyId', '==', '_').where('role', '==', 'company_admin').limit(1).get() },
  { name: 'employees by companyId', run: () => db().collection('employees').where('companyId', '==', '_').limit(1).get() },
  { name: 'cards by companyId', run: () => db().collection('cards').where('companyId', '==', '_').limit(1).get() },
  { name: 'departments by companyId', run: () => db().collection('departments').where('companyId', '==', '_').limit(1).get() },
  { name: 'entitlementOverrides by targetType+targetId', run: () => db().collection('entitlementOverrides').where('targetType', '==', 'company').where('targetId', '==', '_').limit(1).get() },
  { name: 'entitlementOverrides by targetType+targetId in', run: () => db().collection('entitlementOverrides').where('targetType', '==', 'individual').where('targetId', 'in', ['_']).limit(1).get() },
  { name: 'customerClassifications by customerType+isPilot', run: () => db().collection('customerClassifications').where('customerType', '==', 'company').where('isPilot', '==', true).limit(1).get() },
  { name: 'paymentOrders by providerOrderId', run: () => db().collection('paymentOrders').where('providerOrderId', '==', '_').limit(1).get() },
  { name: 'publishingRecords by publishingState', run: () => db().collection('publishingRecords').where('publishingState', '==', 'PUBLISHED').limit(1).get() },
];

/** Pure: the ENVIRONMENT check from the backend's own registry evaluation. */
export function environmentOutcome(env: BackendEnvironment): { state: PlatformHealthState; detail: string } {
  if (!env.ok || env.problems.length) return { state: 'FAIL', detail: env.problems.join(' ') || 'Backend environment not verified.' };
  return { state: 'OK', detail: `${env.key} target: project ${env.projectId}, database ${env.databaseId}, region ${env.region}${env.emulator ? ' (emulator)' : ''} all match the registry.` };
}

/** Measures every check. Callers must already be authorised (adminGetPlatformHealth). */
async function measurePlatformHealth(caller: Caller, ctx: HealthContext): Promise<PlatformHealthReport> {
  const env = ctx.backendEnvironment;
  const fetchImpl = ctx.fetchImpl ?? fetch;
  const checks = await Promise.all([
    measure('ENVIRONMENT', 'config/environments.json vs the runtime (functions/src/shared/environment.ts)', async () => environmentOutcome(env)),
    measure('AUTH', 'Firebase Admin Auth lookup of the caller', async () => {
      const me = await adminAuth().getUser(caller.uid);
      if (me.disabled) return { state: 'FAIL', detail: 'The calling account is disabled.' };
      return { state: 'OK', detail: `Auth reachable; caller ${me.uid} verified by ID token and server lookup.` };
    }),
    measure('APP_OWNER', `Auth custom claim ${APP_OWNER_CLAIM} + verified email, all accounts`, async () => {
      const owners: string[] = [];
      const unverified: string[] = [];
      let scanned = 0;
      let pageToken: string | undefined;
      do {
        const page = await adminAuth().listUsers(1000, pageToken);
        for (const u of page.users) {
          if (u.customClaims?.[APP_OWNER_CLAIM] !== 'app_owner') continue;
          if (u.emailVerified && !u.disabled) owners.push(u.uid);
          else unverified.push(u.uid);
        }
        scanned += page.users.length;
        pageToken = page.pageToken;
      } while (pageToken && scanned < MAX_USERS_SCANNED);
      if (pageToken) return { state: 'NOT_VERIFIED', detail: `More than ${MAX_USERS_SCANNED} accounts; App Owner census incomplete.` };
      if (!owners.includes(caller.uid)) return { state: 'FAIL', detail: 'The caller passed the App Owner gate but is not in the server census.' };
      if (unverified.length) {
        return { state: 'DEGRADED', detail: `${owners.length} active App Owner(s); ${unverified.length} account(s) hold the claim without a verified email or are disabled (no authority, but the claim should be revoked).` };
      }
      return { state: 'OK', detail: `${owners.length} active App Owner account(s) (claim + verified email); scanned ${scanned} accounts.` };
    }),
    measure('FIRESTORE', `Firestore database ${DATABASE_ID}`, async () => {
      await db().collection('globalPolicies').doc('platform').get();
      return { state: 'OK', detail: `Read from database ${DATABASE_ID} succeeded.` };
    }),
    measure('INDEXES', 'Each backend query shape executed with limit(1)', async () => {
      const failed: string[] = [];
      for (const q of REQUIRED_QUERY_SHAPES) {
        try {
          await q.run();
        } catch (err) {
          const e = err as { code?: number | string; message?: string };
          if (e.code === 9 || e.code === 'failed-precondition' || /index/i.test(e.message || '')) failed.push(q.name);
          else throw err;
        }
      }
      return failed.length
        ? { state: 'FAIL', detail: `Missing indexes for: ${failed.join('; ')}. Deploy firestore.indexes.json to ${DATABASE_ID}.` }
        : { state: 'OK', detail: `All ${REQUIRED_QUERY_SHAPES.length} backend query shapes execute.` };
    }),
    measure('STORAGE', 'Storage bucket object listing', async () => {
      const b = bucket();
      if (env.storageBucket && b.name !== env.storageBucket) {
        return { state: 'FAIL', detail: `The backend writes to bucket ${b.name}, but the registry target uses ${env.storageBucket}.` };
      }
      try {
        // Listing one object needs the bucket to exist and the backend to have access (works on the emulator too).
        await b.getFiles({ maxResults: 1, autoPaginate: false });
      } catch (err) {
        const code = (err as { code?: number }).code;
        if (code === 404) return { state: 'FAIL', detail: `Bucket ${b.name} does not exist; uploads would fail. Provision Firebase Storage before deployment.` };
        if (code === 403) return { state: 'FAIL', detail: `The backend has no access to bucket ${b.name}.` };
        throw err;
      }
      return { state: 'OK', detail: `Bucket ${b.name} exists and the backend can list it.` };
    }),
    measure('FUNCTIONS', 'This callable executing', async () => ({
      state: 'OK',
      detail: `This health check executed in Cloud Functions (${env.region}${process.env.K_SERVICE ? `, service ${process.env.K_SERVICE}` : ''}${env.emulator ? ', emulator' : ''}).`,
    })),
    measure('PUBLIC_URL', 'HTTP requests to the designated public origin', async () => {
      if (!env.publicOrigin) return { state: 'NOT_CONFIGURED', detail: 'No public origin is designated for this target (publicOrigin / DSBC_PUBLIC_ORIGIN); public URLs cannot be verified.' };
      const base = env.publicOrigin.replace(/\/+$/, '');
      const home = await fetchImpl(`${base}/pricing`, { redirect: 'manual' });
      if (home.status !== 200) return { state: 'FAIL', detail: `${base}/pricing answered ${home.status}.` };
      const unknown = await fetchImpl(`${base}/__dsbc_health_unknown_path__`, { redirect: 'manual' });
      if (unknown.status !== 404) return { state: 'DEGRADED', detail: `${base}/pricing answered 200, but an unknown path answered ${unknown.status} instead of 404.` };
      return { state: 'OK', detail: `${base}/pricing answered 200 and unknown paths answer 404.` };
    }),
    measure('ENTITLEMENTS', 'plans/*, featureCatalogue/*, globalPolicies/platform', async () => {
      const [plans, catalogue, policy] = await Promise.all([
        db().getAll(...INITIAL_PLANS.map((p) => db().collection('plans').doc(p.id))),
        db().collection('featureCatalogue').count().get(),
        db().collection('globalPolicies').doc('platform').get(),
      ]);
      const missingPlans = plans.filter((s) => !s.exists).map((s) => s.id);
      const features = catalogue.data().count;
      if (!policy.exists && features === 0 && missingPlans.length === INITIAL_PLANS.length) {
        return { state: 'FAIL', detail: 'Control plane not bootstrapped (no plans, feature catalogue or global policy). Run the production bootstrap.' };
      }
      if (missingPlans.length || !features || !policy.exists) {
        return { state: 'DEGRADED', detail: `Partially bootstrapped: missing plans [${missingPlans.join(', ') || 'none'}], ${features} catalogue features, global policy ${policy.exists ? 'present' : 'missing'}.` };
      }
      return { state: 'OK', detail: `${plans.length} default plans, ${features} catalogue features and the global policy are in place.` };
    }),
    measure('PUBLISHING', `platformConfig/${PLATFORM_CONFIG_DOC} + publishingRecords`, async () => {
      const cfg = await db().collection('platformConfig').doc(PLATFORM_CONFIG_DOC).get();
      const published = await db().collection('publishingRecords').where('publishingState', '==', 'PUBLISHED').count().get();
      if (!cfg.exists) {
        return { state: 'DEGRADED', detail: `Platform configuration not bootstrapped (reserved slugs are still enforced in code). ${published.data().count} published records.` };
      }
      return { state: 'OK', detail: `Platform configuration v${cfg.get('bootstrapVersion')} with ${(cfg.get('reservedSlugs') as string[]).length} reserved slugs; ${published.data().count} published records.` };
    }),
    measure('AUDIT', 'Audit ledger collections', async () => {
      const [ent, com, plat] = await Promise.all(
        ['entitlementAuditLogs', 'commercialAuditLogs', 'platformAuditLogs'].map((c) => db().collection(c).count().get())
      );
      return { state: 'OK', detail: `Audit ledgers readable: ${ent.data().count} entitlement, ${com.data().count} commercial, ${plat.data().count} platform records.` };
    }),
    measure('NOTIFICATIONS', 'Backend notification integrations', async () => ({
      state: 'NOT_CONFIGURED',
      detail: 'No delivery provider is integrated on the backend; customer notifications are not sent by email.',
    })),
    measure('PAYMENTS', 'PAYMENTS_ENABLED / RAZORPAY_KEY_ID parameters', async () => {
      if (!ctx.paymentsEnabled) return { state: 'DISABLED', detail: 'PAYMENTS_ENABLED=false: checkout and payment confirmation are refused by the backend.' };
      return ctx.paymentKeyIdConfigured
        ? { state: 'NOT_VERIFIED', detail: 'Payments enabled with a key id; a live provider round trip has not been verified by this check.' }
        : { state: 'FAIL', detail: 'Payments enabled but RAZORPAY_KEY_ID is not configured.' };
    }),
    measure('WEBHOOK', 'razorpayWebhook + webhookEvents ledger', async () => {
      if (!ctx.paymentsEnabled) return { state: 'DISABLED', detail: 'Payments are disabled; the webhook rejects every event that is not signed with the webhook secret.' };
      const seen = await db().collection('webhookEvents').count().get();
      return seen.data().count > 0
        ? { state: 'OK', detail: `${seen.data().count} signed provider events processed.` }
        : { state: 'NOT_VERIFIED', detail: 'No signed provider event has been received yet; send a provider test event.' };
    }),
    measure('RECONCILIATION', `platformConfig/${RECONCILIATION_DOC}`, async () => {
      const snap = await db().collection('platformConfig').doc(RECONCILIATION_DOC).get();
      const last = snap.exists ? toIso(snap.get('lastRunAt')) : null;
      if (!last) return { state: 'NOT_VERIFIED', detail: 'The daily subscription reconciler has not recorded a run yet.' };
      const age = Date.now() - Date.parse(last);
      return age <= RECONCILIATION_MAX_AGE_MS
        ? { state: 'OK', detail: `Last reconciliation ${last} (examined ${snap.get('examined')}, changed ${snap.get('changed')}).` }
        : { state: 'DEGRADED', detail: `Last reconciliation ${last} is older than 26 hours.` };
    }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    environment: env.key ?? 'UNKNOWN',
    projectId: env.projectId ?? 'UNKNOWN',
    databaseId: DATABASE_ID,
    region: env.region ?? 'UNKNOWN',
    overall: overallHealth(checks),
    checks,
  };
}

export async function adminGetPlatformHealth(caller: Caller, data: unknown, ctx: HealthContext) {
  requireAppOwner(caller);
  obj(data ?? {}, []);
  return measurePlatformHealth(caller, ctx);
}
