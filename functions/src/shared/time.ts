// Server-authoritative time. Every business date is computed from the
// server clock; every record timestamp is FieldValue.serverTimestamp().
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const serverNow = () => FieldValue.serverTimestamp();
export const nowMs = () => Date.now();
export const nowIso = () => new Date(nowMs()).toISOString();
export const DAY_MS = 86_400_000;
export const isoInDays = (days: number, fromMs = nowMs()) => new Date(fromMs + days * DAY_MS).toISOString();
export const ts = (iso: string) => Timestamp.fromMillis(Date.parse(iso));

/** Firestore Timestamp | ISO string | null -> ISO string | null (domain representation). */
export function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as Timestamp).toDate().toISOString();
  return null;
}
