// ============================================================================
// DSBC FIRST CUSTOMER PILOT & REVENUE VALIDATION SERVICE (Directive 23)
// ============================================================================

import { CustomerType, Subscription } from '../types/subscription';
import { Employee, Company } from '../types';
import { entitlementService } from './entitlementService';
import { subscriptionService } from './subscriptionService';
import { publishingService } from './publishingService';
import { slugService } from './slugService';
import { supportService } from './supportService';

export type PilotStage =
  | 'REGISTERED'
  | 'ONBOARDING'
  | 'LIVE_CARD'
  | 'LIVE_WEBSITE'
  | 'TRIAL_PRO'
  | 'PAID_ACTIVE'
  | 'DOWNGRADED'
  | 'GRADUATED';

export type AccountLifecycleStatus =
  | 'ACTIVE'
  | 'DELETION_REQUESTED'
  | 'RETENTION_REVIEW'
  | 'DELETED';

export interface PilotRecord {
  customerId: string;
  customerType: CustomerType;
  customerName: string;
  email: string;
  tenantId?: string;
  isPilot: boolean;
  stage: PilotStage;
  accountStatus: AccountLifecycleStatus;
  deletionRequestedAt?: string;
  deletionReason?: string;
  retentionExpiresAt?: string;
  designatedAt: string;
  designatedBy: string;
  notes?: string;
  metrics: {
    publicViews: number;
    qrScans: number;
    vcardDownloads: number;
    leadsCaptured: number;
    contactsExchanged: number;
  };
}

export interface CustomerChecklistItem {
  id: string;
  title: string;
  category: 'IDENTITY' | 'PUBLIC' | 'COMMERCIAL' | 'INTERACTION';
  completed: boolean;
  requiredForLaunch: boolean;
  details: string;
}

export interface CustomerReadinessReport {
  customerId: string;
  customerType: CustomerType;
  score: number; // 0 - 100
  totalItems: number;
  completedItems: number;
  isLaunchReady: boolean;
  items: CustomerChecklistItem[];
}

const STORAGE_KEY_PILOT_REGISTRY = 'dsbc_pilot_registry_v1';
const STORAGE_KEY_PILOT_METRICS = 'dsbc_pilot_operational_metrics_v1';

class PilotService {
  private pilotRegistry: Map<string, PilotRecord> = new Map();
  private listeners = new Set<() => void>();

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PILOT_REGISTRY);
      if (stored) {
        const parsed: PilotRecord[] = JSON.parse(stored);
        parsed.forEach((p) => this.pilotRegistry.set(`${p.customerType}_${p.customerId}`, p));
      } else {
        // Seed default pilot records for verification
        this.designatePilotCustomer('emp_acme_rahul', 'individual', 'Rahul Sharma', 'rahul.sharma@acme-innovations.com', 'company_acme', 'Pilot Individual Cardholder');
        this.designatePilotCustomer('company_acme', 'company', 'Acme Innovations Inc.', 'admin@acme-innovations.com', 'company_acme', 'Pilot Corporate Tenant');
      }
    } catch (e) {
      console.error('Error loading pilot registry:', e);
    }
  }

  private saveState(): void {
    try {
      const array = Array.from(this.pilotRegistry.values());
      localStorage.setItem(STORAGE_KEY_PILOT_REGISTRY, JSON.stringify(array));
    } catch (e) {
      console.error('Error saving pilot registry:', e);
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Pilot listener error:', e);
      }
    });
  }

  // ============================================================================
  // 1. PILOT CUSTOMER REGISTRY & CLASSIFICATION
  // ============================================================================

  public designatePilotCustomer(
    customerId: string,
    customerType: CustomerType,
    customerName: string,
    email: string,
    tenantId?: string,
    notes?: string,
    actor = { id: 'app_owner', role: 'app_owner' }
  ): PilotRecord {
    const key = `${customerType}_${customerId}`;
    const existing = this.pilotRegistry.get(key);

    const record: PilotRecord = {
      customerId,
      customerType,
      customerName,
      email,
      tenantId: tenantId || (customerType === 'company' ? customerId : undefined),
      isPilot: true,
      stage: existing?.stage || 'REGISTERED',
      accountStatus: existing?.accountStatus || 'ACTIVE',
      designatedAt: existing?.designatedAt || new Date().toISOString(),
      designatedBy: actor.id,
      notes: notes || existing?.notes || 'Customer designated as active pilot partner',
      metrics: existing?.metrics || {
        publicViews: 0,
        qrScans: 0,
        vcardDownloads: 0,
        leadsCaptured: 0,
        contactsExchanged: 0,
      },
    };

    this.pilotRegistry.set(key, record);
    this.saveState();
    this.notify();
    return record;
  }

  public removePilotStatus(
    customerId: string,
    customerType: CustomerType
  ): boolean {
    const key = `${customerType}_${customerId}`;
    const record = this.pilotRegistry.get(key);
    if (record) {
      record.isPilot = false;
      this.pilotRegistry.set(key, record);
      this.saveState();
      this.notify();
      return true;
    }
    return false;
  }

  public getPilotRecord(customerId: string, customerType: CustomerType): PilotRecord | undefined {
    return this.pilotRegistry.get(`${customerType}_${customerId}`);
  }

  public isCustomerInPilot(customerId: string, customerType: CustomerType): boolean {
    const rec = this.pilotRegistry.get(`${customerType}_${customerId}`);
    return rec?.isPilot === true;
  }

  public getAllPilotRecords(): PilotRecord[] {
    return Array.from(this.pilotRegistry.values());
  }

  public updatePilotStage(
    customerId: string,
    customerType: CustomerType,
    stage: PilotStage
  ): void {
    const rec = this.getPilotRecord(customerId, customerType);
    if (rec) {
      rec.stage = stage;
      this.saveState();
      this.notify();
    }
  }

  // ============================================================================
  // 2. PILOT READINESS CHECKLIST CALCULATION (Directive 23 Section 10)
  // ============================================================================

  public calculateIndividualReadiness(
    employee: Partial<Employee> | null,
    subscription?: Subscription | null
  ): CustomerReadinessReport {
    const customerId = employee?.id || 'emp_sample';
    const items: CustomerChecklistItem[] = [
      {
        id: 'identity_name',
        title: 'Identity & Professional Title',
        category: 'IDENTITY',
        completed: Boolean(employee?.displayName && employee?.designation),
        requiredForLaunch: true,
        details: employee?.displayName ? `${employee.displayName} (${employee.designation || 'Specialist'})` : 'Missing name or professional title',
      },
      {
        id: 'identity_photo',
        title: 'Profile Photo / Avatar',
        category: 'IDENTITY',
        completed: Boolean(employee?.profilePhotoUrl),
        requiredForLaunch: false,
        details: employee?.profilePhotoUrl ? 'High-resolution headshot uploaded' : 'Using default professional avatar initials',
      },
      {
        id: 'identity_bio',
        title: 'Biography & Positioning Statement',
        category: 'IDENTITY',
        completed: Boolean(employee?.bio && employee.bio.length >= 10),
        requiredForLaunch: true,
        details: employee?.bio ? `${employee.bio.substring(0, 45)}...` : 'Brief professional summary required',
      },
      {
        id: 'contact_channels',
        title: 'Direct Contact Channels (Phone, Email, WhatsApp)',
        category: 'IDENTITY',
        completed: Boolean(employee?.email || employee?.phone),
        requiredForLaunch: true,
        details: employee?.email || employee?.phone || 'Missing direct contact endpoints',
      },
      {
        id: 'social_channels',
        title: 'Social & Professional Links',
        category: 'IDENTITY',
        completed: Boolean(employee?.socialLinks && Object.values(employee.socialLinks).some((v) => Boolean(v))),
        requiredForLaunch: false,
        details: employee?.socialLinks ? 'LinkedIn, GitHub, or web portfolio linked' : 'No social profiles connected',
      },
      {
        id: 'public_url',
        title: 'Public Vanity URL Slug',
        category: 'PUBLIC',
        completed: Boolean(employee?.cardSlug || employee?.customSlug),
        requiredForLaunch: true,
        details: employee?.cardSlug ? `#/card/${employee.cardSlug}` : 'Custom slug unassigned',
      },
      {
        id: 'publishing_status',
        title: 'Public Publishing Governance',
        category: 'PUBLIC',
        completed: employee?.status === 'active',
        requiredForLaunch: true,
        details: employee?.status === 'active' ? 'Published live on edge' : 'In Draft or Review status',
      },
      {
        id: 'qr_code',
        title: 'Dynamic QR Code Generation',
        category: 'INTERACTION',
        completed: true,
        requiredForLaunch: true,
        details: 'Deterministic QR code generated for instant contactless scanning',
      },
      {
        id: 'vcard_download',
        title: 'Standardized vCard (.vcf) Export',
        category: 'INTERACTION',
        completed: true,
        requiredForLaunch: true,
        details: 'Universal contact card ready for Apple Contacts & Google Contacts',
      },
      {
        id: 'contact_exchange',
        title: 'Bidirectional Contact Exchange Form',
        category: 'INTERACTION',
        completed: true,
        requiredForLaunch: true,
        details: 'Contact exchange enabled with lead capture privacy compliance',
      },
      {
        id: 'appearance_theme',
        title: 'Card Layout & Appearance Theme',
        category: 'IDENTITY',
        completed: true,
        requiredForLaunch: false,
        details: 'Light/Dark/System theme styling applied',
      },
      {
        id: 'subscription_state',
        title: 'Subscription & Tier Governance',
        category: 'COMMERCIAL',
        completed: Boolean(subscription?.status === 'ACTIVE' || subscription?.status === 'TRIAL' || subscription?.planId === 'individual_free'),
        requiredForLaunch: true,
        details: subscription ? `${subscription.planId.toUpperCase()} (${subscription.status})` : 'Individual Free Tier active',
      },
    ];

    const completedCount = items.filter((i) => i.completed).length;
    const score = Math.round((completedCount / items.length) * 100);
    const requiredPass = items.filter((i) => i.requiredForLaunch).every((i) => i.completed);

    return {
      customerId,
      customerType: 'individual',
      score,
      totalItems: items.length,
      completedItems: completedCount,
      isLaunchReady: requiredPass && score >= 75,
      items,
    };
  }

  public calculateCompanyReadiness(
    company: Partial<Company> | null,
    employees: Employee[] = [],
    subscription?: Subscription | null
  ): CustomerReadinessReport {
    const customerId = company?.id || 'comp_sample';
    const compEmps = employees.filter((e) => e.companyId === company?.id);

    const items: CustomerChecklistItem[] = [
      {
        id: 'comp_identity',
        title: 'Corporate Legal & Display Name',
        category: 'IDENTITY',
        completed: Boolean(company?.name && company.name.length >= 3),
        requiredForLaunch: true,
        details: company?.name || 'Company name unassigned',
      },
      {
        id: 'comp_branding',
        title: 'Corporate Branding & Logo',
        category: 'IDENTITY',
        completed: Boolean(company?.logoUrl && company?.branding?.primaryColor),
        requiredForLaunch: true,
        details: company?.branding?.primaryColor ? `Primary Color: ${company.branding.primaryColor}` : 'Branding configuration missing',
      },
      {
        id: 'comp_story',
        title: 'Company Story, Mission & Positioning',
        category: 'IDENTITY',
        completed: Boolean(company?.description && company.description.length >= 20),
        requiredForLaunch: true,
        details: company?.description ? `${company.description.substring(0, 45)}...` : 'Corporate description required',
      },
      {
        id: 'comp_contact',
        title: 'Official Corporate Contact Details',
        category: 'IDENTITY',
        completed: Boolean(company?.email && (company?.website || company?.phone)),
        requiredForLaunch: true,
        details: company?.email ? `${company.email} • ${company.website || company.phone || ''}` : 'Official email missing',
      },
      {
        id: 'comp_services',
        title: 'Corporate Services Catalogue',
        category: 'IDENTITY',
        completed: Boolean(company?.services && company.services.length > 0),
        requiredForLaunch: false,
        details: company?.services?.length ? `${company.services.length} services configured` : 'Add core service offerings',
      },
      {
        id: 'comp_products',
        title: 'Featured Products / Solutions',
        category: 'IDENTITY',
        completed: Boolean(company?.products && company.products.length > 0),
        requiredForLaunch: false,
        details: company?.products?.length ? `${company.products.length} products listed` : 'Add product showcase items',
      },
      {
        id: 'comp_team',
        title: 'Team Directory & Employee Cards',
        category: 'IDENTITY',
        completed: compEmps.length > 0,
        requiredForLaunch: true,
        details: compEmps.length > 0 ? `${compEmps.length} active team members enrolled` : 'Enroll team members to activate directory',
      },
      {
        id: 'comp_vanity_url',
        title: 'Public Mini-Website URL Slug',
        category: 'PUBLIC',
        completed: Boolean(company?.id),
        requiredForLaunch: true,
        details: company?.id ? `#/company/${company.id.replace('company_', '')}` : 'Vanity URL unassigned',
      },
      {
        id: 'comp_publishing',
        title: 'Public Publishing Governance',
        category: 'PUBLIC',
        completed: company?.status === 'active',
        requiredForLaunch: true,
        details: company?.status === 'active' ? 'Published live on web' : 'Company unpublished or suspended',
      },
      {
        id: 'comp_subscription',
        title: 'Commercial Plan & Seat Quotas',
        category: 'COMMERCIAL',
        completed: Boolean(subscription?.status === 'ACTIVE' || subscription?.status === 'TRIAL' || subscription?.planId === 'company_free'),
        requiredForLaunch: true,
        details: subscription ? `${subscription.planId.toUpperCase()} (${subscription.status})` : 'Company Free Tier active',
      },
    ];

    const completedCount = items.filter((i) => i.completed).length;
    const score = Math.round((completedCount / items.length) * 100);
    const requiredPass = items.filter((i) => i.requiredForLaunch).every((i) => i.completed);

    return {
      customerId,
      customerType: 'company',
      score,
      totalItems: items.length,
      completedItems: completedCount,
      isLaunchReady: requiredPass && score >= 70,
      items,
    };
  }

  // ============================================================================
  // 3. PRIVACY-SAFE CUSTOMER DATA EXPORT (Directive 23 Section 12)
  // ============================================================================

  /**
   * Exports individual customer data strictly isolated with zero admin/internal secrets.
   */
  public exportIndividualData(
    employee: Employee,
    userProfile?: any,
    subscription?: Subscription | null
  ): Record<string, any> {
    return {
      exportVersion: '1.0.0-dsbc',
      exportedAt: new Date().toISOString(),
      schemaType: 'INDIVIDUAL_DIGITAL_IDENTITY_PORTABILITY',
      profile: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        displayName: employee.displayName,
        designation: employee.designation,
        email: employee.email,
        phone: employee.phone,
        bio: employee.bio,
        profilePhotoUrl: employee.profilePhotoUrl,
        socialLinks: employee.socialLinks || {},
        publicSlug: employee.cardSlug,
        status: employee.status,
        createdAt: employee.createdAt,
      },
      subscription: subscription
        ? {
            planId: subscription.planId,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            currency: subscription.currency,
            startedAt: subscription.startedAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : { planId: 'individual_free', status: 'ACTIVE' },
      disclaimer: 'Official DSBC customer data portability export. Generated according to GDPR/CCPA personal data access rights.',
    };
  }

  /**
   * Exports company customer data with zero cross-tenant metadata.
   */
  public exportCompanyData(
    company: Company,
    employees: Employee[] = [],
    subscription?: Subscription | null
  ): Record<string, any> {
    const sanitizedEmps = employees
      .filter((e) => e.companyId === company.id)
      .map((e) => ({
        id: e.id,
        name: e.displayName,
        designation: e.designation,
        email: e.email,
        phone: e.phone,
        publicSlug: e.cardSlug,
        status: e.status,
      }));

    return {
      exportVersion: '1.0.0-dsbc',
      exportedAt: new Date().toISOString(),
      schemaType: 'CORPORATE_TENANT_PORTABILITY',
      organization: {
        id: company.id,
        name: company.name,
        legalName: company.legalName,
        tagline: company.tagline,
        positioningStatement: company.positioningStatement,
        industry: company.industry,
        website: company.website,
        email: company.email,
        phone: company.phone,
        address: company.address,
        description: company.description,
        branding: company.branding,
        services: company.services || [],
        products: company.products || [],
        status: company.status,
        createdAt: company.createdAt,
      },
      teamMembers: sanitizedEmps,
      subscription: subscription
        ? {
            planId: subscription.planId,
            status: subscription.status,
            currency: subscription.currency,
            billingInterval: subscription.billingInterval,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : { planId: 'company_free', status: 'ACTIVE' },
      disclaimer: 'Official DSBC tenant data export. Confidential corporate identity package.',
    };
  }

  // ============================================================================
  // 4. CONTROLLED ACCOUNT DELETION LIFECYCLE (Directive 23 Section 13)
  // ============================================================================

  public requestAccountDeletion(
    customerId: string,
    customerType: CustomerType,
    reason = 'Customer requested account closure',
    actor = { id: 'customer', role: 'customer' }
  ): PilotRecord {
    let record = this.getPilotRecord(customerId, customerType);
    if (!record) {
      record = this.designatePilotCustomer(customerId, customerType, customerId, 'customer@example.com');
    }

    const now = new Date();
    const retentionExpiry = new Date(now.getTime() + 30 * 86400000); // 30-day review & recovery window

    record.accountStatus = 'DELETION_REQUESTED';
    record.deletionRequestedAt = now.toISOString();
    record.deletionReason = reason;
    record.retentionExpiresAt = retentionExpiry.toISOString();

    this.saveState();
    this.notify();
    return record;
  }

  public cancelAccountDeletion(
    customerId: string,
    customerType: CustomerType
  ): PilotRecord {
    const record = this.getPilotRecord(customerId, customerType);
    if (!record) throw new Error('Customer record not found');

    record.accountStatus = 'ACTIVE';
    record.deletionRequestedAt = undefined;
    record.deletionReason = undefined;
    record.retentionExpiresAt = undefined;

    this.saveState();
    this.notify();
    return record;
  }

  public reviewAccountDeletion(
    customerId: string,
    customerType: CustomerType,
    action: 'APPROVE_RETENTION' | 'CONFIRM_PURGE' | 'REJECT_RESTORE',
    actor = { id: 'app_owner', role: 'app_owner' }
  ): PilotRecord {
    if (actor.role !== 'app_owner') {
      throw new Error('ACCESS_DENIED: Only App Owner can review account deletion requests');
    }

    const record = this.getPilotRecord(customerId, customerType);
    if (!record) throw new Error('Customer record not found');

    if (action === 'APPROVE_RETENTION') {
      record.accountStatus = 'RETENTION_REVIEW';
    } else if (action === 'CONFIRM_PURGE') {
      record.accountStatus = 'DELETED';
      record.isPilot = false;
    } else if (action === 'REJECT_RESTORE') {
      record.accountStatus = 'ACTIVE';
      record.deletionRequestedAt = undefined;
      record.deletionReason = undefined;
    }

    this.saveState();
    this.notify();
    return record;
  }

  // ============================================================================
  // 5. PILOT OPERATIONAL METRICS (Directive 23 Section 14)
  // ============================================================================

  public recordPilotInteraction(
    customerId: string,
    customerType: CustomerType,
    metric: 'publicViews' | 'qrScans' | 'vcardDownloads' | 'leadsCaptured' | 'contactsExchanged',
    increment = 1
  ): void {
    const rec = this.getPilotRecord(customerId, customerType);
    if (rec) {
      rec.metrics[metric] = (rec.metrics[metric] || 0) + increment;
      this.saveState();
      this.notify();
    }
  }
}

export const pilotService = new PilotService();
