// ============================================================================
// Backend-authority test harness (Directive 25 Phase 13)
// ============================================================================
// Runs ONLY inside the Firebase Emulator Suite (npm run test:backend):
//   * project id must be demo-* (the emulator guarantees a demo project can
//     never reach production services);
//   * FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST must be set.
// Identities are real Auth-emulator users with real ID tokens; callables are
// invoked over HTTP exactly as the browser SDK does; "browser" attacks use the
// real Firebase JS SDK against the emulated firestore.rules.

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { getApps as getAdminApps, initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Timestamp, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, terminate, type Firestore } from 'firebase/firestore';

export const PROJECT = process.env.GCLOUD_PROJECT || 'demo-dsbc';
export const REGION = 'us-central1';
const FUNCTIONS = 'http://127.0.0.1:5481';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
export const PASSWORD = 'emulator-only-password-1';

function assertEmulator(): void {
  if (!PROJECT.startsWith('demo-')) throw new Error(`Refusing to run: project ${PROJECT} is not a demo-* emulator project.`);
  if (!AUTH_HOST || !FIRESTORE_HOST) {
    throw new Error('Refusing to run: FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST are not set. Use npm run test:backend.');
  }
}
assertEmulator();

// ---------------------------------------------------------------------------
// Admin SDK (test setup only — plays the role of pre-existing server data)
// ---------------------------------------------------------------------------
const adminApp = getAdminApps()[0] ?? initAdminApp({ projectId: PROJECT });
export const adminDb: AdminFirestore = getAdminFirestore(adminApp);
export const adminAuth = getAdminAuth(adminApp);
export { Timestamp };

export async function resetEmulators(): Promise<void> {
  await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------
export interface TestUser {
  uid: string;
  email: string;
  token: string;
}

export async function createUser(uid: string, opts: { claims?: Record<string, unknown>; verified?: boolean } = {}): Promise<TestUser> {
  const email = `${uid}@dsbc.test`;
  await adminAuth.createUser({ uid, email, password: PASSWORD, emailVerified: opts.verified ?? true });
  if (opts.claims) await adminAuth.setCustomUserClaims(uid, opts.claims);
  return { uid, email, token: await idToken(email) };
}

export async function idToken(email: string): Promise<string> {
  const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = (await res.json()) as { idToken?: string; error?: unknown };
  if (!body.idToken) throw new Error(`Auth emulator sign-in failed for ${email}: ${JSON.stringify(body.error)}`);
  return body.idToken;
}

// ---------------------------------------------------------------------------
// Callables (same wire protocol as the browser SDK)
// ---------------------------------------------------------------------------
export interface CallResult<T = any> {
  ok: boolean;
  data?: T;
  /** Callable error status, e.g. PERMISSION_DENIED, INVALID_ARGUMENT. */
  status?: string;
  message?: string;
}

export async function call<T = any>(name: string, data: unknown, user?: TestUser | null): Promise<CallResult<T>> {
  const res = await fetch(`${FUNCTIONS}/${PROJECT}/${REGION}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${name}: non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (body.error) return { ok: false, status: body.error.status, message: body.error.message };
  return { ok: true, data: body.result as T };
}

/** Call that must succeed; throws with the backend's message otherwise. */
export async function ok<T = any>(name: string, data: unknown, user?: TestUser | null): Promise<T> {
  const r = await call<T>(name, data, user);
  if (!r.ok) throw new Error(`${name} failed: ${r.status} ${r.message}`);
  return r.data as T;
}

// ---------------------------------------------------------------------------
// Webhook endpoint (raw HTTP, HMAC with the emulator-only secret)
// ---------------------------------------------------------------------------
export function emulatorSecret(name: 'RAZORPAY_WEBHOOK_SECRET' | 'RAZORPAY_KEY_SECRET'): string {
  const raw = readFileSync(new URL('../../../functions/.secret.local', import.meta.url), 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing from functions/.secret.local`);
  return line.slice(name.length + 1).trim();
}

export const hmacHex = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');

export async function postWebhook(rawBody: string, headers: Record<string, string>): Promise<{ status: number; body: any }> {
  const res = await fetch(`${FUNCTIONS}/${PROJECT}/${REGION}/razorpayWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: rawBody,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Browser SDK sessions (firestore.rules are enforced for these)
// ---------------------------------------------------------------------------
export interface BrowserSession {
  app: FirebaseApp;
  db: Firestore;
  close(): Promise<void>;
}

let browserCount = 0;
export async function browserSession(user: TestUser | null): Promise<BrowserSession> {
  const app = initializeApp({ apiKey: 'emulator-key', projectId: PROJECT }, `browser-${++browserCount}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const [host, port] = FIRESTORE_HOST.split(':');
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, Number(port));
  if (user) await signInWithEmailAndPassword(auth, user.email, PASSWORD);
  return {
    app,
    db,
    async close() {
      await terminate(db);
      await deleteApp(app);
    },
  };
}

/** Resolves to the Firestore error code of a denied browser operation, or 'ALLOWED'. */
export async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ALLOWED';
  } catch (err) {
    return (err as { code?: string }).code || String(err);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until predicate() is truthy (for Firestore-trigger side effects). */
export async function eventually<T>(fn: () => Promise<T>, predicate: (v: T) => boolean, timeoutMs = 20000): Promise<T> {
  const start = Date.now();
  let last: T = await fn();
  while (!predicate(last)) {
    if (Date.now() - start > timeoutMs) return last;
    await sleep(400);
    last = await fn();
  }
  return last;
}

// ---------------------------------------------------------------------------
// World: App Owner, two companies, an individual, impostors
// ---------------------------------------------------------------------------
export interface World {
  owner: TestUser;
  adminA: TestUser;
  employeeA: TestUser;
  adminB: TestUser;
  individual: TestUser;
  docRoleImpostor: TestUser;
  unverifiedOwner: TestUser;
}

const NOW = () => new Date().toISOString();

function profile(uid: string, extra: Record<string, unknown>) {
  return { id: uid, uid, email: `${uid}@dsbc.test`, displayName: uid, status: 'active', createdAt: NOW(), updatedAt: NOW(), ...extra };
}

export async function seedWorld(): Promise<World> {
  await resetEmulators();
  const [owner, adminA, employeeA, adminB, individual, docRoleImpostor, unverifiedOwner] = await Promise.all([
    createUser('u_owner', { claims: { platformRole: 'app_owner' } }),
    createUser('u_admin_a'),
    createUser('u_emp_a'),
    createUser('u_admin_b'),
    createUser('u_ind'),
    createUser('u_imp_docrole'),
    createUser('u_owner_unverified', { claims: { platformRole: 'app_owner' }, verified: false }),
  ]);

  const batch = adminDb.batch();
  const set = (path: string, data: Record<string, unknown>) => batch.set(adminDb.doc(path), data);
  set('users/u_owner', profile('u_owner', { role: 'app_owner', companyId: null }));
  set('users/u_admin_a', profile('u_admin_a', { role: 'company_admin', companyId: 'co_a', accountType: 'company', tenantId: 'co_a' }));
  set('users/u_emp_a', profile('u_emp_a', { role: 'employee', companyId: 'co_a', employeeId: 'emp_a1', accountType: 'company', tenantId: 'co_a' }));
  set('users/u_admin_b', profile('u_admin_b', { role: 'company_admin', companyId: 'co_b', accountType: 'company', tenantId: 'co_b' }));
  set('users/u_ind', profile('u_ind', { role: 'employee', companyId: null, accountType: 'individual', tenantId: 'ind_u_ind' }));
  // Legacy-style forgery: profile says app_owner, token has no claim.
  set('users/u_imp_docrole', profile('u_imp_docrole', { role: 'app_owner', companyId: null }));
  set('users/u_owner_unverified', profile('u_owner_unverified', { role: 'app_owner', companyId: null }));
  for (const [id, owner] of [['co_a', 'u_admin_a'], ['co_b', 'u_admin_b']] as const) {
    set(`companies/${id}`, { id, name: `Company ${id}`, status: 'active', planId: 'company_free', kind: 'company', ownerUid: owner, createdAt: NOW(), updatedAt: NOW() });
  }
  set('employees/emp_a1', { id: 'emp_a1', companyId: 'co_a', displayName: 'Employee A1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' });
  set('employees/emp_b1', { id: 'emp_b1', companyId: 'co_b', displayName: 'Employee B1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' });
  set('cards/card_a1', { id: 'card_a1', companyId: 'co_a', employeeId: 'emp_a1', templateId: 'classic', publicSlug: 'employee-a1', status: 'active', createdAt: NOW() });
  set('cards/card_b1', { id: 'card_b1', companyId: 'co_b', employeeId: 'emp_b1', templateId: 'classic', publicSlug: 'employee-b1', status: 'active', createdAt: NOW() });
  await batch.commit();

  await ok('bootstrapControlPlane', { reason: 'Emulator test bootstrap' }, owner);
  return { owner, adminA, employeeA, adminB, individual, docRoleImpostor, unverifiedOwner };
}
