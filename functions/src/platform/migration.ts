// ============================================================================
// Existing-customer migration (Directive 27 Phase 3)
// ============================================================================
//   discover  ->  preview (hash)  ->  App Owner approval  ->  execute
//
// discoverCustomers() is READ-ONLY. It classifies every existing account
// (company / individual), verifies the identity behind it, inventories its
// content and proposes a subscription mapping. Nothing paid is ever proposed:
// the default is the free plan; a legacy paid claim (companies.planId written
// by the old browser code) only raises OWNER_DECISION_REQUIRED.
//
// executeMigration() requires an approval whose previewHash matches a fresh
// discovery (data unchanged since the owner reviewed it) and whose approver is
// a verified App Owner (custom claim, verified email). It only ever CREATES a
// subscription through the existing audited App Owner services
// (adminChangeCustomerPlan for the free plan, adminGrantComplimentary for an
// explicitly approved grant with evidence). It never deletes or edits customer
// content, never overwrites an existing subscription and never writes PAID.
// (The services refresh the companies.planId display mirror; the legacy value
// is kept in the run record, migrationRuns/{runId}.results[].legacyPlanId.)

import { createHash } from 'node:crypto';
import { adminAuth, db } from '../shared/firebase';
import { serverNow } from '../shared/time';
import { appendAudit } from '../audit/ledger';
import { APP_OWNER_CLAIM, type Caller, type ProfileDoc } from '../auth/identity';
import { adminChangeCustomerPlan, adminGrantComplimentary } from '../subscriptions/service';
import type { CustomerType } from '../../../shared/domain/subscriptionTypes';

/** Ids and markers of the legacy in-app demo dataset (src/services/seedService.ts) and test pilots. */
export const DEMO_IDS = new Set([
  'company_acme', 'company_nexus', 'user_app_owner_demo', 'user_admin_acme_demo', 'user_admin_nexus_demo', 'user_emp_rahul_demo',
  'emp_acme_rahul', 'emp_acme_priya', 'emp_acme_sarah', 'emp_nexus_elena', 'emp_nexus_marcus',
]);
const DEMO_EMAIL = /@(?:[a-z0-9-]+\.)*(?:test|example|example\.com|saas-cards\.io|dsbc\.test)$/i;

export type MigrationProposal = 'NONE_NEEDED' | 'ASSIGN_FREE' | 'OWNER_DECISION_REQUIRED';
export type MigrationFlag =
  | 'DEMO_CANDIDATE'
  | 'NO_VERIFIED_IDENTITY'
  | 'AUTH_ACCOUNT_MISSING'
  | 'ACCOUNT_SUSPENDED'
  | 'LEGACY_PAID_PLAN_CLAIM'
  | 'HAS_SUBSCRIPTION';

export interface DiscoveredCustomer {
  key: string;
  customerType: CustomerType;
  customerId: string;
  name: string;
  identity: { uids: string[]; authAccounts: number; verifiedAccounts: number; disabledAccounts: number };
  flags: MigrationFlag[];
  content: Record<string, number | string>;
  subscription: { existing: { planId: string; status: string } | null; legacyPlanId: string | null; proposal: MigrationProposal; proposedPlanId: string | null; note: string };
}

export interface MigrationPreview {
  schema: 'dsbc.migrationPreview/v1';
  customers: DiscoveredCustomer[];
  excluded: Array<{ ref: string; reason: string }>;
  summary: Record<string, number>;
  previewHash: string;
}

export type MigrationDecision =
  | { action: 'SKIP' }
  | { action: 'ASSIGN_FREE' }
  | { action: 'GRANT_COMPLIMENTARY'; planId: string; durationDays: number; evidence: string };

export interface MigrationApproval {
  schema: 'dsbc.migrationApproval/v1';
  previewHash: string;
  approvedByUid: string;
  decisions: Record<string, MigrationDecision>;
}

const freePlanFor = (t: CustomerType) => (t === 'company' ? 'company_free' : 'individual_free');

async function countWhere(collection: string, field: string, value: string): Promise<number> {
  const snap = await db().collection(collection).where(field, '==', value).count().get();
  return snap.data().count;
}

async function authFacts(uids: string[]) {
  if (!uids.length) return { authAccounts: 0, verifiedAccounts: 0, disabledAccounts: 0 };
  const res = await adminAuth().getUsers(uids.map((uid) => ({ uid })));
  return {
    authAccounts: res.users.length,
    verifiedAccounts: res.users.filter((u) => u.emailVerified && !u.disabled).length,
    disabledAccounts: res.users.filter((u) => u.disabled).length,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** READ-ONLY discovery of every existing customer. */
export async function discoverCustomers(): Promise<MigrationPreview> {
  const [companies, users, subs] = await Promise.all([
    db().collection('companies').get(),
    db().collection('users').get(),
    db().collection('subscriptions').get(),
  ]);
  const subById = new Map(subs.docs.map((d) => [d.id, d]));
  const companyIds = new Set(companies.docs.map((d) => d.id));
  const customers: DiscoveredCustomer[] = [];
  const excluded: MigrationPreview['excluded'] = [];

  for (const c of companies.docs) {
    const admins = users.docs.filter((u) => u.get('companyId') === c.id && u.get('role') === 'company_admin');
    const uids = admins.map((u) => u.id);
    const ids = await authFacts(uids);
    const [employees, departments, profiles] = await Promise.all([
      countWhere('employees', 'companyId', c.id),
      countWhere('departments', 'companyId', c.id),
      countWhere('digitalIdentityProfiles', 'companyId', c.id),
    ]);
    const record = await db().collection('publishingRecords').doc(c.id).get();
    const legacyPlanId = (c.get('planId') as string | undefined) ?? null;
    const existing = subById.get(`company_${c.id}`);
    const emails = admins.map((u) => String(u.get('email') || ''));
    const flags: MigrationFlag[] = [];
    if (DEMO_IDS.has(c.id) || admins.some((u) => DEMO_IDS.has(u.id)) || (emails.length > 0 && emails.every((e) => DEMO_EMAIL.test(e)))) flags.push('DEMO_CANDIDATE');
    if (ids.authAccounts < uids.length) flags.push('AUTH_ACCOUNT_MISSING');
    if (ids.verifiedAccounts === 0) flags.push('NO_VERIFIED_IDENTITY');
    if (c.get('status') !== 'active') flags.push('ACCOUNT_SUSPENDED');
    if (legacyPlanId && legacyPlanId !== 'company_free' && legacyPlanId !== 'free') flags.push('LEGACY_PAID_PLAN_CLAIM');
    if (existing) flags.push('HAS_SUBSCRIPTION');
    customers.push(describe('company', c.id, String(c.get('name') || c.id), { uids, ...ids }, flags, {
      employees, departments, profiles, publishingState: (record.get('publishingState') as string) || 'NO_PUBLISHING_RECORD',
    }, existing, legacyPlanId));
  }

  for (const u of users.docs) {
    const role = u.get('role');
    const companyId = u.get('companyId') as string | null | undefined;
    if (role === 'app_owner') {
      excluded.push({ ref: `users/${u.id}`, reason: 'platform App Owner (not a customer)' });
      continue;
    }
    if (companyId) {
      if (!companyIds.has(companyId)) excluded.push({ ref: `users/${u.id}`, reason: `ORPHAN_PROFILE: company ${companyId} does not exist (left untouched)` });
      continue; // company members are migrated with their company
    }
    const ids = await authFacts([u.id]);
    // Individual profiles are keyed by the individual's id (src/types/cardProfile.ts).
    const [byField, byId] = await Promise.all([
      countWhere('digitalIdentityProfiles', 'individualId', u.id),
      db().collection('digitalIdentityProfiles').doc(u.id).get(),
    ]);
    const profiles = Math.max(byField, byId.exists ? 1 : 0);
    const existing = subById.get(`individual_${u.id}`);
    const flags: MigrationFlag[] = [];
    if (DEMO_IDS.has(u.id) || DEMO_EMAIL.test(String(u.get('email') || ''))) flags.push('DEMO_CANDIDATE');
    if (ids.authAccounts === 0) flags.push('AUTH_ACCOUNT_MISSING');
    if (ids.verifiedAccounts === 0) flags.push('NO_VERIFIED_IDENTITY');
    if (u.get('status') && u.get('status') !== 'active') flags.push('ACCOUNT_SUSPENDED');
    const legacyPlanId = (u.get('planId') as string | undefined) ?? null;
    if (legacyPlanId && legacyPlanId !== 'individual_free' && legacyPlanId !== 'free') flags.push('LEGACY_PAID_PLAN_CLAIM');
    if (existing) flags.push('HAS_SUBSCRIPTION');
    customers.push(describe('individual', u.id, String(u.get('displayName') || u.get('email') || u.id), { uids: [u.id], ...ids }, flags, { profiles }, existing, legacyPlanId));
  }

  customers.sort((a, b) => a.key.localeCompare(b.key));
  excluded.sort((a, b) => a.ref.localeCompare(b.ref));
  const summary: Record<string, number> = { customers: customers.length, excluded: excluded.length };
  for (const c of customers) {
    summary[`proposal_${c.subscription.proposal}`] = (summary[`proposal_${c.subscription.proposal}`] ?? 0) + 1;
    for (const f of c.flags) summary[`flag_${f}`] = (summary[`flag_${f}`] ?? 0) + 1;
  }
  const previewHash = createHash('sha256').update(canonical({ customers, excluded })).digest('hex');
  return { schema: 'dsbc.migrationPreview/v1', customers, excluded, summary, previewHash };
}

function describe(
  customerType: CustomerType,
  customerId: string,
  name: string,
  identity: DiscoveredCustomer['identity'],
  flags: MigrationFlag[],
  content: DiscoveredCustomer['content'],
  existing: FirebaseFirestore.QueryDocumentSnapshot | undefined,
  legacyPlanId: string | null
): DiscoveredCustomer {
  let proposal: MigrationProposal = 'ASSIGN_FREE';
  let note = 'Map to the free plan; existing content stays as it is (paid features stay locked until the App Owner decides otherwise).';
  if (existing) {
    proposal = 'NONE_NEEDED';
    note = 'Already has a server subscription; the migration never overwrites it.';
  } else if (flags.includes('DEMO_CANDIDATE')) {
    proposal = 'OWNER_DECISION_REQUIRED';
    note = 'Looks like demo / test data. Only SKIP is accepted; nothing is deleted.';
  } else if (flags.includes('LEGACY_PAID_PLAN_CLAIM')) {
    proposal = 'OWNER_DECISION_REQUIRED';
    note = `Legacy browser-assigned plan "${legacyPlanId}" is not evidence of payment. The App Owner decides: free plan, or a complimentary grant with recorded evidence.`;
  } else if (flags.includes('NO_VERIFIED_IDENTITY')) {
    proposal = 'OWNER_DECISION_REQUIRED';
    note = 'No verified sign-in account owns this customer; confirm the owner before mapping.';
  }
  return {
    key: `${customerType}:${customerId}`,
    customerType,
    customerId,
    name,
    identity,
    flags,
    content,
    subscription: {
      existing: existing ? { planId: String(existing.get('planId')), status: String(existing.get('status')) } : null,
      legacyPlanId,
      proposal,
      proposedPlanId: proposal === 'NONE_NEEDED' ? null : freePlanFor(customerType),
      note,
    },
  };
}

export class MigrationRefused extends Error {}

/** Validates the approval against a fresh discovery. Throws MigrationRefused. */
export async function validateApproval(approval: MigrationApproval, preview: MigrationPreview): Promise<Caller> {
  if (approval.schema !== 'dsbc.migrationApproval/v1') throw new MigrationRefused('Unknown approval schema.');
  if (approval.previewHash !== preview.previewHash) {
    throw new MigrationRefused('The data changed since the preview was approved (preview hash mismatch). Run discover again and re-approve.');
  }
  const approver = await adminAuth().getUser(approval.approvedByUid).catch(() => null);
  if (!approver) throw new MigrationRefused('Approver does not exist.');
  if (approver.customClaims?.[APP_OWNER_CLAIM] !== 'app_owner' || !approver.emailVerified || approver.disabled) {
    throw new MigrationRefused('Approver is not a verified App Owner (platformRole claim + verified email).');
  }
  const byKey = new Map(preview.customers.map((c) => [c.key, c]));
  for (const [key, d] of Object.entries(approval.decisions)) {
    const c = byKey.get(key);
    if (!c) throw new MigrationRefused(`Decision for unknown customer ${key}.`);
    if (d.action === 'SKIP') continue;
    if (c.subscription.existing) throw new MigrationRefused(`${key} already has a subscription; only SKIP is allowed.`);
    if (c.flags.includes('DEMO_CANDIDATE')) throw new MigrationRefused(`${key} is a demo candidate; only SKIP is allowed.`);
    if (d.action === 'ASSIGN_FREE') continue;
    if (d.action === 'GRANT_COMPLIMENTARY') {
      if (!d.evidence || d.evidence.trim().length < 8) throw new MigrationRefused(`${key}: a complimentary grant needs recorded evidence (invoice, contract or payment reference).`);
      if (!Number.isInteger(d.durationDays) || d.durationDays < 1 || d.durationDays > 3650) throw new MigrationRefused(`${key}: durationDays must be 1..3650.`);
      const plan = await db().collection('plans').doc(d.planId).get();
      if (!plan.exists || plan.get('targetType') !== c.customerType) throw new MigrationRefused(`${key}: plan ${d.planId} does not exist for ${c.customerType} customers.`);
      continue;
    }
    throw new MigrationRefused(`${key}: unknown action.`);
  }
  const profile = await db().collection('users').doc(approver.uid).get();
  return {
    uid: approver.uid,
    email: approver.email ?? null,
    emailVerified: true,
    signInProvider: null,
    isAppOwner: true,
    profile: profile.exists ? ({ id: profile.id, ...profile.data() } as ProfileDoc) : null,
  };
}

export interface MigrationOutcome {
  runId: string;
  previewHash: string;
  results: Array<{ key: string; action: string; outcome: 'SKIPPED' | 'ASSIGNED_FREE' | 'GRANTED_COMPLIMENTARY'; subscriptionId?: string; legacyPlanId: string | null }>;
}

/** Executes an approved migration. Only creates subscriptions; never deletes or edits content. */
export async function executeMigration(approval: MigrationApproval, runId: string): Promise<MigrationOutcome> {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(runId)) throw new MigrationRefused('runId must be 6-64 characters [A-Za-z0-9_-].');
  const preview = await discoverCustomers();
  const caller = await validateApproval(approval, preview);
  // Run lock: a run id is used exactly once (create fails if it exists), before any write.
  const ref = db().collection('migrationRuns').doc(runId);
  try {
    await ref.create({ runId, status: 'RUNNING', previewHash: approval.previewHash, approvedByUid: approval.approvedByUid, startedAt: serverNow() });
  } catch {
    throw new MigrationRefused(`Migration run ${runId} already exists; every run needs a new id.`);
  }
  const results: MigrationOutcome['results'] = [];
  for (const c of preview.customers) {
    const d = approval.decisions[c.key] ?? { action: 'SKIP' as const };
    if (d.action === 'SKIP') {
      results.push({ key: c.key, action: 'SKIP', outcome: 'SKIPPED', legacyPlanId: c.subscription.legacyPlanId });
      continue;
    }
    // Re-check immediately before writing: never overwrite a subscription.
    const sub = await db().collection('subscriptions').doc(`${c.customerType}_${c.customerId}`).get();
    if (sub.exists) throw new MigrationRefused(`${c.key} gained a subscription during the run; stopping.`);
    const why = `Directive 27 customer migration ${runId}`;
    if (d.action === 'ASSIGN_FREE') {
      const r = await adminChangeCustomerPlan(caller, { customerType: c.customerType, customerId: c.customerId, planId: freePlanFor(c.customerType), reason: `${why}: free plan mapping` });
      results.push({ key: c.key, action: d.action, outcome: 'ASSIGNED_FREE', subscriptionId: r.subscriptionId, legacyPlanId: c.subscription.legacyPlanId });
    } else {
      const r = await adminGrantComplimentary(caller, {
        customerType: c.customerType, customerId: c.customerId, planId: d.planId, durationDays: d.durationDays,
        reason: `${why}: complimentary grant, evidence: ${d.evidence}`.slice(0, 500),
      });
      results.push({ key: c.key, action: d.action, outcome: 'GRANTED_COMPLIMENTARY', subscriptionId: r.subscriptionId, legacyPlanId: c.subscription.legacyPlanId });
    }
  }
  await db().runTransaction(async (tx) => {
    tx.update(ref, { status: 'COMPLETED', results, completedAt: serverNow() });
    appendAudit(tx, 'platformAuditLogs', {
      action: 'CUSTOMER_MIGRATION_EXECUTED', actor: { uid: caller.uid, name: caller.email || caller.uid, role: 'app_owner' },
      targetType: 'global', targetId: runId, targetName: 'Existing customer migration',
      previousValue: null, newValue: { customers: results.length, written: results.filter((r) => r.outcome !== 'SKIPPED').length }, reason: `Approved preview ${approval.previewHash.slice(0, 12)}`, source: 'scripts/admin/migrateCustomers.ts',
    });
  });
  return { runId, previewHash: approval.previewHash, results };
}
