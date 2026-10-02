// ============================================================================
// DSBC backend entry point (Directive 25)
// ============================================================================
// Every privileged operation is a callable whose identity comes from the
// verified Firebase ID token (request.auth) — never from the payload.
// See docs/directive-25/ARCHITECTURE.md for the full map.

import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { DATABASE_ID } from './shared/firebase';
import { PAYMENTS_ENABLED, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, REGION } from './shared/config';
import { loadCaller, type Caller } from './auth/identity';
import * as ent from './entitlements/admin';
import * as subs from './subscriptions/service';
import * as pay from './billing/payments';
import * as pub from './publishing/service';
import * as cust from './customers/service';
import * as quota from './usage/quota';
import { uploadAsset as uploadAssetHandler } from './usage/uploads';
import { RazorpayProvider } from './billing/paymentProvider';
export { resolvePublicEntity } from './public/resolver';
export { submitPublicLead } from './public/leads';

setGlobalOptions({ region: REGION, maxInstances: 10 });

type Handler = (caller: Caller, data: unknown) => Promise<unknown>;

function callable(handler: Handler, secrets: Array<typeof RAZORPAY_KEY_SECRET> = []) {
  return onCall({ secrets, cors: true }, async (req: CallableRequest<unknown>) => handler(await loadCaller(req.auth), req.data));
}

const provider = () =>
  new RazorpayProvider({
    keyId: RAZORPAY_KEY_ID.value(),
    keySecret: RAZORPAY_KEY_SECRET.value(),
    webhookSecret: RAZORPAY_WEBHOOK_SECRET.value(),
  });

// ---- Customer-facing ------------------------------------------------------
export const getMyCommercialState = callable((c) => subs.getMyCommercialState(c));
export const checkEntitlement = callable(subs.checkEntitlement);
export const consumeQuota = callable(quota.consumeQuota);
export const cancelMySubscription = callable(subs.cancelMySubscription);
export const setPublishingState = callable(pub.setPublishingState);
export const uploadAsset = callable(uploadAssetHandler);
export const setMyDeletionRequest = callable(cust.setMyDeletionRequest);
export const createCheckoutOrder = callable(
  (c, d) => pay.createCheckoutOrder(c, d, provider(), PAYMENTS_ENABLED.value(), RAZORPAY_KEY_ID.value()),
  [RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET]
);
export const confirmPayment = callable(
  (c, d) => pay.confirmPayment(c, d, provider(), PAYMENTS_ENABLED.value()),
  [RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET]
);

// ---- App Owner -------------------------------------------------------------
export const bootstrapControlPlane = callable(ent.bootstrapControlPlane);
export const upsertPlan = callable(ent.upsertPlan);
export const setPlanPricing = callable(ent.setPlanPricing);
export const setPlanFeature = callable(ent.setPlanFeature);
export const duplicatePlan = callable(ent.duplicatePlan);
export const deletePlan = callable(ent.deletePlan);
export const upsertOverride = callable(ent.upsertOverride);
export const deleteOverride = callable(ent.deleteOverride);
export const updateGlobalPolicy = callable(ent.updateGlobalPolicy);
export const adminGetCustomerCommercialState = callable(subs.adminGetCustomerCommercialState);
export const adminGrantComplimentary = callable(subs.adminGrantComplimentary);
export const adminGrantTrial = callable(subs.adminGrantTrial);
export const adminChangeCustomerPlan = callable(subs.adminChangeCustomerPlan);
export const adminSetSubscriptionStatus = callable(subs.adminSetSubscriptionStatus);
export const adminReconcileNow = callable((c) => subs.adminReconcileNow(c));
export const adminCreateInvoice = callable(pay.adminCreateInvoice);
export const adminRecordInvoicePayment = callable(pay.adminRecordInvoicePayment);
export const adminSetPublishingSuspension = callable(pub.adminSetPublishingSuspension);
export const adminSetCustomerSuspension = callable(cust.adminSetCustomerSuspension);
export const adminSetCustomerClassification = callable(cust.adminSetCustomerClassification);
export const adminReviewDeletion = callable(cust.adminReviewDeletion);

// ---- Payment provider webhook (HMAC over the raw body) ----------------------
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  try {
    const out = await pay.processWebhook(
      {
        method: req.method,
        rawBody: req.rawBody,
        signature: req.get('x-razorpay-signature') ?? undefined,
        eventId: req.get('x-razorpay-event-id') ?? undefined,
      },
      provider()
    );
    if (out.status >= 400) logger.warn('razorpayWebhook rejected', { status: out.status, error: out.body.error });
    res.status(out.status).json(out.body);
  } catch (err) {
    logger.error('razorpayWebhook failed', err);
    res.status(500).json({ error: 'INTERNAL' });
  }
});

// ---- Server-measured quota (triggers) ---------------------------------------
const doc = (document: string) => ({ document, database: DATABASE_ID });

export const onEmployeeWrittenEnforceSeats = onDocumentWritten(doc('employees/{employeeId}'), async (event) => {
  const ids = new Set([event.data?.before.get('companyId'), event.data?.after.get('companyId')].filter(Boolean) as string[]);
  for (const id of ids) await quota.enforceSeatQuota(id);
});

export const onSubscriptionWrittenEnforceSeats = onDocumentWritten(doc('subscriptions/{subscriptionId}'), async (event) => {
  const after = event.data?.after;
  const before = event.data?.before;
  const type = after?.get('customerType') ?? before?.get('customerType');
  const id = after?.get('customerId') ?? before?.get('customerId');
  if (type === 'company' && id) await quota.enforceSeatQuota(id);
});

export const onOverrideWrittenEnforceSeats = onDocumentWritten(doc('entitlementOverrides/{overrideId}'), async (event) => {
  const d = event.data?.after.exists ? event.data.after : event.data?.before;
  if (d?.get('targetType') === 'company' && d.get('featureId') === 'company.team_members') await quota.enforceSeatQuota(d.get('targetId'));
});

export const onCompanyWrittenMeasure = onDocumentWritten(doc('companies/{companyId}'), async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  await quota.measureCounts({ targetType: 'company', targetId: event.params.companyId }, event.params.companyId, after.data(), quota.COMPANY_COUNT_FIELDS);
});

export const onProfileWrittenMeasure = onDocumentWritten(doc('digitalIdentityProfiles/{employeeId}'), async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  await quota.measureCounts({ targetType: 'individual', targetId: event.params.employeeId }, after.get('companyId') || event.params.employeeId, after.data(), quota.PROFILE_COUNT_FIELDS);
});

// ---- Lifecycle reconciler ----------------------------------------------------
export const reconcileSubscriptionsDaily = onSchedule({ schedule: 'every 24 hours', timeZone: 'Asia/Kolkata' }, async () => {
  const result = await subs.reconcileSubscriptions();
  logger.info('Subscription reconciliation', { examined: result.examined, changed: result.changed.length });
});
