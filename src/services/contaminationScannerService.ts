// ============================================================================
// DSBC PRODUCTION CONTAMINATION SCANNER SERVICE (Directive 22 Section 2)
// ============================================================================

import { DEMO_USERS, DEMO_COMPANIES, DEMO_EMPLOYEES } from './seedService';
import { environmentConfig } from './environmentConfig';
import { supportService } from './supportService';
import { conversionFunnelService } from './conversionFunnelService';

export interface ContaminationCategoryCount {
  category: string;
  count: number;
  suspiciousIds: string[];
  description: string;
}

export interface ContaminationScanResult {
  status: 'PRODUCTION_CLEAN' | 'PRODUCTION_CONTAMINATED';
  timestamp: string;
  environment: string;
  totalSuspiciousRecords: number;
  categories: ContaminationCategoryCount[];
  recommendation: string;
}

class ContaminationScannerService {
  /**
   * Deterministically scans storage and memory for development / demo contamination.
   * CRITICAL: Never automatically deletes production data.
   */
  public scanContamination(
    companies: any[] = [],
    employees: any[] = [],
    subscriptions: any[] = [],
    invoices: any[] = [],
    overrides: any[] = []
  ): ContaminationScanResult {
    const env = environmentConfig.getConfig();
    const categories: ContaminationCategoryCount[] = [];

    // 1. Demo Users Check
    const demoUserIds = Object.values(DEMO_USERS).map((u) => u.id);
    const foundDemoUsers = demoUserIds.filter((id) => id.includes('demo') || id.includes('nexus') || id.includes('acme'));
    categories.push({
      category: 'Demo User Personas',
      count: foundDemoUsers.length,
      suspiciousIds: foundDemoUsers,
      description: 'Hardcoded interactive demonstration personas in seed catalogue.',
    });

    // 2. Demo Companies Check
    const demoCompIds = Object.values(DEMO_COMPANIES).map((c) => c.id);
    const foundDemoComps = companies.filter((c) => demoCompIds.includes(c.id) || c.id.includes('demo')).map((c) => c.id);
    categories.push({
      category: 'Demo Company Tenants',
      count: foundDemoComps.length,
      suspiciousIds: foundDemoComps,
      description: 'Tenancy documents originating from automated starter fixtures.',
    });

    // 3. Demo Employees Check
    const demoEmpIds = Object.values(DEMO_EMPLOYEES).map((e) => e.id);
    const foundDemoEmps = employees.filter((e) => demoEmpIds.includes(e.id) || e.id.includes('demo')).map((e) => e.id);
    categories.push({
      category: 'Demo Employee Records',
      count: foundDemoEmps.length,
      suspiciousIds: foundDemoEmps,
      description: 'Demo cards and employee identities seeded for testing.',
    });

    // 4. Development Payment Records
    const devPayments = invoices.filter((i) => i.gatewayInvoiceId?.includes('test') || i.razorpayPaymentId?.includes('mock') || i.id?.includes('test')).map((i) => i.id);
    categories.push({
      category: 'Development Payment Records',
      count: devPayments.length,
      suspiciousIds: devPayments,
      description: 'Invoices created with test credentials or simulated signatures.',
    });

    // 5. Development Subscriptions
    const devSubs = subscriptions.filter((s) => s.id?.includes('test') || s.gatewaySubscriptionId?.includes('test')).map((s) => s.id);
    categories.push({
      category: 'Development Subscriptions',
      count: devSubs.length,
      suspiciousIds: devSubs,
      description: 'Subscriptions created under non-authoritative simulation paths.',
    });

    // 6. Test Entitlement Overrides
    const testOverrides = overrides.filter((o) => o.notes?.toLowerCase().includes('test') || o.id?.includes('test')).map((o) => o.id);
    categories.push({
      category: 'Test Entitlement Overrides',
      count: testOverrides.length,
      suspiciousIds: testOverrides,
      description: 'Manual privilege overrides created for verification sessions.',
    });

    // 7. Test Support Tickets
    const testTickets = supportService.getTickets().filter((t) => t.id?.includes('seed') || t.email?.includes('example.com')).map((t) => t.id);
    categories.push({
      category: 'Test Support Inquiries',
      count: testTickets.length,
      suspiciousIds: testTickets,
      description: 'Sample support inquiries with synthetic email domains.',
    });

    // 8. Test Analytics / Funnel Events
    const funnelMetrics = conversionFunnelService.getFunnelMetrics();
    const testFunnelEvents = funnelMetrics.recentEvents.filter((e) => e.id?.includes('seed')).map((e) => e.id);
    categories.push({
      category: 'Test Analytics & Funnel Records',
      count: testFunnelEvents.length,
      suspiciousIds: testFunnelEvents,
      description: 'Synthetic conversion events initialized for telemetry baseline.',
    });

    const totalSuspicious = categories.reduce((sum, c) => sum + c.count, 0);

    // If running in production environment, any detected demo record marks CONTAMINATED
    const isContaminated = env.isProduction && totalSuspicious > 0;

    return {
      status: isContaminated ? 'PRODUCTION_CONTAMINATED' : 'PRODUCTION_CLEAN',
      timestamp: new Date().toISOString(),
      environment: env.environment,
      totalSuspiciousRecords: totalSuspicious,
      categories,
      recommendation: isContaminated
        ? 'Isolate development artifacts prior to customer traffic cutover. Zero automatic deletions performed.'
        : 'Storage state is verified and isolated for authoritative commercial operations.',
    };
  }
}

export const contaminationScannerService = new ContaminationScannerService();
