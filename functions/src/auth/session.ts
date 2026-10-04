// ============================================================================
// Google sign-in sessions and registration (Directive 34 Phase 1)
// ============================================================================
// resolveSession     where a signed-in identity goes, from server records only.
// registerIndividual "Create Free Card": a FREE individual account.
// registerCompany    "Register as Company": a distinct company-onboarding
//                    workflow; Phase 1 offers the Free company plan only.
// Free accounts are ACTIVE immediately (no approval). Payloads carry names
// (and the company plan choice) only; role, ids, ownership and status are
// derived here. Both are idempotent by UID: a second call creates nothing.
import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../shared/firebase';
import { deny, fail, invalid } from '../shared/errors';
import { obj, oneOf, str } from '../shared/validate';
import { serverNow } from '../shared/time';
import { appendAudit } from '../audit/ledger';
import { actorOf, type Caller } from './identity';
import { resolveDestination, SESSION_INTENTS, type SessionFacts, type SessionIntent } from '../../../shared/domain/sessionRouting';
import { buildRegistrationDocuments, MAX_NAME_LENGTH, type RegistrationDocuments } from '../../../shared/domain/registrationModel';

async function factsFor(caller: Caller): Promise<{ facts: SessionFacts; companyName: string | null }> {
  const p = caller.profile;
  let companyStatus: string | null = null;
  let companyName: string | null = null;
  if (p?.companyId) {
    const company = await db().collection('companies').doc(p.companyId).get();
    companyStatus = company.exists ? (company.get('status') as string) : null;
    companyName = company.exists ? ((company.get('name') as string) || null) : null;
  }
  return {
    companyName,
    facts: {
      isAppOwner: caller.isAppOwner,
      profile: p ? { role: p.role ?? null, accountType: p.accountType ?? null, status: p.status ?? null, companyId: p.companyId ?? null } : null,
      companyStatus,
    },
  };
}

export async function resolveSession(caller: Caller, data: unknown) {
  const intent = oneOf(obj(data, ['intent']), 'intent', SESSION_INTENTS);
  const { facts, companyName } = await factsFor(caller);
  return { destination: resolveDestination(intent, facts), displayName: caller.profile?.displayName ?? null, companyName };
}

function requireGoogleIdentity(caller: Caller): string {
  if (caller.signInProvider !== 'google.com') deny('Register with Google.');
  if (!caller.email || !caller.emailVerified) deny('A verified Google email is required.');
  return caller.email!;
}

function requiredName(p: Record<string, unknown>, key: string): string {
  const v = str(p, key, { max: MAX_NAME_LENGTH }).trim();
  if (!v) invalid(`${key} is required.`);
  return v;
}

/** True when this UID already has a DSBC user or owns a company (read inside the transaction). */
async function alreadyRegistered(tx: Transaction, uid: string): Promise<boolean> {
  const [user, owned] = await Promise.all([
    tx.get(db().collection('users').doc(uid)),
    tx.get(db().collection('companies').where('ownerUid', '==', uid).limit(1)),
  ]);
  return user.exists || !owned.empty;
}

async function outcome(caller: Caller, created: boolean, intent: SessionIntent, home: SessionIntent) {
  const fresh = await db().collection('users').doc(caller.uid).get();
  const { facts } = await factsFor({ ...caller, profile: fresh.exists ? ({ id: fresh.id, ...fresh.data() } as Caller['profile']) : null });
  return { created, destination: resolveDestination(created ? home : intent, facts) };
}

function writeTenantAndUser(tx: Transaction, docs: RegistrationDocuments): void {
  tx.create(db().collection('tenants').doc(docs.tenant.id), { ...docs.tenant, commercial: { state: 'free', method: 'free' } });
  tx.create(db().collection('users').doc(docs.user.id), docs.user);
}

export async function registerIndividual(caller: Caller, data: unknown) {
  const p = obj(data, ['displayName']);
  const displayName = requiredName(p, 'displayName');
  const email = requireGoogleIdentity(caller);
  const docs = buildRegistrationDocuments({ uid: caller.uid, email, displayName, accountType: 'individual', status: 'active' });
  const created = await db().runTransaction(async (tx) => {
    if (await alreadyRegistered(tx, caller.uid)) return false;
    writeTenantAndUser(tx, docs);
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'ACCOUNT_ACTIVATED', actor: actorOf(caller), targetType: 'individual', targetId: caller.uid, tenantId: docs.tenant.id,
      previousValue: null, newValue: { status: 'active', commercialState: 'free' },
      reason: 'Free individual: immediate activation', source: 'Individual registration',
    });
    return true;
  });
  return outcome(caller, created, 'create_free_card', 'individual_login');
}

export async function registerCompany(caller: Caller, data: unknown) {
  const p = obj(data, ['displayName', 'companyName', 'planId']);
  const displayName = requiredName(p, 'displayName');
  const companyName = requiredName(p, 'companyName');
  const planId = str(p, 'planId', { max: 64 });
  if (planId !== 'company_free') fail('failed-precondition', 'Paid plans are not available yet.');
  const email = requireGoogleIdentity(caller);
  const docs = buildRegistrationDocuments({ uid: caller.uid, email, displayName, accountType: 'company', companyName, status: 'active' });
  const created = await db().runTransaction(async (tx) => {
    if (await alreadyRegistered(tx, caller.uid)) return false;
    tx.create(db().collection('companies').doc(docs.company!.id), { ...docs.company!, createdAt: serverNow(), updatedAt: serverNow() });
    writeTenantAndUser(tx, docs);
    appendAudit(tx, 'commercialAuditLogs', {
      action: 'ACCOUNT_ACTIVATED', actor: actorOf(caller), targetType: 'company', targetId: docs.company!.id, tenantId: docs.tenant.id,
      previousValue: null, newValue: { status: 'active', commercialState: 'free', planId },
      reason: 'Free company plan: immediate activation', source: 'Company registration',
    });
    return true;
  });
  return outcome(caller, created, 'register_company', 'company_login');
}
