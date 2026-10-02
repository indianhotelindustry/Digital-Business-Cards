// ============================================================================
// DSBC FIRST CUSTOMER PILOT & REVENUE VALIDATION (Directive 23 UX, Directive 25 authority)
// ============================================================================
// The pilot registry and the account-deletion lifecycle used to live in
// localStorage (dsbc_pilot_registry_v1). They are now customerClassifications
// documents written only by the backend:
//   adminSetCustomerClassification   App Owner: pilot flag, stage, notes
//   setMyDeletionRequest             customer: request / withdraw deletion
//   adminReviewDeletion              App Owner: retention review, purge approval
// Readiness scoring and data export below are pure presentation helpers.

import { CustomerType, Subscription } from '../types/subscription';
import { Employee, Company } from '../types';
import { callBackend } from '../lib/backend';
import { commercialStore, toIso } from './commercialStore';

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
  | 'PURGE_APPROVED'
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


const ZERO_METRICS: PilotRecord['metrics'] = { publicViews: 0, qrScans: 0, vcardDownloads: 0, leadsCaptured: 0, contactsExchanged: 0 };

function recordFromDoc(d: Record<string, unknown>): PilotRecord {
  return {
    customerId: String(d.customerId ?? ''),
    customerType: (d.customerType === 'company' ? 'company' : 'individual') as CustomerType,
    customerName: String(d.customerName ?? d.customerId ?? ''),
    email: String(d.email ?? ''),
    tenantId: (d.tenantId as string) || undefined,
    isPilot: d.isPilot === true,
    stage: (d.stage as PilotStage) || 'REGISTERED',
    accountStatus: (d.accountStatus as AccountLifecycleStatus) || 'ACTIVE',
    deletionRequestedAt: toIso(d.deletionRequestedAt) || undefined,
    deletionReason: (d.deletionReason as string) || undefined,
    retentionExpiresAt: toIso(d.retentionExpiresAt) || undefined,
    designatedAt: toIso(d.designatedAt) || '',
    designatedBy: String(d.designatedBy ?? ''),
    notes: (d.notes as string) || undefined,
    metrics: { ...ZERO_METRICS },
  };
}

class PilotService {
  public subscribe(fn: () => void): () => void {
    return commercialStore.subscribe(fn);
  }

  // ============================================================================
  // 1. PILOT CUSTOMER REGISTRY & CLASSIFICATION (App Owner, backend-authorised)
  // ============================================================================

  public async designatePilotCustomer(
    customerId: string,
    customerType: CustomerType,
    _customerName: string,
    _email: string,
    _tenantId?: string,
    notes?: string
  ): Promise<void> {
    await callBackend('adminSetCustomerClassification', {
      customerType,
      customerId,
      isPilot: true,
      ...(notes ? { notes } : {}),
      reason: notes || 'Designated as pilot customer',
    });
  }

  public async removePilotStatus(customerId: string, customerType: CustomerType): Promise<void> {
    await callBackend('adminSetCustomerClassification', { customerType, customerId, isPilot: false, reason: 'Pilot status removed' });
  }

  public async updatePilotStage(customerId: string, customerType: CustomerType, stage: PilotStage): Promise<void> {
    const current = this.getPilotRecord(customerId, customerType);
    await callBackend('adminSetCustomerClassification', {
      customerType,
      customerId,
      isPilot: current?.isPilot ?? true,
      stage,
      reason: `Pilot stage set to ${stage}`,
    });
  }

  public getPilotRecord(customerId: string, customerType: CustomerType): PilotRecord | undefined {
    const d = commercialStore.classifications.find((c) => c.id === `${customerType}_${customerId}`);
    return d ? recordFromDoc(d) : undefined;
  }

  public isCustomerInPilot(customerId: string, customerType: CustomerType): boolean {
    return this.getPilotRecord(customerId, customerType)?.isPilot === true;
  }

  public getAllPilotRecords(): PilotRecord[] {
    return commercialStore.classifications.map(recordFromDoc);
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
  // Content is never deleted from the browser. A request opens a 30-day
  // retention review; CONFIRM_PURGE only marks the record for a separate,
  // manual, audited purge.

  /** Customer: request closure of their own account. */
  public async requestAccountDeletion(reason = 'Customer requested account closure'): Promise<void> {
    await callBackend('setMyDeletionRequest', { requested: true, reason });
  }

  /** Customer: withdraw their own pending request. */
  public async cancelAccountDeletion(): Promise<void> {
    await callBackend('setMyDeletionRequest', { requested: false });
  }

  /** App Owner. */
  public async reviewAccountDeletion(
    customerId: string,
    customerType: CustomerType,
    action: 'APPROVE_RETENTION' | 'CONFIRM_PURGE' | 'REJECT_RESTORE',
    reason = 'Reviewed in Pilot Control'
  ): Promise<void> {
    await callBackend('adminReviewDeletion', { customerType, customerId, action, reason });
  }
}

export const pilotService = new PilotService();
