// ============================================================================
// DSBC PRODUCTION AUDIT & LAUNCH GATE ENGINE (Directive 22)
// ============================================================================

import { environmentConfig, EnvironmentConfig } from './environmentConfig';
import { entitlementService } from './entitlementService';
import { slugService } from './slugService';
// Directive 25: backend-authority items are taken from the machine-readable
// report (scripts/directive25/backendReadiness.mjs), never asserted here.
import backendReadiness from '../../docs/directive-25/backend-readiness.json';

type ReadinessKey = keyof typeof backendReadiness.summary;
const READINESS_SOURCE = `backend-readiness.json ${backendReadiness.generatedAt.slice(0, 10)} @ ${backendReadiness.commit.slice(0, 7)}`;
const fromReport = (...keys: ReadinessKey[]): ChecklistStatus => (keys.every((k) => backendReadiness.summary[k] === 'PASS') ? 'PASS' : 'FAIL');
const authCase = (...ids: string[]): ChecklistStatus =>
  ids.every((id) => (backendReadiness.tests.authCases as Record<string, { passed: boolean }>)[id]?.passed) ? 'PASS' : 'FAIL';
const t = backendReadiness.tests;

export type DependencyStatus = 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR' | 'WARNING';
export type ChecklistStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CONFIGURED';

export interface DependencyAuditItem {
  id: string;
  name: string;
  category: 'INFRASTRUCTURE' | 'AUTH' | 'DATABASE' | 'PAYMENTS' | 'PUBLISHING' | 'POLICIES';
  status: DependencyStatus;
  currentValue: string;
  details: string;
  remediation?: string;
}

export interface LaunchChecklistItem {
  categoryLetter: string;
  categoryTitle: string;
  items: Array<{
    id: string;
    title: string;
    status: ChecklistStatus;
    details: string;
    blockerForLiveLaunch: boolean;
  }>;
}

class ProductionAuditService {
  /**
   * Evaluates all 17 mandatory production dependencies according to Directive 22 Section 1
   */
  public auditProductionDependencies(): DependencyAuditItem[] {
    const config = environmentConfig.getConfig();
    const plans = entitlementService.getPlans();
    const reservedSlugs = slugService.getReservedSlugs ? slugService.getReservedSlugs() : ['admin', 'api', 'card', 'company', 'pricing', 'login'];

    return [
      {
        id: 'dep_firebase_project',
        name: 'Firebase Project ID',
        category: 'INFRASTRUCTURE',
        status: config.firebaseProjectId ? 'CONNECTED' : 'NOT_CONFIGURED',
        currentValue: config.firebaseProjectId,
        details: `${config.environment} target, database ${config.firestoreDatabaseId} (pinned at build time in config/environments.json)`,
      },
      {
        id: 'dep_firebase_auth',
        name: 'Firebase Authentication',
        category: 'AUTH',
        status: config.authDomain ? 'CONNECTED' : 'NOT_CONFIGURED',
        currentValue: config.authDomain,
        details: 'Multi-tenant identity provider & OAuth consent boundary active',
      },
      {
        id: 'dep_firestore',
        name: 'Cloud Firestore Database',
        category: 'DATABASE',
        status: config.firestoreDatabaseId ? 'CONNECTED' : 'NOT_CONFIGURED',
        currentValue: config.firestoreDatabaseId,
        details: 'Zero-trust tenant isolation with atomic security rules',
      },
      {
        id: 'dep_firebase_storage',
        name: 'Firebase Storage Bucket',
        category: 'INFRASTRUCTURE',
        status: config.storageBucket ? 'CONNECTED' : 'NOT_CONFIGURED',
        currentValue: config.storageBucket,
        details: 'Tenant media, logo, and avatar binary asset storage',
      },
      {
        id: 'dep_firebase_hosting',
        name: 'Firebase Hosting / CDN',
        category: 'INFRASTRUCTURE',
        status: config.hostingSite ? 'WARNING' : 'NOT_CONFIGURED',
        currentValue: config.hostingSite ?? 'No DSBC hosting site designated',
        details: 'Deployment is verified by the deployment preflight and backend Platform Health, never asserted by the browser',
        remediation: config.hostingSite ? undefined : 'Designate a dedicated hosting site (docs/directive-27/PRODUCTION-CONFIGURATION.md)',
      },
      {
        id: 'dep_razorpay_creds',
        name: 'Razorpay Production Credentials',
        category: 'PAYMENTS',
        status: 'WARNING',
        currentValue: `Payments ${config.paymentGatewayMode}`,
        details: 'Online payments are intentionally switched off (PAYMENTS_ENABLED=false). Merchant credentials live only in Secret Manager, never in the browser.',
        remediation: 'A dedicated payment-launch directive enables payments after a real provider test',
      },
      {
        id: 'dep_razorpay_webhook',
        name: 'Razorpay Webhook Endpoint',
        category: 'PAYMENTS',
        status: backendReadiness.summary.webhookCryptographicVerification === 'PASS' ? 'WARNING' : 'ERROR',
        currentValue: 'razorpayWebhook Cloud Function (HMAC-SHA256 over raw body)',
        details: `Emulator-verified, idempotent per event and order; not deployed (${READINESS_SOURCE})`,
        remediation: 'Deploy functions and register the webhook URL + secret in Razorpay',
      },
      {
        id: 'dep_email_provider',
        name: 'Email & Notification Dispatcher',
        category: 'INFRASTRUCTURE',
        status: 'NOT_CONFIGURED',
        currentValue: 'No email provider integrated',
        details: 'Notification records are kept in this browser only; nothing is delivered by email yet',
      },
      {
        id: 'dep_app_environment',
        name: 'Application Environment',
        category: 'POLICIES',
        status: config.isProduction ? 'CONNECTED' : 'WARNING',
        currentValue: config.environment,
        details: `Selected at build time (config/environments.json); it cannot be switched from the browser. Demo data ${config.enableDemoData ? 'allowed' : 'blocked'}.`,
      },
      {
        id: 'dep_public_url',
        name: 'Public Application URL',
        category: 'PUBLISHING',
        status: config.publicOrigin ? 'CONNECTED' : 'NOT_CONFIGURED',
        currentValue: config.publicOrigin ?? 'No production domain designated',
        details: 'Canonical public URLs: /card/{slug}, /profile/{slug}, /company/{slug}',
      },
      {
        id: 'dep_functions_region',
        name: 'Cloud Functions Region',
        category: 'INFRASTRUCTURE',
        status: config.usesEmulators ? 'WARNING' : 'CONNECTED',
        currentValue: config.functionsRegion,
        details: config.usesEmulators ? 'Local emulator suite (development)' : 'Backend region pinned for this target; deployment verified by the preflight',
      },
      {
        id: 'dep_firestore_rules',
        name: 'Firestore Security Rules',
        category: 'DATABASE',
        status: backendReadiness.summary.directive24RegressionPassing === 'PASS' ? 'WARNING' : 'ERROR',
        currentValue: 'firestore.rules (Directive 24/25, emulator-tested, not deployed)',
        details: `Rules ${t.rulesDirective24.passed}/${t.rulesDirective24.total}, backend authority ${t.backendAuthority.passed}/${t.backendAuthority.total} on the emulator (${READINESS_SOURCE})`,
      },
      {
        id: 'dep_firestore_indexes',
        name: 'Firestore Composite Indexes',
        category: 'DATABASE',
        status: 'WARNING',
        currentValue: 'firestore.indexes.json (Directive 27)',
        details: 'Defined in source for every composite query; deployment is verified by the preflight, not the browser',
      },
      {
        id: 'dep_app_owner_id',
        name: 'App Owner Authoritative Identity',
        category: 'POLICIES',
        status: 'WARNING',
        currentValue: 'platformRole = app_owner custom claim (verified email)',
        details: 'Granted only with Admin credentials (scripts/admin/setAppOwner.ts); never by email string, role field or browser state',
      },
      {
        id: 'dep_reserved_slugs',
        name: 'Reserved Public Slug Registry',
        category: 'PUBLISHING',
        status: reservedSlugs.length >= 6 ? 'CONNECTED' : 'WARNING',
        currentValue: `${reservedSlugs.length} System Namespaces Protected`,
        details: 'Collision and route takeover protection for system endpoints',
      },
      {
        id: 'dep_ind_free_plan',
        name: 'Default Individual Free Plan',
        category: 'POLICIES',
        status: plans.some((p) => p.id === 'individual_free') ? 'CONNECTED' : 'ERROR',
        currentValue: 'individual_free (₹0 / Free Forever)',
        details: 'Authoritative baseline smart card entitlement tier',
      },
      {
        id: 'dep_comp_free_plan',
        name: 'Default Company Free Plan',
        category: 'POLICIES',
        status: plans.some((p) => p.id === 'company_free') ? 'CONNECTED' : 'ERROR',
        currentValue: 'company_free (₹0 / 3 Seats)',
        details: 'Authoritative baseline corporate mini-website tier',
      },
    ];
  }

  /**
   * Generates the Comprehensive 14-Category Production Launch Checklist (Directive 22 Section 12)
   */
  public generateLaunchChecklist(): LaunchChecklistItem[] {
    const config = environmentConfig.getConfig();
    const plans = entitlementService.getPlans();

    return [
      {
        categoryLetter: 'A',
        categoryTitle: 'Infrastructure & Cloud Platform',
        items: [
          {
            id: 'CHK-A1',
            title: 'Firebase project allocated and bound to production GCP project',
            status: 'WARNING',
            details: `Target pinned to ${config.firebaseProjectId} / ${config.firestoreDatabaseId}; deployment pending (docs/directive-27/PRODUCTION-CONFIGURATION.md)`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-A2',
            title: 'CDN edge delivery configured with SSL certificates',
            status: config.hostingSite ? 'WARNING' : 'NOT_CONFIGURED',
            details: 'Hosting configuration (HTTPS, path routes, 404, security headers) is in firebase.production.json; no DSBC site deployed yet',
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'B',
        categoryTitle: 'Authentication & Tenant Authorization',
        items: [
          {
            id: 'CHK-B1',
            title: 'Email/Password & Session Token Verification active',
            status: 'WARNING',
            details: 'The Email/Password provider must be enabled on the production Auth project before launch (checked by the preflight)',
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-B2',
            title: 'Role-Based Access Control (App Owner, Company Admin, Employee)',
            status: fromReport('tenantIsolationVerified'),
            details: `Server-side roles and claims, emulator-verified (${READINESS_SOURCE}); not yet deployed`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'C',
        categoryTitle: 'Database & Security Rules',
        items: [
          {
            id: 'CHK-C1',
            title: 'Firestore security rules reject cross-tenant reads & writes',
            status: fromReport('tenantIsolationVerified'),
            details: `AUTH-012 + Directive 24 tenant suite (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-C2',
            title: 'Append-only immutable audit logging enforced for commercial events',
            status: fromReport('auditImmutability'),
            details: `Create-only, content-hashed ledger; client writes denied (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'D',
        categoryTitle: 'Binary Storage & Media Assets',
        items: [
          {
            id: 'CHK-D1',
            title: 'Tenant-scoped storage buckets for logos, photos, and vCard assets',
            status: 'WARNING',
            details: `Backend-only uploads to tenant-scoped paths (storage.rules); bucket ${config.storageBucket} must exist before deployment`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'E',
        categoryTitle: 'Payments & Merchant Gateway',
        items: [
          {
            id: 'CHK-E1',
            title: 'Razorpay payment abstraction integration with live/test modes',
            status: 'FAIL',
            details: 'Payments disabled (PAYMENTS_ENABLED=false); no real Razorpay test has been run',
            blockerForLiveLaunch: config.isProduction,
          },
          {
            id: 'CHK-E2',
            title: 'Client-side payment forgery strictly blocked from granting entitlements',
            status: fromReport('subscriptionAuthorityServerSide', 'clientAuthorityRemoved'),
            details: `Paid access only after backend payment verification (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'F',
        categoryTitle: 'Webhooks & Asynchronous Processing',
        items: [
          {
            id: 'CHK-F1',
            title: 'HMAC-SHA256 signature verification on Razorpay events',
            status: fromReport('webhookCryptographicVerification'),
            details: `Backend HMAC-SHA256, constant-time compare (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-F2',
            title: 'Idempotency and replay attack protection',
            status: authCase('AUTH-023'),
            details: `Webhook ledger + per-order idempotency (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'G',
        categoryTitle: 'Notifications & Customer Communications',
        items: [
          {
            id: 'CHK-G1',
            title: '9 Mandatory customer lifecycle notifications active',
            status: 'NOT_CONFIGURED',
            details: 'Templates exist, but no delivery provider is integrated; nothing is sent by email',
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-G2',
            title: 'Zero cross-tenant notification leakage',
            status: 'WARNING',
            details: 'Notification records are local to the browser that created them; no server-side ledger yet',
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'H',
        categoryTitle: 'Entitlement Engine & Commercial Tiers',
        items: [
          {
            id: 'CHK-H1',
            title: '100% configuration-driven pricing matrix without hardcoded values',
            status: fromReport('commercialStatePersistent'),
            details: `${plans.length} plans loaded from Firestore; App Owner-only mutations (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-H2',
            title: 'Fail-closed behavior for protected capabilities when unentitled',
            status: fromReport('entitlementAuthorityServerSide'),
            details: `Server-resolved entitlements; locked when no server answer (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'I',
        categoryTitle: 'Public Publishing & Vanity Routes',
        items: [
          {
            id: 'CHK-I1',
            title: 'DRAFT, PREVIEW, and SUSPENDED states blocked from public visitors',
            status: authCase('AUTH-024'),
            details: `Backend publishing state enforced by firestore.rules (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-I2',
            title: 'Reserved slug protection against route collisions',
            status: authCase('AUTH-024'),
            details: `Reserved routes and slug ownership checked by the backend (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'J',
        categoryTitle: 'Customer Lifecycle & Zero Data Loss',
        items: [
          {
            id: 'CHK-J1',
            title: 'Customer Data preserved across subscription downgrades & cancellations',
            status: authCase('AUTH-015'),
            details: `Downgrade locks seats, deletes nothing (${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-J2',
            title: 'Self-service individual & company profile management operational',
            status: 'PASS',
            details: 'Complete editing capabilities available without developer intervention',
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'K',
        categoryTitle: 'Security & Regression Verification',
        items: [
          {
            id: 'CHK-K1',
            title: 'Emulator security suites: backend authority + Directive 24 rules regression',
            status: fromReport('emulatorTested', 'directive24RegressionPassing'),
            details: `Backend ${t.backendAuthority.passed}/${t.backendAuthority.total}, rules ${t.rulesDirective24.passed}/${t.rulesDirective24.total}, unit ${t.unit.passed}/${t.unit.total} (emulator; ${READINESS_SOURCE})`,
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'L',
        categoryTitle: 'Backup & Disaster Recovery Readiness',
        items: [
          {
            id: 'CHK-L1',
            title: 'Automated Firestore export policy & Storage recovery strategy documented',
            status: 'WARNING',
            details: 'Pre-deployment export and rollback documented (docs/directive-27/DEPLOYMENT-RUNBOOK.md); point-in-time recovery must be enabled on the production database',
            blockerForLiveLaunch: true,
          },
          {
            id: 'CHK-L2',
            title: 'App Owner disaster recovery identity verified',
            status: 'NOT_CONFIGURED',
            details: 'Grant / verify / revoke / recovery procedure documented; the production App Owner claim has not been granted yet',
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'M',
        categoryTitle: 'Monitoring, Telemetry & Health Observability',
        items: [
          {
            id: 'CHK-M1',
            title: 'System health dashboard monitors 9 core application components',
            status: 'WARNING',
            details: 'Platform Health is measured by the backend (adminGetPlatformHealth); it reports only what it actually checked',
            blockerForLiveLaunch: true,
          },
        ],
      },
      {
        categoryLetter: 'N',
        categoryTitle: 'Legal & Business Launch Configuration',
        items: [
          {
            id: 'CHK-N1',
            title: 'Terms of Service, Privacy Policy, and Support Contact accessible',
            status: 'PASS',
            details: 'Public footer & support inquiry desk operational',
            blockerForLiveLaunch: true,
          },
        ],
      },
    ];
  }
}

export const productionAuditService = new ProductionAuditService();
