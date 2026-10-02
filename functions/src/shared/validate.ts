// Minimal input validation for callable payloads. Anything unexpected is
// rejected with invalid-argument; unknown keys are rejected too, so a client
// cannot smuggle authority fields (role, companyId, status, price ...).
import { invalid } from './errors';

export type Payload = Record<string, unknown>;

export function obj(data: unknown, allowed: readonly string[]): Payload {
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid('Payload must be an object.');
  const p = data as Payload;
  const extra = Object.keys(p).filter((k) => !allowed.includes(k));
  if (extra.length) invalid(`Unexpected field(s): ${extra.join(', ')}`);
  return p;
}

export function str(p: Payload, key: string, opts: { max?: number; pattern?: RegExp; optional?: boolean } = {}): string {
  const v = p[key];
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    invalid(`${key} is required.`);
  }
  if (typeof v !== 'string') invalid(`${key} must be a string.`);
  const s = (v as string).trim();
  if (s.length > (opts.max ?? 500)) invalid(`${key} is too long.`);
  if (opts.pattern && !opts.pattern.test(s)) invalid(`${key} has an invalid format.`);
  return s;
}

export function num(p: Payload, key: string, opts: { min?: number; max?: number; int?: boolean; optional?: boolean } = {}): number {
  const v = p[key];
  if (v === undefined || v === null) {
    if (opts.optional) return NaN;
    invalid(`${key} is required.`);
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) invalid(`${key} must be a finite number.`);
  const n = v as number;
  if (opts.int && !Number.isInteger(n)) invalid(`${key} must be an integer.`);
  if (opts.min !== undefined && n < opts.min) invalid(`${key} must be >= ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) invalid(`${key} must be <= ${opts.max}.`);
  return n;
}

export function bool(p: Payload, key: string, optional = false): boolean | undefined {
  const v = p[key];
  if (v === undefined) {
    if (optional) return undefined;
    invalid(`${key} is required.`);
  }
  if (typeof v !== 'boolean') invalid(`${key} must be a boolean.`);
  return v as boolean;
}

export function oneOf<T extends string>(p: Payload, key: string, values: readonly T[], optional = false): T {
  const v = p[key];
  if (v === undefined && optional) return undefined as unknown as T;
  if (typeof v !== 'string' || !values.includes(v as T)) invalid(`${key} must be one of ${values.join(', ')}.`);
  return v as T;
}

export const ID_PATTERN = /^[A-Za-z0-9_\-.]{1,128}$/;
export const PLAN_ID_PATTERN = /^[a-z0-9_]{2,64}$/;

/** Reason text is mandatory on every privileged mutation (audit ledger). */
export function reason(p: Payload): string {
  return str(p, 'reason', { max: 500 });
}
