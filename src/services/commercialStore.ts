// ============================================================================
// DSBC COMMERCIAL STORE (Directive 25 Phase 11)
// ============================================================================
// Read-only browser cache of backend-authoritative commercial state.
//
//   Source                                   Who reads it
//   plans / featureCatalogue / globalPolicies everyone (public pricing)
//   getMyCommercialState (callable)           signed-in customer: their plan,
//                                             subscription and effective
//                                             entitlements, resolved server-side
//   subscriptions/{own id}                    signed-in customer (refresh trigger)
//   invoices where customer == self           billing contact
//   subscriptions, invoices, overrides,       App Owner only (firestore.rules)
//   usageCounters, audit ledgers
//
// Nothing here is ever written back: localStorage is not used, and every
// change goes through src/lib/backend.ts. Values cached here only decide what
// the UI DISPLAYS; the backend re-derives every decision on every request.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callBackend } from '../lib/backend';
import { FEATURE_CATALOGUE, FEATURE_DEPENDENCIES, INITIAL_GLOBAL_POLICY } from '../../shared/domain/catalogue';
import type { ControlPlane } from '../../shared/domain/entitlementResolver';
import type { EffectiveSubscriptionState } from '../../shared/domain/subscriptionLifecycle';
import type {
  EffectiveEntitlement,
  EntitlementOverride,
  FeatureDefinition,
  GlobalPlatformPolicy,
  Plan,
} from '../types/entitlement';
import type { CustomerType, Invoice, Subscription } from '../types/subscription';

/** Who is signed in, as established by AuthContext from the Firebase session. */
export interface CommercialSession {
  uid: string;
  /** Verified platformRole claim on a verified email (AuthContext). Display only. */
  isAppOwner: boolean;
  /** Ids that identify this person (uid, employeeId). */
  userIds: string[];
  companyId: string | null;
}

export interface CommercialSnapshot {
  schema: string;
  generatedAt: string;
  subject: {
    customerType: CustomerType;
    customerId: string;
    companyId: string | null;
    tenantId: string;
    isBillingContact: boolean;
    accountSuspended: boolean;
  };
  subscription: (Subscription & { effectiveStatus: string }) | null;
  subscriptionState: EffectiveSubscriptionState;
  plan: Plan | null;
  entitlements: Record<string, EffectiveEntitlement>;
}

export interface UsageCounter {
  id: string;
  targetType: 'company' | 'individual';
  targetId: string;
  tenantId: string;
  featureId: string;
  unit: string;
  periodKey: string;
  currentValue: number;
}

/** Raw audit ledger record (functions/src/audit/ledger.ts). */
export interface AuditLedgerRecord {
  id: string;
  collection: 'entitlementAuditLogs' | 'commercialAuditLogs' | 'platformAuditLogs';
  action: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  targetName: string;
  tenantId: string | null;
  featureId: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  source: string;
  timestamp: string;
  contentHash: string;
}

/** Firestore Timestamp | ISO string | null -> ISO string | null. */
export function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate().toISOString();
  return null;
}

function planFromDoc(id: string, d: DocumentData): Plan {
  return { ...(d as Plan), id, createdAt: toIso(d.createdAt) || '', updatedAt: toIso(d.updatedAt) || '' };
}

function overrideFromDoc(id: string, d: DocumentData): EntitlementOverride {
  return {
    ...(d as EntitlementOverride),
    id,
    validFrom: toIso(d.validFrom) || '',
    expiresAt: toIso(d.expiresAt),
    createdAt: toIso(d.createdAt) || '',
    updatedAt: toIso(d.updatedAt) || '',
  };
}

export function subscriptionFromDoc(d: DocumentData): Subscription {
  const iso = (k: string) => toIso(d[k]);
  return {
    ...(d as Subscription),
    startedAt: iso('startedAt') || '',
    currentPeriodStart: iso('currentPeriodStart') || '',
    currentPeriodEnd: iso('currentPeriodEnd') || '',
    trialEndsAt: iso('trialEndsAt'),
    graceEndsAt: iso('graceEndsAt'),
    cancelledAt: iso('cancelledAt'),
    createdAt: iso('createdAt') || '',
    updatedAt: iso('updatedAt') || '',
  };
}

function invoiceFromDoc(id: string, d: DocumentData): Invoice {
  return { ...(d as Invoice), invoiceId: d.invoiceId || id, issuedAt: toIso(d.issuedAt) || '', paidAt: toIso(d.paidAt) };
}

function auditFromDoc(collectionName: AuditLedgerRecord['collection'], id: string, d: DocumentData): AuditLedgerRecord {
  return {
    id,
    collection: collectionName,
    action: d.action || '',
    actorUserId: d.actorUserId || d.actor?.uid || '',
    actorName: d.actorName || d.actor?.name || '',
    actorRole: d.actorRole || d.actor?.role || '',
    targetType: d.targetType || '',
    targetId: d.targetId || '',
    targetName: d.targetName || d.targetId || '',
    tenantId: d.tenantId ?? null,
    featureId: d.featureId ?? null,
    previousValue: d.previousValue ?? null,
    newValue: d.newValue ?? null,
    reason: d.reason || '',
    source: d.source || '',
    timestamp: toIso(d.timestamp) || '',
    contentHash: d.contentHash || '',
  };
}

const SNAPSHOT_REFRESH_MS = 5 * 60 * 1000;

class CommercialStore {
  // ---- public control plane --------------------------------------------------
  plans: Plan[] = [];
  features: FeatureDefinition[] = [...FEATURE_CATALOGUE];
  dependencies: Record<string, string[]> = { ...FEATURE_DEPENDENCIES };
  globalPolicy: GlobalPlatformPolicy = { ...INITIAL_GLOBAL_POLICY };

  // ---- signed-in customer ------------------------------------------------------
  session: CommercialSession | null = null;
  snapshot: CommercialSnapshot | null = null;
  snapshotError: string | null = null;
  ownInvoices: Invoice[] = [];

  // ---- App Owner -----------------------------------------------------------------
  subscriptions: Subscription[] = [];
  invoices: Invoice[] = [];
  overrides: EntitlementOverride[] = [];
  usageCounters: UsageCounter[] = [];
  entitlementAudit: AuditLedgerRecord[] = [];
  commercialAudit: AuditLedgerRecord[] = [];
  platformAudit: AuditLedgerRecord[] = [];
  /** customerClassifications (pilot / lifecycle), keyed ${customerType}_${customerId}. */
  classifications: Array<Record<string, unknown> & { id: string }> = [];

  private listeners = new Set<() => void>();
  private publicUnsubs: Unsubscribe[] = [];
  private sessionUnsubs: Unsubscribe[] = [];
  private ownSubscriptionUnsub: Unsubscribe | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotSeq = 0;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    this.ensurePublicListeners();
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Commercial store listener failed:', err);
      }
    });
  }

  private onError = (what: string) => (err: Error) => console.warn(`[commercialStore] ${what}: ${err.message}`);

  private ensurePublicListeners(): void {
    if (this.publicUnsubs.length || typeof window === 'undefined') return;
    this.publicUnsubs.push(
      onSnapshot(collection(db, 'plans'), (s) => {
        this.plans = s.docs.map((d) => planFromDoc(d.id, d.data())).sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
        this.notify();
      }, this.onError('plans')),
      onSnapshot(collection(db, 'featureCatalogue'), (s) => {
        if (s.empty) return; // not bootstrapped yet: keep the catalogue baseline for display
        const deps: Record<string, string[]> = {};
        this.features = s.docs.map((d) => {
          const { dependsOn, createdAt, updatedAt, ...def } = d.data();
          if (Array.isArray(dependsOn) && dependsOn.length) deps[d.id] = dependsOn;
          return { ...(def as FeatureDefinition), id: d.id };
        });
        this.dependencies = deps;
        this.notify();
      }, this.onError('featureCatalogue')),
      onSnapshot(doc(db, 'globalPolicies', 'platform'), (s) => {
        this.globalPolicy = s.exists()
          ? ({ ...INITIAL_GLOBAL_POLICY, ...s.data(), updatedAt: toIso(s.get('updatedAt')) || undefined } as GlobalPlatformPolicy)
          : { ...INITIAL_GLOBAL_POLICY };
        this.notify();
      }, this.onError('globalPolicies'))
    );
  }

  /** Called by EntitlementProvider whenever the Firebase session changes. */
  setSession(session: CommercialSession | null): void {
    this.ensurePublicListeners();
    const same =
      JSON.stringify(session) === JSON.stringify(this.session);
    if (same) return;
    this.teardownSession();
    this.session = session;
    this.snapshot = null;
    this.snapshotError = null;
    if (!session) {
      this.notify();
      return;
    }
    if (session.isAppOwner) this.startAppOwnerListeners();
    void this.refreshSnapshot();
    this.refreshTimer = setInterval(() => void this.refreshSnapshot(), SNAPSHOT_REFRESH_MS);
    this.notify();
  }

  private teardownSession(): void {
    this.sessionUnsubs.forEach((u) => u());
    this.sessionUnsubs = [];
    this.ownSubscriptionUnsub?.();
    this.ownSubscriptionUnsub = null;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.subscriptions = [];
    this.invoices = [];
    this.ownInvoices = [];
    this.overrides = [];
    this.usageCounters = [];
    this.entitlementAudit = [];
    this.commercialAudit = [];
    this.platformAudit = [];
    this.classifications = [];
  }

  private startAppOwnerListeners(): void {
    const auditQuery = (name: AuditLedgerRecord['collection']) => query(collection(db, name), orderBy('timestamp', 'desc'), limit(300));
    this.sessionUnsubs.push(
      onSnapshot(collection(db, 'subscriptions'), (s) => {
        this.subscriptions = s.docs.map((d) => subscriptionFromDoc(d.data()));
        this.notify();
      }, this.onError('subscriptions')),
      onSnapshot(collection(db, 'invoices'), (s) => {
        this.invoices = s.docs.map((d) => invoiceFromDoc(d.id, d.data())).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        this.notify();
      }, this.onError('invoices')),
      onSnapshot(collection(db, 'entitlementOverrides'), (s) => {
        this.overrides = s.docs.map((d) => overrideFromDoc(d.id, d.data()));
        this.notify();
      }, this.onError('entitlementOverrides')),
      onSnapshot(query(collection(db, 'usageCounters'), limit(1000)), (s) => {
        this.usageCounters = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UsageCounter, 'id'>) }));
        this.notify();
      }, this.onError('usageCounters')),
      onSnapshot(auditQuery('entitlementAuditLogs'), (s) => {
        this.entitlementAudit = s.docs.map((d) => auditFromDoc('entitlementAuditLogs', d.id, d.data()));
        this.notify();
      }, this.onError('entitlementAuditLogs')),
      onSnapshot(auditQuery('commercialAuditLogs'), (s) => {
        this.commercialAudit = s.docs.map((d) => auditFromDoc('commercialAuditLogs', d.id, d.data()));
        this.notify();
      }, this.onError('commercialAuditLogs')),
      onSnapshot(auditQuery('platformAuditLogs'), (s) => {
        this.platformAudit = s.docs.map((d) => auditFromDoc('platformAuditLogs', d.id, d.data()));
        this.notify();
      }, this.onError('platformAuditLogs')),
      onSnapshot(collection(db, 'customerClassifications'), (s) => {
        this.classifications = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.notify();
      }, this.onError('customerClassifications'))
    );
  }

  /** Watch the customer's own subscription and invoices; any change re-fetches the server snapshot. */
  private watchOwnRecords(snapshot: CommercialSnapshot): void {
    if (this.ownSubscriptionUnsub) return;
    const { customerType, customerId, isBillingContact } = snapshot.subject;
    const unsubs: Unsubscribe[] = [];
    let first = true;
    unsubs.push(
      onSnapshot(doc(db, 'subscriptions', `${customerType}_${customerId}`), () => {
        if (first) {
          first = false;
          return;
        }
        void this.refreshSnapshot();
      }, this.onError('own subscription'))
    );
    if (isBillingContact) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'invoices'), where('customerType', '==', customerType), where('customerId', '==', customerId)),
          (s) => {
            this.ownInvoices = s.docs.map((d) => invoiceFromDoc(d.id, d.data())).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
            this.notify();
          },
          this.onError('own invoices')
        )
      );
    }
    this.ownSubscriptionUnsub = () => unsubs.forEach((u) => u());
  }

  /** Re-fetch the server-resolved commercial snapshot for the signed-in user. */
  async refreshSnapshot(): Promise<void> {
    if (!this.session) return;
    const seq = ++this.snapshotSeq;
    const session = this.session;
    try {
      const snapshot = await callBackend<CommercialSnapshot>('getMyCommercialState');
      if (seq !== this.snapshotSeq || session !== this.session) return;
      this.snapshot = snapshot;
      this.snapshotError = null;
      this.watchOwnRecords(snapshot);
    } catch (err) {
      if (seq !== this.snapshotSeq || session !== this.session) return;
      // Fail closed: without a server snapshot every gated feature shows as locked.
      this.snapshot = null;
      this.snapshotError = err instanceof Error ? err.message : String(err);
    }
    this.notify();
  }

  /** Control plane as currently mirrored from Firestore (display resolution). */
  controlPlane(): ControlPlane {
    return {
      features: new Map(this.features.map((f) => [f.id, f])),
      dependencies: this.dependencies,
      globalPolicy: this.globalPolicy,
      plans: new Map(this.plans.map((p) => [p.id, p])),
    };
  }
}

export const commercialStore = new CommercialStore();

// ----------------------------------------------------------------------------
// Legacy browser authority (Directive 19-21 localStorage keys). They are never
// read; this removes stale copies so nobody mistakes them for live state.
// ----------------------------------------------------------------------------
export const LEGACY_AUTHORITY_KEYS = [
  'dsbc_entitlement_plans_v1',
  'dsbc_entitlement_overrides_v1',
  'dsbc_entitlement_policy_v1',
  'dsbc_entitlement_audit_v1',
  'dsbc_entitlement_usage_v1',
  'dsbc_subscriptions_v1',
  'dsbc_invoices_v1',
  'dsbc_commercial_audit_v1',
  'dsbc_publishing_records_v1',
  'dsbc_registered_slugs_v1',
  'dsbc_quarantined_slugs_v1',
  'dsbc_pilot_registry_v1',
  'dsbc_pilot_operational_metrics_v1',
] as const;

export function purgeLegacyAuthorityKeys(storage: Pick<Storage, 'removeItem'> | null = typeof window === 'undefined' ? null : window.localStorage): void {
  if (!storage) return;
  for (const key of LEGACY_AUTHORITY_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* storage unavailable: nothing to purge */
    }
  }
}
