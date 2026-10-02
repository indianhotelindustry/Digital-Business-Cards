// ============================================================================
// Audit ledger (Directive 25 Phase 6)
// ============================================================================
// Append-only. The ONLY write primitive is create(): it fails if the document
// already exists, so the backend itself has no code path that updates or
// deletes an audit record, and firestore.rules deny every client write.
// Each record carries a SHA-256 hash of its canonical content so later
// tampering (e.g. by someone with console access) is detectable.
// Records are written inside the same transaction as the mutation they
// describe, so a mutation without its audit record cannot be committed.

import { createHash } from 'node:crypto';
import type { Transaction, WriteBatch } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { serverNow } from '../shared/time';

export type AuditCollection = 'entitlementAuditLogs' | 'commercialAuditLogs' | 'platformAuditLogs';

export interface AuditActor {
  uid: string;
  name: string;
  role: string; // derived server-side: 'app_owner' | 'company_admin' | 'employee' | 'individual' | 'system' | 'payment_provider'
}

export interface AuditEntry {
  action: string;
  actor: AuditActor;
  targetType: string;
  targetId: string;
  targetName?: string;
  tenantId?: string | null;
  featureId?: string | null;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  source: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function auditHash(entry: AuditEntry): string {
  return createHash('sha256').update(canonical(entry)).digest('hex');
}

function record(entry: AuditEntry) {
  const normalised: AuditEntry = {
    ...entry,
    tenantId: entry.tenantId ?? null,
    featureId: entry.featureId ?? null,
    previousValue: JSON.parse(JSON.stringify(entry.previousValue ?? null)),
    newValue: JSON.parse(JSON.stringify(entry.newValue ?? null)),
  };
  return {
    schema: 'dsbc.audit/v1',
    ...normalised,
    // Legacy display fields (Directive 18/19 UI)
    actorUserId: entry.actor.uid,
    actorName: entry.actor.name,
    actorRole: entry.actor.role,
    contentHash: auditHash(normalised),
    timestamp: serverNow(),
  };
}

/** Append inside a transaction. Returns the new record id. */
export function appendAudit(tx: Transaction | WriteBatch, collection: AuditCollection, entry: AuditEntry): string {
  const ref = db().collection(collection).doc();
  (tx as Transaction).create(ref, record(entry));
  return ref.id;
}
