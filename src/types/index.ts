export type UserRole = 'app_owner' | 'company_admin' | 'employee';
export type UserStatus = 'active' | 'suspended';
export type CompanyStatus = 'active' | 'suspended';
export type DepartmentStatus = 'active' | 'inactive';
export type EmployeeStatus = 'active' | 'inactive';
export type CardStatus = 'active' | 'inactive';

export interface UserProfile {
  id: string; // Firebase Auth UID
  email: string;
  displayName: string;
  role: UserRole;
  companyId: string | null;
  employeeId: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface AppearanceConfig {
  mode: AppearanceMode;
}

export interface CompanyBranding {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  cardThemePreference?: 'classic' | 'modern' | 'minimal';
  showCompanyAddress?: boolean;
  appearance?: AppearanceConfig;
}

export interface Company {
  id: string;
  name: string;
  legalName: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  positioningStatement?: string;
  industry?: string;
  foundedYear?: string;
  website: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address: string;
  operatingHours?: string;
  description: string;
  mission?: string;
  vision?: string;
  coreValues?: Array<{ title: string; description: string; icon?: string }>;
  services?: Array<{
    id: string;
    title: string;
    description: string;
    deliverables?: string[];
    deliveryMode?: string;
    startingPrice?: string;
    ctaLabel?: string;
    category?: string;
  }>;
  products?: Array<{
    id: string;
    title: string;
    category?: string;
    description: string;
    features?: string[];
    imageUrl?: string;
    badge?: string;
    actionLabel?: string;
  }>;
  metrics?: Array<{ label: string; value: string; description?: string }>;
  caseStudies?: Array<{
    id: string;
    title: string;
    client?: string;
    industry?: string;
    challenge?: string;
    solution?: string;
    outcome?: string;
    tags?: string[];
  }>;
  testimonials?: Array<{
    id: string;
    quote: string;
    clientName: string;
    designation: string;
    companyName: string;
    avatarUrl?: string;
    rating?: number;
  }>;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    youtube?: string;
    instagram?: string;
    website?: string;
  };
  branding: CompanyBranding;
  status: CompanyStatus;
  planId: string; // e.g. 'starter', 'pro', 'enterprise'
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string;
  departmentHeadEmployeeId?: string | null;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSocialLinks {
  twitter?: string;
  github?: string;
  youtube?: string;
  facebook?: string;
  telegram?: string;
  medium?: string;
  portfolio?: string;
}

export interface Employee {
  id: string;
  companyId: string;
  departmentId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  designation: string;
  profilePhotoUrl?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  bio?: string;
  linkedin?: string;
  website?: string;
  instagram?: string;
  cardSlug?: string;
  customSlug?: string;
  socialLinks?: Record<string, string>;
  otherSocialLinks?: EmployeeSocialLinks;
  cardId?: string;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  companyId: string;
  employeeId: string;
  templateId: 'classic' | 'modern' | 'minimal';
  publicSlug: string;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  previewImageUrl?: string;
  configuration: {
    layout: 'classic' | 'modern' | 'minimal';
    badgeStyle: 'rounded' | 'square' | 'pill';
    headerStyle: 'solid' | 'gradient' | 'minimal';
  };
  status: 'active' | 'retired';
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsEventType =
  | 'card_view'
  | 'phone_click'
  | 'whatsapp_click'
  | 'email_click'
  | 'linkedin_click'
  | 'website_click'
  | 'save_contact'
  | 'share';

export interface AnalyticsEvent {
  id?: string;
  companyId: string;
  employeeId: string;
  cardId: string;
  eventType: AnalyticsEventType;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type SecurityTestStatus = 'PASS' | 'FAIL' | 'NOT RUN' | 'ERROR';

export interface SecurityTestResult {
  id: string;
  title: string;
  description: string;
  expectedOutcome: 'ALLOWED' | 'DENIED';
  actualOutcome: 'ALLOWED' | 'DENIED' | 'PENDING' | 'ERROR';
  status: SecurityTestStatus;
  passed: boolean;
  details?: string;
  executionType?: 'LIVE_FIRESTORE_SDK' | 'SIMULATED';
}

// ==========================================
// DSBC V2.0 CONNECT FOUNDATION DATA MODELS
// ==========================================

export type ConnectionStatus =
  | 'none'
  | 'requested'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'revoked'
  | 'blocked';

export type ExchangeMethod = 'qr_scan' | 'direct_link' | 'card_exchange' | 'manual';

export type ConsentState =
  | 'none'
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'revoked'
  | 'blocked';

export type SharedInfoCategory =
  | 'profile'
  | 'company'
  | 'job_title'
  | 'phone'
  | 'email'
  | 'website';

export type ContactSourceType = 'dsbc_card' | 'manual' | 'qr_scan';

export type RelationshipPriority = 'low' | 'medium' | 'high';

export type RelationshipStatus =
  | 'lead'
  | 'prospect'
  | 'partner'
  | 'colleague'
  | 'client'
  | 'vendor'
  | 'other';

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';

export type ConnectionEventType =
  | 'CARD_SHARED'
  | 'CONNECTION_REQUESTED'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_DECLINED'
  | 'CONNECTION_REVOKED'
  | 'CONTACT_CREATED'
  | 'NOTE_ADDED'
  | 'FOLLOW_UP_CREATED'
  | 'FOLLOW_UP_COMPLETED'
  | 'FOLLOW_UP_CANCELLED';

export interface Contact {
  id: string;
  ownerUserId: string; // Authenticated user who saved this personal contact
  sourceType: ContactSourceType;
  linkedIdentityId?: string | null; // e.g. employeeId or userId if DSBC user
  linkedCardId?: string | null;
  displayName: string;
  companyName?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  website?: string;
  notesSummary?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface Connection {
  id: string;
  connectionVersion: 'v2.0';
  requesterUserId: string;
  recipientUserId?: string | null;
  requesterIdentityId: string;
  recipientIdentityId: string;
  requesterName: string;
  requesterCompany?: string;
  requesterTitle?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterPhotoUrl?: string;
  requesterCompanyId?: string | null;
  recipientCompanyId: string;
  status: ConnectionStatus;
  initiatedBy: string; // userId
  exchangeMethod: ExchangeMethod;
  consentState: ConsentState;
  sharedCategories: SharedInfoCategory[];
  relationshipStatus?: RelationshipStatus;
  relationshipPriority?: RelationshipPriority;
  initialNote?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  revokedAt?: string | null;
  lastInteractionAt: string;
}

export interface RelationshipNote {
  id: string;
  ownerUserId: string; // Private to the note creator
  connectionId?: string | null;
  contactId?: string | null;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  ownerUserId: string;
  connectionId?: string | null;
  contactId?: string | null;
  targetName: string;
  title: string;
  dueAt: string; // ISO date format YYYY-MM-DD
  status: FollowUpStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface ConnectionEvent {
  id: string;
  connectionId: string;
  ownerUserId?: string | null;
  participantUserIds: string[];
  eventType: ConnectionEventType;
  actorUserId: string;
  actorName: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ==========================================
// DSBC V2.1 EVENTS, CAMPAIGNS & LEADS TYPES
// ==========================================

export type EventStatus = 'draft' | 'active' | 'completed' | 'archived';

export type EventType =
  | 'tradeshow'
  | 'conference'
  | 'exhibition'
  | 'seminar'
  | 'networking'
  | 'sales_meeting'
  | 'recruitment'
  | 'customer_event'
  | 'other';

export interface Event {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  eventType: EventType;
  location?: string;
  startAt: string; // ISO date format YYYY-MM-DD
  endAt: string; // ISO date format YYYY-MM-DD
  status: EventStatus;
  createdBy: string; // userId
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export type EventMemberRole = 'lead' | 'member' | 'staff';

export interface EventMember {
  id: string;
  eventId: string;
  companyId: string;
  employeeId: string;
  userId: string;
  employeeName: string;
  role: EventMemberRole;
  joinedAt: string;
  removedAt?: string | null;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type CampaignType =
  | 'booth_qr'
  | 'brochure_qr'
  | 'linkedin'
  | 'outreach'
  | 'conference_reg'
  | 'partner_referral'
  | 'other';

export interface Campaign {
  id: string;
  companyId: string;
  eventId?: string | null;
  name: string;
  description?: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  targetPublicSlug?: string | null;
  startAt?: string;
  endAt?: string;
  createdBy: string; // userId
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export type LeadQualificationStatus =
  | 'unqualified'
  | 'qualifying'
  | 'qualified'
  | 'disqualified';

export type LeadStatus =
  | 'new'
  | 'qualifying'
  | 'qualified'
  | 'nurture'
  | 'disqualified'
  | 'converted'
  | 'archived';

export type LeadPriority = 'low' | 'medium' | 'high' | 'critical';

export type LeadSourceType =
  | 'EVENT'
  | 'CAMPAIGN'
  | 'CARD_QR'
  | 'DIRECT_SHARE'
  | 'MANUAL'
  | 'OTHER';

export interface Lead {
  id: string;
  companyId: string;
  sourceConnectionId?: string | null;
  sourceContactId?: string | null;
  eventId?: string | null;
  campaignId?: string | null;
  ownerEmployeeId: string;
  ownerUserId: string;
  ownerName?: string;
  createdBy: string; // userId
  name: string;
  companyName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  qualificationStatus: LeadQualificationStatus;
  leadStatus: LeadStatus;
  priority: LeadPriority;
  sourceType: LeadSourceType;
  sourceReference?: string;
  qualificationNotes?: string;
  notesSummary?: string;
  createdAt: string;
  updatedAt: string;
  qualifiedAt?: string | null;
  convertedAt?: string | null;
  archivedAt?: string | null;
}

export interface CompanyLeadNote {
  id: string;
  companyId: string;
  leadId: string;
  authorUserId: string;
  authorEmployeeId?: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadEventType =
  | 'LEAD_CREATED'
  | 'LEAD_UPDATED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_QUALIFIED'
  | 'LEAD_DISQUALIFIED'
  | 'LEAD_CONVERTED'
  | 'LEAD_ARCHIVED'
  | 'FOLLOW_UP_CREATED';

export interface LeadEvent {
  id: string;
  companyId: string;
  leadId: string;
  eventType: LeadEventType;
  actorUserId: string;
  actorName: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface EventAnalyticsSummary {
  eventId: string;
  eventName: string;
  interactionsCount: number;
  cardViewsCount: number;
  connectionsCount: number;
  acceptedConnectionsCount: number;
  contactsCount: number;
  leadsCount: number;
  qualifiedLeadsCount: number;
  followUpsCount: number;
  followUpsCompletedCount: number;
}

export interface CampaignAnalyticsSummary {
  campaignId: string;
  campaignName: string;
  interactionsCount: number;
  connectionsCount: number;
  acceptanceRate: number;
  contactsCount: number;
  leadsCount: number;
  qualifiedLeadsCount: number;
  conversionRate: number;
  followUpsCount: number;
}

export * from './entitlement';


