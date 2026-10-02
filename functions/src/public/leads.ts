// ============================================================================
// Public enquiry capture (Directive 26 Phase 5)
// ============================================================================
// Visitors of a PUBLISHED company website can send an enquiry without signing
// in. The lead is written by the backend into the company's own CRM (leads /
// leadEvents). The visitor cannot choose the tenant: it is derived from a slug
// that must resolve publicly, exactly as resolvePublicEntity does. Abuse is
// bounded by strict field validation, a honeypot and a per-company hourly cap.

import { randomBytes } from 'node:crypto';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../shared/firebase';
import { fail, invalid } from '../shared/errors';
import { nowIso, serverNow } from '../shared/time';
import { obj, str } from '../shared/validate';
import { resolveCompanyRoute } from './resolver';

export const PUBLIC_LEADS_PER_COMPANY_PER_HOUR = 30;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export async function submitPublicLeadHandler(data: unknown) {
  const p = obj(data, ['companySlug', 'name', 'email', 'phone', 'organization', 'interest', 'message', 'website']);
  if (p.website) invalid('Rejected.'); // honeypot: hidden field humans never fill
  const companySlug = str(p, 'companySlug', { max: 80 }).toLowerCase();
  const name = str(p, 'name', { max: 120 });
  const email = str(p, 'email', { max: 254, pattern: EMAIL });
  const phone = str(p, 'phone', { max: 40, optional: true });
  const organization = str(p, 'organization', { max: 160, optional: true });
  const interest = str(p, 'interest', { max: 160, optional: true });
  const message = str(p, 'message', { max: 2000 });

  const site = await resolveCompanyRoute(companySlug, { uid: null, isAppOwner: false, companyId: null }, false);
  if (site.outcome !== 'OK') fail('not-found', 'This company website is not available.');
  const companyId = (site.data!.company as { id: string }).id;

  const hour = nowIso().slice(0, 13);
  const rateRef = db().collection('counters').doc(`publicLeads_${companyId}_${hour}`);
  const leadRef = db().collection('leads').doc(`lead_pub_${Date.now()}_${randomBytes(4).toString('hex')}`);
  const eventRef = db().collection('leadEvents').doc();
  const now = nowIso();
  await db().runTransaction(async (tx) => {
    const rate = await tx.get(rateRef);
    const count = Number(rate.get('count') ?? 0);
    if (count >= PUBLIC_LEADS_PER_COMPANY_PER_HOUR) fail('resource-exhausted', 'Too many enquiries right now. Please try again later.');
    tx.set(rateRef, { companyId, hour, count: count + 1, updatedAt: serverNow() });
    tx.create(leadRef, {
      id: leadRef.id,
      companyId,
      ownerEmployeeId: 'unassigned',
      ownerUserId: 'system_unassigned',
      ownerName: 'Unassigned',
      createdBy: 'public_website',
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(organization ? { companyName: organization } : {}),
      jobTitle: 'Inbound Prospect',
      qualificationStatus: 'unqualified',
      leadStatus: 'new',
      priority: 'high',
      sourceType: 'DIRECT_SHARE',
      sourceReference: `Company Website (/company/${companySlug})`,
      qualificationNotes: interest ? `Interested in: ${interest}` : 'General enquiry',
      notesSummary: message,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(eventRef, {
      id: eventRef.id,
      companyId,
      leadId: leadRef.id,
      eventType: 'LEAD_CREATED',
      actorUserId: 'public_website',
      actorName: name,
      description: 'Enquiry submitted from the public company website',
      timestamp: now,
    });
  });
  return { received: true };
}

export const submitPublicLead = onCall({ cors: true }, async (req: CallableRequest<unknown>) => submitPublicLeadHandler(req.data));
