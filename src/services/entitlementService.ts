import {
  EntitlementStatus,
  LimitUnit,
  FeatureDefinition,
  Plan,
  EntitlementOverride,
  EffectiveEntitlement,
  EntitlementAuditLog,
  GlobalPlatformPolicy,
  UsageMetric,
  EntitlementRule,
} from '../types/entitlement';
import { UserRole } from '../types';

// ============================================================================
// 1. FEATURE REGISTRY CATALOGUE
// ============================================================================
export const FEATURE_CATALOGUE: FeatureDefinition[] = [
  // Individual Features
  {
    id: 'individual.business_card',
    name: 'Digital Business Card',
    description: 'Shareable personal digital smart card at #/card/{slug}',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'CreditCard',
  },
  {
    id: 'individual.full_profile',
    name: 'Full Individual Profile',
    description: 'Comprehensive personal bio, career, services, and showcase at #/profile/{slug}',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'User',
  },
  {
    id: 'individual.custom_slug',
    name: 'Custom Vanity Slug',
    description: 'Personalized vanity URL slug for cards and full profiles',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'DISABLED',
    icon: 'Link2',
  },
  {
    id: 'individual.custom_template',
    name: 'Card Templates & Layouts',
    description: 'Switch between Classic, Modern, Minimal, and bespoke design layouts',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'Layout',
  },
  {
    id: 'individual.theme',
    name: 'Theme & Appearance Mode',
    description: 'Universal light, dark, and system color palettes and accents',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'Palette',
  },
  {
    id: 'individual.social_links',
    name: 'Rich Social Channels',
    description: 'Unlimited social links (LinkedIn, GitHub, X, Instagram, YouTube, Medium, Portfolio)',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'Share2',
  },
  {
    id: 'individual.services',
    name: 'Personal Services Catalog',
    description: 'Showcase freelance or professional services with pricing & deliverables',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'Briefcase',
  },
  {
    id: 'individual.portfolio',
    name: 'Portfolio & Projects',
    description: 'Project gallery with client references, tags, and direct outbound links',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'FolderKanban',
  },
  {
    id: 'individual.career',
    name: 'Career Timeline & Experience',
    description: 'Chronological work history and leadership milestones',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'History',
  },
  {
    id: 'individual.certifications',
    name: 'Certifications & Credentials',
    description: 'Verified professional licenses, credentials, and digital badges',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'Award',
  },
  {
    id: 'individual.testimonials',
    name: 'Personal Testimonials & Endorsements',
    description: 'Peer, client, and executive recommendations with avatars and ratings',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'Quote',
  },
  {
    id: 'individual.analytics',
    name: 'Personal Card Analytics',
    description: 'Live view counts, click-through rates, and interaction heatmaps',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'DISABLED',
    icon: 'BarChart2',
  },
  {
    id: 'individual.ai_capture',
    name: 'AI Card Scanner & Contact Extraction',
    description: 'OCR & AI multi-field business card extraction from camera uploads',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'DISABLED',
    icon: 'Camera',
    badge: 'AI',
  },
  {
    id: 'individual.ai_assistance',
    name: 'AI Bio & Copy Generator',
    description: 'AI-assisted generation of professional bios, headlines, and value props',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'DISABLED',
    icon: 'Sparkles',
    badge: 'AI',
  },
  {
    id: 'individual.contact_exchange',
    name: 'DSBC Connect & Mutual Exchange',
    description: 'Two-way contact exchange with reciprocal approval and consent tracking',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'Users',
  },
  {
    id: 'individual.vcard',
    name: 'vCard 3.0 / Contact Save',
    description: 'One-click vCard download into iOS Contacts and Google Contacts',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'Contact',
  },
  {
    id: 'individual.qr_code',
    name: 'Dynamic QR Code Generator',
    description: 'High-res QR code with logo embedding and vector SVG download',
    category: 'individual',
    scope: 'individual',
    defaultEntitlement: 'ENABLED',
    icon: 'QrCode',
  },

  // Company Features
  {
    id: 'company.mini_website',
    name: 'Corporate Mini-Website',
    description: 'Public authoritative corporate landing page at #/company/{companySlug}',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Globe',
  },
  {
    id: 'company.custom_slug',
    name: 'Company Vanity Slug',
    description: 'Branded vanity URL slug for corporate landing pages',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Link2',
  },
  {
    id: 'company.services',
    name: 'Corporate Service Offerings',
    description: 'Enterprise service listings with deliverables, starting prices, and CTAs',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'Layers',
  },
  {
    id: 'company.products',
    name: 'Product Catalog & Showcase',
    description: 'Featured product items with badges, screenshots, and conversion triggers',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 3,
    icon: 'Package',
  },
  {
    id: 'company.case_studies',
    name: 'Client Case Studies & Wins',
    description: 'Customer success narratives with challenge, solution, and ROI outcome',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 2,
    icon: 'FileText',
  },
  {
    id: 'company.testimonials',
    name: 'Corporate Testimonials & Trust',
    description: 'Enterprise social proof, client endorsements, and executive quotes',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'COUNT',
    defaultLimit: 2,
    icon: 'MessageSquare',
  },
  {
    id: 'company.team_directory',
    name: 'Public Team Directory',
    description: 'Interactive company team directory with direct link to employee cards',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Users2',
  },
  {
    id: 'company.team_members',
    name: 'Team Member Seats',
    description: 'Maximum number of onboarded employee cards per company tenant',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'EMPLOYEES',
    defaultLimit: 3,
    icon: 'UserPlus',
  },
  {
    id: 'company.lead_capture',
    name: 'Corporate Pipeline & CRM',
    description: 'Team lead capture forms, event campaigns, and qualification pipeline',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Target',
  },
  {
    id: 'company.analytics',
    name: 'Corporate Analytics & Intelligence',
    description: 'Organization-wide card views, lead conversion funnel, and team performance',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'DISABLED',
    icon: 'LineChart',
  },
  {
    id: 'company.company_vcard',
    name: 'Corporate vCard Download',
    description: 'Centralized company contact vCard for headquarter dispatch',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Building',
  },
  {
    id: 'company.custom_branding',
    name: 'Custom Corporate Branding',
    description: 'Custom primary & secondary hex colors, hero banners, and corporate logos',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'ENABLED',
    icon: 'Paintbrush',
  },
  {
    id: 'company.custom_domain',
    name: 'Custom Domain Linking',
    description: 'Host mini-website and cards under your own custom domain (e.g. cards.acme.com)',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'DISABLED',
    icon: 'Compass',
  },
  {
    id: 'company.remove_branding',
    name: 'Remove "Powered by DSBC" Badge',
    description: 'White-label card and mini-website footer without DSBC branding',
    category: 'company',
    scope: 'both',
    defaultEntitlement: 'DISABLED',
    icon: 'EyeOff',
  },
  {
    id: 'company.storage',
    name: 'Media & Asset Storage',
    description: 'Total disk space for logos, avatars, hero images, and portfolio assets',
    category: 'company',
    scope: 'both',
    defaultEntitlement: 'LIMITED',
    limitUnit: 'STORAGE_MB',
    defaultLimit: 500,
    icon: 'HardDrive',
  },
  {
    id: 'company.ai_assistance',
    name: 'Corporate AI Copywriting & Summary',
    description: 'Enterprise AI suite for mission, vision, core values, and product copy generation',
    category: 'company',
    scope: 'company',
    defaultEntitlement: 'DISABLED',
    icon: 'Sparkles',
    badge: 'AI',
  },
];

// Map for quick feature lookup
export const FEATURE_MAP = new Map<string, FeatureDefinition>(
  FEATURE_CATALOGUE.map((f) => [f.id, f])
);

// Centralized Feature Dependencies
export const FEATURE_DEPENDENCIES: Record<string, string[]> = {
  'company.team_directory': ['company.mini_website'],
  'company.services': ['company.mini_website'],
  'company.products': ['company.mini_website'],
  'company.case_studies': ['company.mini_website'],
  'company.testimonials': ['company.mini_website'],
  'company.custom_domain': ['company.mini_website'],
};

// ============================================================================
// 2. SEED PLANS (Default Configurable Seed Matrix)
// ============================================================================
export const INITIAL_PLANS: Plan[] = [
  {
    id: 'individual_free',
    name: 'Individual Free',
    targetType: 'individual',
    description: 'Essential digital business card for individual professionals and freelancers',
    price: 0,
    currency: 'INR',
    billingCycle: 'free',
    isActive: true,
    features: {
      'individual.business_card': { status: 'ENABLED' },
      'individual.full_profile': { status: 'ENABLED' },
      'individual.custom_slug': { status: 'DISABLED' },
      'individual.custom_template': { status: 'ENABLED' },
      'individual.theme': { status: 'ENABLED' },
      'individual.social_links': { status: 'ENABLED' },
      'individual.services': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.portfolio': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.career': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.certifications': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.testimonials': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.analytics': { status: 'DISABLED' },
      'individual.ai_capture': { status: 'DISABLED' },
      'individual.ai_assistance': { status: 'DISABLED' },
      'individual.contact_exchange': { status: 'ENABLED' },
      'individual.vcard': { status: 'ENABLED' },
      'individual.qr_code': { status: 'ENABLED' },
      'company.remove_branding': { status: 'DISABLED' },
      'company.storage': { status: 'LIMITED', limit: 100, limitUnit: 'STORAGE_MB' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'individual_pro',
    name: 'Individual Pro',
    targetType: 'individual',
    description: 'Power suite with custom vanity slugs, rich media, unlimited items, AI, and full analytics',
    price: 100,
    currency: 'INR',
    billingCycle: 'yearly',
    isActive: true,
    isPopular: true,
    features: {
      'individual.business_card': { status: 'ENABLED' },
      'individual.full_profile': { status: 'ENABLED' },
      'individual.custom_slug': { status: 'ENABLED' },
      'individual.custom_template': { status: 'ENABLED' },
      'individual.theme': { status: 'ENABLED' },
      'individual.social_links': { status: 'ENABLED' },
      'individual.services': { status: 'UNLIMITED' },
      'individual.portfolio': { status: 'UNLIMITED' },
      'individual.career': { status: 'UNLIMITED' },
      'individual.certifications': { status: 'UNLIMITED' },
      'individual.testimonials': { status: 'UNLIMITED' },
      'individual.analytics': { status: 'ENABLED' },
      'individual.ai_capture': { status: 'ENABLED' },
      'individual.ai_assistance': { status: 'ENABLED' },
      'individual.contact_exchange': { status: 'ENABLED' },
      'individual.vcard': { status: 'ENABLED' },
      'individual.qr_code': { status: 'ENABLED' },
      'company.remove_branding': { status: 'ENABLED' },
      'company.storage': { status: 'LIMITED', limit: 1024, limitUnit: 'STORAGE_MB' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'company_free',
    name: 'Company Free',
    targetType: 'company',
    description: 'Starter corporate package for small teams up to 3 members with public mini-website',
    price: 0,
    currency: 'INR',
    billingCycle: 'free',
    isActive: true,
    features: {
      'company.mini_website': { status: 'ENABLED' },
      'company.custom_slug': { status: 'ENABLED' },
      'company.services': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'company.products': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'company.case_studies': { status: 'LIMITED', limit: 2, limitUnit: 'COUNT' },
      'company.testimonials': { status: 'LIMITED', limit: 2, limitUnit: 'COUNT' },
      'company.team_directory': { status: 'ENABLED' },
      'company.team_members': { status: 'LIMITED', limit: 3, limitUnit: 'EMPLOYEES' },
      'company.lead_capture': { status: 'ENABLED' },
      'company.analytics': { status: 'LIMITED', limit: 50, limitUnit: 'COUNT' },
      'company.company_vcard': { status: 'ENABLED' },
      'company.custom_branding': { status: 'ENABLED' },
      'company.custom_domain': { status: 'DISABLED' },
      'company.remove_branding': { status: 'DISABLED' },
      'company.storage': { status: 'LIMITED', limit: 500, limitUnit: 'STORAGE_MB' },
      'company.ai_assistance': { status: 'DISABLED' },
      // Included employee baseline
      'individual.business_card': { status: 'ENABLED' },
      'individual.full_profile': { status: 'ENABLED' },
      'individual.custom_slug': { status: 'ENABLED' },
      'individual.custom_template': { status: 'ENABLED' },
      'individual.theme': { status: 'ENABLED' },
      'individual.social_links': { status: 'ENABLED' },
      'individual.services': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.portfolio': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.career': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.certifications': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.testimonials': { status: 'LIMITED', limit: 3, limitUnit: 'COUNT' },
      'individual.analytics': { status: 'DISABLED' },
      'individual.ai_capture': { status: 'DISABLED' },
      'individual.ai_assistance': { status: 'DISABLED' },
      'individual.contact_exchange': { status: 'ENABLED' },
      'individual.vcard': { status: 'ENABLED' },
      'individual.qr_code': { status: 'ENABLED' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'company_pro',
    name: 'Company Pro',
    targetType: 'company',
    description: 'Full enterprise suite for scaling companies: 25 seats, 5GB storage, AI, custom domain & white-labeling',
    price: 500,
    currency: 'INR',
    billingCycle: 'yearly',
    isActive: true,
    isPopular: true,
    features: {
      'company.mini_website': { status: 'ENABLED' },
      'company.custom_slug': { status: 'ENABLED' },
      'company.services': { status: 'UNLIMITED' },
      'company.products': { status: 'UNLIMITED' },
      'company.case_studies': { status: 'UNLIMITED' },
      'company.testimonials': { status: 'UNLIMITED' },
      'company.team_directory': { status: 'ENABLED' },
      'company.team_members': { status: 'LIMITED', limit: 25, limitUnit: 'EMPLOYEES' },
      'company.lead_capture': { status: 'ENABLED' },
      'company.analytics': { status: 'ENABLED' },
      'company.company_vcard': { status: 'ENABLED' },
      'company.custom_branding': { status: 'ENABLED' },
      'company.custom_domain': { status: 'ENABLED' },
      'company.remove_branding': { status: 'ENABLED' },
      'company.storage': { status: 'LIMITED', limit: 5120, limitUnit: 'STORAGE_MB' },
      'company.ai_assistance': { status: 'ENABLED' },
      // Included employee baseline
      'individual.business_card': { status: 'ENABLED' },
      'individual.full_profile': { status: 'ENABLED' },
      'individual.custom_slug': { status: 'ENABLED' },
      'individual.custom_template': { status: 'ENABLED' },
      'individual.theme': { status: 'ENABLED' },
      'individual.social_links': { status: 'ENABLED' },
      'individual.services': { status: 'UNLIMITED' },
      'individual.portfolio': { status: 'UNLIMITED' },
      'individual.career': { status: 'UNLIMITED' },
      'individual.certifications': { status: 'UNLIMITED' },
      'individual.testimonials': { status: 'UNLIMITED' },
      'individual.analytics': { status: 'ENABLED' },
      'individual.ai_capture': { status: 'ENABLED' },
      'individual.ai_assistance': { status: 'ENABLED' },
      'individual.contact_exchange': { status: 'ENABLED' },
      'individual.vcard': { status: 'ENABLED' },
      'individual.qr_code': { status: 'ENABLED' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'custom',
    name: 'Custom Enterprise',
    targetType: 'company',
    description: 'Bespoke high-volume enterprise contract with dedicated SLA, 100+ seats, and unlimited quotas',
    price: 2500,
    currency: 'INR',
    billingCycle: 'yearly',
    isActive: true,
    features: {
      'company.mini_website': { status: 'ENABLED' },
      'company.custom_slug': { status: 'ENABLED' },
      'company.services': { status: 'UNLIMITED' },
      'company.products': { status: 'UNLIMITED' },
      'company.case_studies': { status: 'UNLIMITED' },
      'company.testimonials': { status: 'UNLIMITED' },
      'company.team_directory': { status: 'ENABLED' },
      'company.team_members': { status: 'LIMITED', limit: 100, limitUnit: 'EMPLOYEES' },
      'company.lead_capture': { status: 'ENABLED' },
      'company.analytics': { status: 'ENABLED' },
      'company.company_vcard': { status: 'ENABLED' },
      'company.custom_branding': { status: 'ENABLED' },
      'company.custom_domain': { status: 'ENABLED' },
      'company.remove_branding': { status: 'ENABLED' },
      'company.storage': { status: 'LIMITED', limit: 20480, limitUnit: 'STORAGE_MB' },
      'company.ai_assistance': { status: 'ENABLED' },
      // All employee features UNLIMITED
      'individual.business_card': { status: 'ENABLED' },
      'individual.full_profile': { status: 'ENABLED' },
      'individual.custom_slug': { status: 'ENABLED' },
      'individual.custom_template': { status: 'ENABLED' },
      'individual.theme': { status: 'ENABLED' },
      'individual.social_links': { status: 'ENABLED' },
      'individual.services': { status: 'UNLIMITED' },
      'individual.portfolio': { status: 'UNLIMITED' },
      'individual.career': { status: 'UNLIMITED' },
      'individual.certifications': { status: 'UNLIMITED' },
      'individual.testimonials': { status: 'UNLIMITED' },
      'individual.analytics': { status: 'ENABLED' },
      'individual.ai_capture': { status: 'ENABLED' },
      'individual.ai_assistance': { status: 'ENABLED' },
      'individual.contact_exchange': { status: 'ENABLED' },
      'individual.vcard': { status: 'ENABLED' },
      'individual.qr_code': { status: 'ENABLED' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

// ============================================================================
// 3. GLOBAL PLATFORM POLICY
// ============================================================================
export const INITIAL_GLOBAL_POLICY: GlobalPlatformPolicy = {
  id: 'global_default',
  maintenanceMode: false,
  allowSelfRegistration: true,
  defaultIndividualPlanId: 'individual_free',
  defaultCompanyPlanId: 'company_free',
  defaultTrialDays: 14,
  enforceLimitsStrictly: true,
  currency: 'INR',
  currencySymbol: '₹',
  platformName: 'DSBC Platform',
  globalFeatureOverrides: {},
};

// ============================================================================
// 4. SEED AUDIT LOGS & SEED OVERRIDES
// ============================================================================
export const INITIAL_AUDIT_LOGS: EntitlementAuditLog[] = [
  {
    id: 'audit_init_1',
    actorUserId: 'user_app_owner_demo',
    actorName: 'App Owner (Platform Admin)',
    targetType: 'company',
    targetId: 'company_acme',
    targetName: 'Acme Global Corp',
    featureId: 'company.ai_assistance',
    featureName: 'Corporate AI Copywriting & Summary',
    previousValue: 'DISABLED',
    newValue: 'ENABLED (Permanent)',
    reason: 'Complimentary enterprise pilot onboarding grant',
    timestamp: '2026-09-26T09:42:00.000Z',
    source: 'SaaS Control Center',
  },
  {
    id: 'audit_init_2',
    actorUserId: 'user_app_owner_demo',
    actorName: 'App Owner (Platform Admin)',
    targetType: 'company',
    targetId: 'company_acme',
    targetName: 'Acme Global Corp',
    featureId: 'company.team_members',
    featureName: 'Team Member Seats',
    previousValue: '3 EMPLOYEES',
    newValue: '10 EMPLOYEES',
    reason: 'Strategic customer expansion grant',
    timestamp: '2026-09-26T09:43:15.000Z',
    source: 'SaaS Control Center',
  },
  {
    id: 'audit_init_3',
    actorUserId: 'user_app_owner_demo',
    actorName: 'App Owner (Platform Admin)',
    targetType: 'individual',
    targetId: 'emp_rahul_sharma',
    targetName: 'Rahul Sharma',
    featureId: 'individual.ai_assistance',
    featureName: 'AI Bio & Copy Generator',
    previousValue: 'DISABLED',
    newValue: 'ENABLED (Until 31-Dec-2026)',
    reason: 'VIP Keynote Speaker Complimentary Access',
    timestamp: '2026-09-26T09:45:00.000Z',
    source: 'SaaS Control Center',
  },
];

export const INITIAL_OVERRIDES: EntitlementOverride[] = [
  {
    id: 'override_acme_ai',
    targetType: 'company',
    targetId: 'company_acme',
    targetName: 'Acme Global Corp',
    featureId: 'company.ai_assistance',
    rule: { status: 'ENABLED' },
    grantType: 'complimentary',
    validFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    reason: 'Complimentary enterprise pilot onboarding grant',
    createdBy: 'user_app_owner_demo',
    createdAt: '2026-09-26T09:42:00.000Z',
    updatedAt: '2026-09-26T09:42:00.000Z',
  },
  {
    id: 'override_acme_team',
    targetType: 'company',
    targetId: 'company_acme',
    targetName: 'Acme Global Corp',
    featureId: 'company.team_members',
    rule: { status: 'LIMITED', limit: 10, limitUnit: 'EMPLOYEES' },
    grantType: 'permanent',
    validFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    reason: 'Strategic customer expansion grant',
    createdBy: 'user_app_owner_demo',
    createdAt: '2026-09-26T09:43:15.000Z',
    updatedAt: '2026-09-26T09:43:15.000Z',
  },
  {
    id: 'override_rahul_ai',
    targetType: 'individual',
    targetId: 'emp_rahul_sharma',
    targetName: 'Rahul Sharma',
    featureId: 'individual.ai_assistance',
    rule: { status: 'ENABLED' },
    grantType: 'until_date',
    validFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-12-31T23:59:59.000Z',
    reason: 'VIP Keynote Speaker Complimentary Access',
    createdBy: 'user_app_owner_demo',
    createdAt: '2026-09-26T09:45:00.000Z',
    updatedAt: '2026-09-26T09:45:00.000Z',
  },
];

// ============================================================================
// 5. STORAGE & ENGINE IMPLEMENTATION
// ============================================================================
const ENTITLEMENT_STORAGE_KEYS = {
  PLANS: 'dsbc_entitlement_plans_v1',
  OVERRIDES: 'dsbc_entitlement_overrides_v1',
  POLICY: 'dsbc_entitlement_policy_v1',
  AUDIT: 'dsbc_entitlement_audit_v1',
  USAGE: 'dsbc_entitlement_usage_v1',
};

class EntitlementService {
  private plans: Plan[] = [];
  private overrides: EntitlementOverride[] = [];
  private globalPolicy: GlobalPlatformPolicy = INITIAL_GLOBAL_POLICY;
  private auditLogs: EntitlementAuditLog[] = [];
  private usageMetrics: Map<string, UsageMetric> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.hydrate();
  }

  private hydrate(): void {
    if (typeof window === 'undefined') {
      this.plans = [...INITIAL_PLANS];
      this.overrides = [...INITIAL_OVERRIDES];
      this.globalPolicy = { ...INITIAL_GLOBAL_POLICY };
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
      return;
    }

    try {
      // 1. Hydrate Plans
      const savedPlans = localStorage.getItem(ENTITLEMENT_STORAGE_KEYS.PLANS);
      if (savedPlans) {
        this.plans = JSON.parse(savedPlans);
      } else {
        this.plans = [...INITIAL_PLANS];
        this.savePlansToStorage();
      }

      // 2. Hydrate Overrides
      const savedOverrides = localStorage.getItem(ENTITLEMENT_STORAGE_KEYS.OVERRIDES);
      if (savedOverrides) {
        this.overrides = JSON.parse(savedOverrides);
      } else {
        this.overrides = [...INITIAL_OVERRIDES];
        this.saveOverridesToStorage();
      }

      // 3. Hydrate Global Policy
      const savedPolicy = localStorage.getItem(ENTITLEMENT_STORAGE_KEYS.POLICY);
      if (savedPolicy) {
        this.globalPolicy = JSON.parse(savedPolicy);
      } else {
        this.globalPolicy = { ...INITIAL_GLOBAL_POLICY };
        this.savePolicyToStorage();
      }

      // 4. Hydrate Audit Logs
      const savedAudit = localStorage.getItem(ENTITLEMENT_STORAGE_KEYS.AUDIT);
      if (savedAudit) {
        this.auditLogs = JSON.parse(savedAudit);
      } else {
        this.auditLogs = [...INITIAL_AUDIT_LOGS];
        this.saveAuditToStorage();
      }

      // 5. Hydrate Usage Metrics
      const savedUsage = localStorage.getItem(ENTITLEMENT_STORAGE_KEYS.USAGE);
      if (savedUsage) {
        const parsed: UsageMetric[] = JSON.parse(savedUsage);
        parsed.forEach((m) => {
          this.usageMetrics.set(`${m.targetId}_${m.featureId}`, m);
        });
      }
    } catch (err) {
      console.error('Error hydrating entitlement data:', err);
      this.plans = [...INITIAL_PLANS];
      this.overrides = [...INITIAL_OVERRIDES];
      this.globalPolicy = { ...INITIAL_GLOBAL_POLICY };
      this.auditLogs = [...INITIAL_AUDIT_LOGS];
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error in entitlement subscriber:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private savePlansToStorage(): void {
    try {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEYS.PLANS, JSON.stringify(this.plans));
    } catch (err) {
      console.error('Failed to save plans to localStorage', err);
    }
  }

  private saveOverridesToStorage(): void {
    try {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEYS.OVERRIDES, JSON.stringify(this.overrides));
    } catch (err) {
      console.error('Failed to save overrides to localStorage', err);
    }
  }

  private savePolicyToStorage(): void {
    try {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEYS.POLICY, JSON.stringify(this.globalPolicy));
    } catch (err) {
      console.error('Failed to save policy to localStorage', err);
    }
  }

  private saveAuditToStorage(): void {
    try {
      localStorage.setItem(ENTITLEMENT_STORAGE_KEYS.AUDIT, JSON.stringify(this.auditLogs));
    } catch (err) {
      console.error('Failed to save audit logs to localStorage', err);
    }
  }

  private saveUsageToStorage(): void {
    try {
      const arr = Array.from(this.usageMetrics.values());
      localStorage.setItem(ENTITLEMENT_STORAGE_KEYS.USAGE, JSON.stringify(arr));
    } catch (err) {
      console.error('Failed to save usage to localStorage', err);
    }
  }

  // ============================================================================
  // AUTHORITATIVE ENTITLEMENT RESOLUTION HIERARCHY
  // Resolution Order:
  //   GLOBAL PLATFORM POLICY
  //           ↓
  //   PLAN POLICY
  //           ↓
  //   COMPANY OVERRIDE
  //           ↓
  //   INDIVIDUAL USER OVERRIDE
  //           ↓
  //   EFFECTIVE ENTITLEMENT
  // The most specific applicable rule wins.
  // ============================================================================
  public getEffectiveEntitlement(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string
  ): EffectiveEntitlement {
    const featureDef = FEATURE_MAP.get(featureId) || {
      id: featureId,
      name: featureId,
      description: '',
      category: 'individual',
      scope: 'both',
      defaultEntitlement: 'DISABLED',
    };

    const now = new Date().toISOString();

    // 1. Start with Global Platform Default
    let status: EntitlementStatus = featureDef.defaultEntitlement;
    let limit = featureDef.defaultLimit;
    let limitUnit = featureDef.limitUnit;
    let source: EffectiveEntitlement['source'] = 'global_policy';
    let sourceDescription = 'Global Platform Baseline';
    let expiresAt: string | null = null;

    // Check Global Policy Overrides
    if (this.globalPolicy.globalFeatureOverrides[featureId]) {
      const gRule = this.globalPolicy.globalFeatureOverrides[featureId];
      status = gRule.status;
      if (gRule.limit !== undefined) limit = gRule.limit;
      if (gRule.limitUnit !== undefined) limitUnit = gRule.limitUnit;
      source = 'global_policy';
      sourceDescription = 'Global System Policy Override';
    }

    // 2. Apply Plan Policy (if subject has a planId, or determine default by role/type)
    let planId = subject.planId;
    if (!planId) {
      if (subject.companyId) {
        planId = this.globalPolicy.defaultCompanyPlanId || 'company_free';
      } else {
        planId = this.globalPolicy.defaultIndividualPlanId || 'individual_free';
      }
    }

    // Match plan (case-insensitive fallback, support 'starter' -> 'company_free', 'pro' -> 'company_pro')
    let plan = this.plans.find((p) => p.id.toLowerCase() === planId?.toLowerCase());
    if (!plan) {
      if (planId === 'starter') plan = this.plans.find((p) => p.id === 'company_free');
      else if (planId === 'pro') plan = this.plans.find((p) => p.id === 'company_pro');
      else if (planId === 'enterprise') plan = this.plans.find((p) => p.id === 'custom');
    }

    if (plan && plan.features[featureId]) {
      const planRule = plan.features[featureId];
      status = planRule.status;
      if (planRule.limit !== undefined) limit = planRule.limit;
      if (planRule.limitUnit !== undefined) limitUnit = planRule.limitUnit;
      source = 'plan_policy';
      sourceDescription = `Plan: ${plan.name}`;
    }

    // 3. Apply Company Override (if subject belongs to a company)
    if (subject.companyId) {
      const companyOverride = this.overrides.find(
        (o) =>
          o.targetType === 'company' &&
          o.targetId === subject.companyId &&
          o.featureId === featureId
      );

      if (companyOverride) {
        const isExpired =
          companyOverride.expiresAt && companyOverride.expiresAt < now;
        if (!isExpired) {
          status = companyOverride.rule.status;
          if (companyOverride.rule.limit !== undefined) limit = companyOverride.rule.limit;
          if (companyOverride.rule.limitUnit !== undefined) limitUnit = companyOverride.rule.limitUnit;
          source = 'company_override';
          sourceDescription = `Company Override (${companyOverride.grantType}${
            companyOverride.expiresAt ? ` until ${new Date(companyOverride.expiresAt).toLocaleDateString()}` : ''
          })`;
          expiresAt = companyOverride.expiresAt || null;
        }
      }
    }

    // 4. Apply Individual User Override (if subject has a specific userId/employeeId)
    if (subject.userId) {
      const individualOverride = this.overrides.find(
        (o) =>
          o.targetType === 'individual' &&
          o.targetId === subject.userId &&
          o.featureId === featureId
      );

      if (individualOverride) {
        const isExpired =
          individualOverride.expiresAt && individualOverride.expiresAt < now;
        if (!isExpired) {
          status = individualOverride.rule.status;
          if (individualOverride.rule.limit !== undefined) limit = individualOverride.rule.limit;
          if (individualOverride.rule.limitUnit !== undefined) limitUnit = individualOverride.rule.limitUnit;
          source = 'individual_override';
          sourceDescription = `Individual Override (${individualOverride.grantType}${
            individualOverride.expiresAt ? ` until ${new Date(individualOverride.expiresAt).toLocaleDateString()}` : ''
          })`;
          expiresAt = individualOverride.expiresAt || null;
        }
      }
    }

    // 5. Evaluate Feature Dependencies
    const dependencies = FEATURE_DEPENDENCIES[featureId];
    if (dependencies && dependencies.length > 0) {
      for (const depId of dependencies) {
        // Evaluate parent dependency without recursion cycle
        const parentEff = this.getEffectiveEntitlement(
          { ...subject, planId: subject.planId },
          depId
        );
        if (!parentEff.isGranted) {
          status = 'DISABLED';
          sourceDescription = `Prerequisite Missing (${depId} disabled)`;
          break;
        }
      }
    }

    // Calculate usage & remaining for limited features
    const targetKey = subject.userId || subject.companyId || 'anon';
    const usageMetric = this.usageMetrics.get(`${targetKey}_${featureId}`);
    const used = usageMetric ? usageMetric.currentValue : 0;
    const remaining = limit !== undefined ? Math.max(0, limit - used) : undefined;

    // Is granted logic
    const isGranted =
      status === 'ENABLED' ||
      status === 'UNLIMITED' ||
      (status === 'LIMITED' && (limit === undefined || (remaining !== undefined && remaining > 0)));

    return {
      featureId,
      featureName: featureDef.name,
      status,
      isGranted,
      limit,
      limitUnit,
      used,
      remaining,
      source,
      sourceDescription,
      expiresAt,
      isExpired: expiresAt ? expiresAt < now : false,
    };
  }

  // ============================================================================
  // CONVENIENCE ENTITLEMENT CHECKERS
  // ============================================================================
  public can(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string
  ): boolean {
    // App Owner bypasses feature restrictions for system operations
    if (subject.role === 'app_owner') return true;

    const eff = this.getEffectiveEntitlement(subject, featureId);
    return eff.isGranted;
  }

  public getEntitlement(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string
  ): EffectiveEntitlement {
    return this.getEffectiveEntitlement(subject, featureId);
  }

  public getLimit(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string
  ): { limit: number; unit?: LimitUnit; isUnlimited: boolean } {
    const eff = this.getEffectiveEntitlement(subject, featureId);
    if (eff.status === 'UNLIMITED') {
      return { limit: Infinity, unit: eff.limitUnit, isUnlimited: true };
    }
    return {
      limit: eff.limit ?? 0,
      unit: eff.limitUnit,
      isUnlimited: false,
    };
  }

  public getUsage(
    subject: { userId?: string | null; companyId?: string | null },
    featureId: string
  ): { current: number; limit?: number; unit?: LimitUnit; remaining?: number } {
    const targetKey = subject.userId || subject.companyId || 'anon';
    const eff = this.getEffectiveEntitlement(subject, featureId);
    const metric = this.usageMetrics.get(`${targetKey}_${featureId}`);
    const current = metric ? metric.currentValue : 0;
    const remaining = eff.limit !== undefined ? Math.max(0, eff.limit - current) : undefined;
    return {
      current,
      limit: eff.limit,
      unit: eff.limitUnit,
      remaining,
    };
  }

  public checkLimit(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string,
    requestedAmount = 1
  ): boolean {
    if (subject.role === 'app_owner') return true;
    const eff = this.getEffectiveEntitlement(subject, featureId);
    if (eff.status === 'DISABLED') return false;
    if (eff.status === 'ENABLED' || eff.status === 'UNLIMITED') return true;
    if (eff.status === 'LIMITED') {
      if (eff.limit === undefined) return true;
      const targetKey = subject.userId || subject.companyId || 'anon';
      const metric = this.usageMetrics.get(`${targetKey}_${featureId}`);
      const current = metric ? metric.currentValue : 0;
      return current + requestedAmount <= eff.limit;
    }
    return false;
  }

  public isFeatureLocked(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    featureId: string
  ): { isLocked: boolean; reason: string; upgradePlanId?: string } {
    if (subject.role === 'app_owner') return { isLocked: false, reason: '' };
    const eff = this.getEffectiveEntitlement(subject, featureId);

    if (eff.status === 'DISABLED') {
      const upgradePlan = subject.companyId ? 'company_pro' : 'individual_pro';
      return {
        isLocked: true,
        reason: `Feature is not available on ${eff.sourceDescription}.`,
        upgradePlanId: upgradePlan,
      };
    }

    if (eff.status === 'LIMITED' && eff.remaining !== undefined && eff.remaining <= 0) {
      return {
        isLocked: true,
        reason: `Quota limit reached (${eff.used}/${eff.limit} ${eff.limitUnit || ''}).`,
        upgradePlanId: subject.companyId ? 'company_pro' : 'individual_pro',
      };
    }

    return { isLocked: false, reason: '' };
  }

  public getAllEffectiveEntitlements(subject: {
    userId?: string | null;
    companyId?: string | null;
    role?: UserRole | string | null;
    planId?: string | null;
  }): Record<string, EffectiveEntitlement> {
    const result: Record<string, EffectiveEntitlement> = {};
    FEATURE_CATALOGUE.forEach((f) => {
      result[f.id] = this.getEffectiveEntitlement(subject, f.id);
    });
    return result;
  }

  // ============================================================================
  // APP OWNER MANAGEMENT & SAAS CONTROL CENTER APIS
  // ============================================================================
  private checkActorAuthorization(actorInfo?: { id: string; name: string; role?: string }): void {
    if (actorInfo?.role && actorInfo.role !== 'app_owner') {
      throw new Error('ACCESS_DENIED: Only App Owner can perform plan/entitlement administrative mutations');
    }
  }

  public getPlans(): Plan[] {
    return [...this.plans];
  }

  public getPlanById(id: string): Plan | undefined {
    return this.plans.find((p) => p.id === id);
  }

  public savePlan(
    plan: Omit<Plan, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
    actorInfo?: { id: string; name: string; role?: string }
  ): void {
    this.checkActorAuthorization(actorInfo);
    const idx = this.plans.findIndex((p) => p.id === plan.id);
    const prev = idx >= 0 ? this.plans[idx] : null;

    if (idx >= 0) {
      this.plans[idx] = {
        ...plan,
        createdAt: plan.createdAt || prev.createdAt,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.plans.push({
        ...plan,
        createdAt: plan.createdAt || new Date().toISOString(),
        updatedAt: plan.updatedAt || new Date().toISOString(),
      });
    }
    this.savePlansToStorage();

    // Audit
    this.recordAudit({
      actorUserId: actorInfo?.id || 'app_owner',
      actorName: actorInfo?.name || 'Platform Admin',
      targetType: 'plan',
      targetId: plan.id,
      targetName: plan.name,
      previousValue: prev ? JSON.stringify(prev.features) : 'NEW PLAN',
      newValue: JSON.stringify(plan.features),
      reason: prev ? `Plan ${plan.name} updated` : `New plan ${plan.name} created`,
      timestamp: new Date().toISOString(),
      source: 'SaaS Control Center',
    });

    this.notify();
  }

  public deletePlan(id: string, actorInfo?: { id: string; name: string; role?: string }): boolean {
    this.checkActorAuthorization(actorInfo);
    const target = this.plans.find((p) => p.id === id);
    if (!target) return false;
    this.plans = this.plans.filter((p) => p.id !== id);
    this.savePlansToStorage();

    this.recordAudit({
      actorUserId: actorInfo?.id || 'app_owner',
      actorName: actorInfo?.name || 'Platform Admin',
      targetType: 'plan',
      targetId: id,
      targetName: target.name,
      previousValue: target.name,
      newValue: 'DELETED',
      reason: `Plan ${target.name} deactivated/deleted`,
      timestamp: new Date().toISOString(),
      source: 'SaaS Control Center',
    });

    this.notify();
    return true;
  }

  public duplicatePlan(id: string, actorInfo?: { id: string; name: string; role?: string }): Plan | null {
    this.checkActorAuthorization(actorInfo);
    const src = this.getPlanById(id);
    if (!src) return null;

    const newId = `${src.id}_copy_${Date.now()}`;
    const newPlan: Plan = {
      ...src,
      id: newId,
      name: `${src.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.savePlan(newPlan, actorInfo);
    return newPlan;
  }

  // Feature Catalogue Management
  public getFeatures(): FeatureDefinition[] {
    return [...FEATURE_CATALOGUE];
  }

  public getFeatureById(id: string): FeatureDefinition | undefined {
    return FEATURE_MAP.get(id);
  }

  // Overrides Management
  public getOverrides(filter?: {
    targetType?: 'individual' | 'company';
    targetId?: string;
  }): EntitlementOverride[] {
    if (!filter) return [...this.overrides];
    return this.overrides.filter((o) => {
      if (filter.targetType && o.targetType !== filter.targetType) return false;
      if (filter.targetId && o.targetId !== filter.targetId) return false;
      return true;
    });
  }

  public saveOverride(
    override: Omit<
      EntitlementOverride,
      'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'validFrom'
    > & {
      id?: string;
      createdBy?: string;
      validFrom?: string;
    },
    actorInfo?: { id: string; name: string; role?: string }
  ): EntitlementOverride {
    this.checkActorAuthorization(actorInfo);
    const existingIndex = this.overrides.findIndex(
      (o) =>
        (override.id && o.id === override.id) ||
        (o.targetType === override.targetType &&
          o.targetId === override.targetId &&
          o.featureId === override.featureId)
    );

    const prev = existingIndex >= 0 ? this.overrides[existingIndex] : null;
    const now = new Date().toISOString();

    const finalOverride: EntitlementOverride = {
      id: override.id || prev?.id || `override_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      targetType: override.targetType,
      targetId: override.targetId,
      targetName: override.targetName || prev?.targetName || override.targetId,
      featureId: override.featureId,
      rule: override.rule,
      grantType: override.grantType,
      validFrom: override.validFrom || now,
      expiresAt: override.expiresAt ?? null,
      reason: override.reason,
      createdBy: actorInfo?.id || 'app_owner',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      this.overrides[existingIndex] = finalOverride;
    } else {
      this.overrides.push(finalOverride);
    }

    this.saveOverridesToStorage();

    const featName = FEATURE_MAP.get(override.featureId)?.name || override.featureId;
    this.recordAudit({
      actorUserId: actorInfo?.id || 'app_owner',
      actorName: actorInfo?.name || 'Platform Admin',
      targetType: override.targetType,
      targetId: override.targetId,
      targetName: finalOverride.targetName || override.targetId,
      featureId: override.featureId,
      featureName: featName,
      previousValue: prev
        ? `${prev.rule.status} (${prev.grantType}${prev.expiresAt ? ` until ${prev.expiresAt}` : ''})`
        : 'NONE (Follows Plan)',
      newValue: `${override.rule.status} (${override.grantType}${
        override.expiresAt ? ` until ${override.expiresAt}` : ''
      })`,
      reason: override.reason || 'App Owner manual override configuration',
      timestamp: now,
      source: 'SaaS Control Center',
    });

    this.notify();
    return finalOverride;
  }

  public deleteOverride(id: string, actorInfo?: { id: string; name: string; role?: string }): boolean {
    this.checkActorAuthorization(actorInfo);
    const target = this.overrides.find((o) => o.id === id);
    if (!target) return false;

    this.overrides = this.overrides.filter((o) => o.id !== id);
    this.saveOverridesToStorage();

    const featName = FEATURE_MAP.get(target.featureId)?.name || target.featureId;
    this.recordAudit({
      actorUserId: actorInfo?.id || 'app_owner',
      actorName: actorInfo?.name || 'Platform Admin',
      targetType: target.targetType,
      targetId: target.targetId,
      targetName: target.targetName || target.targetId,
      featureId: target.featureId,
      featureName: featName,
      previousValue: `${target.rule.status} (${target.grantType})`,
      newValue: 'REMOVED (Reverted to Plan)',
      reason: 'App Owner removed override exception',
      timestamp: new Date().toISOString(),
      source: 'SaaS Control Center',
    });

    this.notify();
    return true;
  }

  // Global Platform Policy Management
  public getGlobalPolicy(): GlobalPlatformPolicy {
    return { ...this.globalPolicy };
  }

  public updateGlobalPolicy(
    updates: Partial<GlobalPlatformPolicy>,
    actorInfo?: { id: string; name: string; role?: string }
  ): GlobalPlatformPolicy {
    this.checkActorAuthorization(actorInfo);
    const prev = { ...this.globalPolicy };
    this.globalPolicy = { ...this.globalPolicy, ...updates };
    this.savePolicyToStorage();

    this.recordAudit({
      actorUserId: actorInfo?.id || 'app_owner',
      actorName: actorInfo?.name || 'Platform Admin',
      targetType: 'global',
      targetId: 'global_policy',
      targetName: 'Global Platform Policy',
      previousValue: JSON.stringify(prev),
      newValue: JSON.stringify(this.globalPolicy),
      reason: 'Global platform settings updated',
      timestamp: new Date().toISOString(),
      source: 'SaaS Control Center',
    });

    this.notify();
    return { ...this.globalPolicy };
  }

  // Audit Logs
  public getAuditLogs(limitCount = 100): EntitlementAuditLog[] {
    return [...this.auditLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  }

  public recordAudit(log: Omit<EntitlementAuditLog, 'id'>): EntitlementAuditLog {
    const fullLog: EntitlementAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...log,
    };
    this.auditLogs.unshift(fullLog);
    // Keep max 500 logs
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAuditToStorage();
    return fullLog;
  }

  // Usage Metrics Management
  public recordUsage(
    targetId: string,
    targetType: 'individual' | 'company',
    featureId: string,
    amount: number,
    unit?: LimitUnit
  ): void {
    const key = `${targetId}_${featureId}`;
    const feat = FEATURE_MAP.get(featureId);
    const resolvedUnit = unit || feat?.limitUnit || 'COUNT';

    this.usageMetrics.set(key, {
      targetId,
      targetType,
      featureId,
      currentValue: amount,
      unit: resolvedUnit,
      updatedAt: new Date().toISOString(),
    });

    this.saveUsageToStorage();
    this.notify();
  }

  public getPlan(id: string): Plan | undefined {
    return this.plans.find((p) => p.id.toLowerCase() === id.toLowerCase());
  }

  public getAuditTrail(): EntitlementAuditLog[] {
    return [...this.auditLogs];
  }

  public getEffectiveQuota(
    subject: {
      userId?: string | null;
      companyId?: string | null;
      role?: UserRole | string | null;
      planId?: string | null;
    },
    quotaKey: string
  ): { limit: number | 'UNLIMITED'; used: number; remaining: number } {
    let featureKey = quotaKey;
    if (quotaKey === 'team_members_limit' || quotaKey === 'team_members') {
      featureKey = 'company.team_members';
    } else if (quotaKey === 'services_limit' || quotaKey === 'services') {
      featureKey = subject.companyId ? 'company.services' : 'individual.services';
    } else if (quotaKey === 'products_limit' || quotaKey === 'products') {
      featureKey = 'company.products';
    }

    const eff = this.getEffectiveEntitlement(subject, featureKey);
    const limit = eff.status === 'UNLIMITED' ? 'UNLIMITED' : eff.limit ?? 3;
    const targetId = subject.companyId || subject.userId || 'default_subject';
    const used = this.usageMetrics.get(`${targetId}_${featureKey}`)?.currentValue || 0;
    const remaining = limit === 'UNLIMITED' ? Infinity : Math.max(0, limit - used);

    return { limit, used, remaining };
  }

  public incrementUsage(
    targetId: string,
    targetType: 'individual' | 'company',
    featureId: string,
    delta = 1,
    unit?: LimitUnit
  ): number {
    const key = `${targetId}_${featureId}`;
    const cur = this.usageMetrics.get(key)?.currentValue || 0;
    const newVal = Math.max(0, cur + delta);
    this.recordUsage(targetId, targetType, featureId, newVal, unit);
    return newVal;
  }
}

// Singleton Instance Export
export const entitlementService = new EntitlementService();
