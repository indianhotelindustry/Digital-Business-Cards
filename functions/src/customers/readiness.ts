// ============================================================================
// App Owner demo readiness (Directive 26 Phases 8 & 9)
// ============================================================================
// Read-only. For every company it answers "would this customer's demo work for
// an anonymous visitor right now?" by running the SAME public resolver the
// public routes use, plus the account / branding / content / employee checks
// behind it. It never changes anything: recovery happens through the existing
// audited controls (suspension, publishing suspension, plans), which the
// remediation hints point to.

import { db } from '../shared/firebase';
import { obj, bool } from '../shared/validate';
import { requireAppOwner, type Caller } from '../auth/identity';
import { resolveCardRoute, resolveCompanyRoute, type Viewer } from '../public/resolver';

const ANONYMOUS: Viewer = { uid: null, isAppOwner: false, companyId: null };

export type CheckKey = 'account' | 'company' | 'branding' | 'website' | 'employee' | 'employeeCard' | 'published' | 'publicUrl' | 'qr';

export interface ReadinessCheck {
  key: CheckKey;
  ok: boolean;
  detail: string;
  /** What to do when not ok (existing controls only). */
  fix?: string;
}

export interface EmployeeReadiness {
  employeeId: string;
  name: string;
  status: string;
  seatLocked: boolean;
  cardId: string | null;
  publishingState: string;
  cardSlug: string | null;
  publicOutcome: string;
}

export interface CustomerReadiness {
  companyId: string;
  companyName: string;
  isPilot: boolean;
  pilotStage: string | null;
  companyStatus: string;
  publishingState: string;
  websiteSlug: string | null;
  websitePath: string | null;
  websiteOutcome: string;
  employees: EmployeeReadiness[];
  checks: ReadinessCheck[];
  demoReady: boolean;
  errors: string[];
}

const isFilled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export async function companyReadiness(companyId: string): Promise<CustomerReadiness> {
  const [company, record, classification, admins, employees, cards] = await Promise.all([
    db().collection('companies').doc(companyId).get(),
    db().collection('publishingRecords').doc(companyId).get(),
    db().collection('customerClassifications').doc(`company_${companyId}`).get(),
    db().collection('users').where('companyId', '==', companyId).where('role', '==', 'company_admin').get(),
    db().collection('employees').where('companyId', '==', companyId).get(),
    db().collection('cards').where('companyId', '==', companyId).get(),
  ]);
  const c = company.data() ?? {};
  const websiteSlug = (record.get('slug') as string) || null;
  const publishingState = (record.get('publishingState') as string) || 'NOT_PUBLISHED';
  const website = websiteSlug ? await resolveCompanyRoute(websiteSlug, ANONYMOUS, false) : null;

  const employeeRows: EmployeeReadiness[] = [];
  for (const e of employees.docs) {
    const card = cards.docs.find((d) => d.get('employeeId') === e.id) ?? null;
    const cardRecord = card ? await db().collection('publishingRecords').doc(card.id).get() : null;
    const cardSlug = (cardRecord?.get('slug') as string) || null;
    const outcome = cardSlug ? (await resolveCardRoute('card', cardSlug, ANONYMOUS, false)).outcome : 'NOT_PUBLISHED';
    employeeRows.push({
      employeeId: e.id,
      name: (e.get('displayName') as string) || e.id,
      status: (e.get('status') as string) || 'unknown',
      seatLocked: e.get('seatState') === 'locked',
      cardId: card?.id ?? null,
      publishingState: (cardRecord?.get('publishingState') as string) || 'NOT_PUBLISHED',
      cardSlug,
      publicOutcome: outcome,
    });
  }

  const activeAdmin = admins.docs.some((u) => u.get('status') === 'active');
  const activeEmployees = employeeRows.filter((e) => e.status === 'active' && !e.seatLocked);
  const liveCards = employeeRows.filter((e) => e.publicOutcome === 'OK');
  const hasContent = isFilled(c.description) && ((c.services?.length ?? 0) > 0 || (c.products?.length ?? 0) > 0);

  const checks: ReadinessCheck[] = [
    { key: 'account', ok: activeAdmin, detail: activeAdmin ? `${admins.size} company admin account(s)` : 'No active company admin account', fix: 'The customer registers a company account (or an existing admin account is reactivated).' },
    {
      key: 'company',
      ok: company.exists && c.status === 'active' && c.platformSuspended !== true,
      detail: !company.exists ? 'Company record missing' : c.status !== 'active' ? `Company is ${c.status}` : c.platformSuspended ? 'Suspended by the platform' : 'Active',
      fix: 'Reinstate the customer (Customer controls → suspension) if the suspension is no longer warranted.',
    },
    { key: 'branding', ok: isFilled(c.name) && isFilled(c.logoUrl), detail: isFilled(c.logoUrl) ? 'Name and logo set' : 'No logo uploaded', fix: 'Customer uploads a logo in Company Profile → Identity & Brand.' },
    { key: 'website', ok: hasContent, detail: hasContent ? `About text, ${c.services?.length ?? 0} service(s), ${c.products?.length ?? 0} product(s)` : 'About text and at least one service or product are needed', fix: 'Customer completes Company Profile → Overview / Services / Products and saves.' },
    { key: 'employee', ok: activeEmployees.length > 0, detail: `${activeEmployees.length} active employee(s) with a seat`, fix: 'Customer adds an employee in Employees & Cards (seat limit permitting).' },
    { key: 'employeeCard', ok: liveCards.length > 0, detail: `${liveCards.length} employee card(s) publicly live`, fix: 'Customer publishes an employee card (Employees & Cards → Publish).' },
    { key: 'published', ok: publishingState === 'PUBLISHED', detail: `Website state: ${publishingState}`, fix: 'Customer publishes the website (Company Profile → Company Website → Publish).' },
    { key: 'publicUrl', ok: website?.outcome === 'OK', detail: website ? `Anonymous resolution: ${website.outcome}` : 'No public address yet', fix: 'Resolve the failing check above; a suspended website can only be lifted through publishing suspension controls.' },
    { key: 'qr', ok: website?.outcome === 'OK' && liveCards.length > 0, detail: website?.outcome === 'OK' ? 'QR codes encode live website and card URLs' : 'QR would point to an unavailable URL' },
  ];
  const errors = checks.filter((k) => !k.ok).map((k) => `${k.key}: ${k.detail}`);
  return {
    companyId,
    companyName: (c.name as string) || companyId,
    isPilot: classification.get('isPilot') === true,
    pilotStage: (classification.get('stage') as string) || null,
    companyStatus: (c.status as string) || 'missing',
    publishingState,
    websiteSlug,
    websitePath: websiteSlug ? `/company/${websiteSlug}` : null,
    websiteOutcome: website?.outcome ?? 'NOT_PUBLISHED',
    employees: employeeRows,
    checks,
    demoReady: checks.every((k) => k.ok),
    errors,
  };
}

export async function adminGetDemoReadiness(caller: Caller, data: unknown) {
  requireAppOwner(caller);
  const p = obj(data ?? {}, ['pilotsOnly']);
  const pilotsOnly = bool(p, 'pilotsOnly', true) === true;
  let companyIds: string[];
  if (pilotsOnly) {
    const pilots = await db().collection('customerClassifications').where('customerType', '==', 'company').where('isPilot', '==', true).get();
    companyIds = pilots.docs.map((d) => d.get('customerId') as string);
  } else {
    companyIds = (await db().collection('companies').select().get()).docs.map((d) => d.id);
  }
  const customers = [];
  for (const id of companyIds.sort()) customers.push(await companyReadiness(id));
  return {
    schema: 'dsbc.demoReadiness/v1',
    generatedAt: new Date().toISOString(),
    pilotsOnly,
    customers,
    summary: { total: customers.length, demoReady: customers.filter((c) => c.demoReady).length },
  };
}
