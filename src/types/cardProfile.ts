// ----------------------------------------------------------------------
// DSBC Digital Identity Card & Template Framework Domain Types
// ----------------------------------------------------------------------

import { Employee, Company, Department, Card, AppearanceConfig } from './index';

export type CardSectionType =
  | 'CORE_IDENTITY'
  | 'ABOUT'
  | 'CONTACT'
  | 'SOCIAL_PROFESSIONAL'
  | 'EXPERTISE'
  | 'EXPERIENCE'
  | 'SERVICES'
  | 'PORTFOLIO'
  | 'CREDENTIALS'
  | 'EDUCATION'
  | 'ACHIEVEMENTS'
  | 'TESTIMONIALS'
  | 'COMPANY'
  | 'CONVERSION';

export type CardSectionVisibility = 'PUBLIC' | 'PRIVATE' | 'COMPANY_ONLY' | 'DISABLED';

export interface CardSectionConfig {
  id: string;
  type: CardSectionType;
  title?: string;
  enabled: boolean;
  order: number;
  visibility: CardSectionVisibility;
  configuration?: Record<string, any>;
}

export interface ProfileMetric {
  label: string;
  value: string;
}

export interface SkillCategory {
  categoryName: string;
  skills: string[];
}

export interface ExperienceItem {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate?: string; // 'Present' or ISO date
  isCurrent?: boolean;
  location?: string;
  description: string;
  achievements?: string[];
  technologies?: string[];
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  deliveryMode?: 'Consulting' | 'Advisory' | 'Retainer' | 'Workshop' | 'Turnkey' | 'Project' | string;
  startingPrice?: string;
  ctaLabel?: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  role?: string;
  organizationOrClient?: string;
  technologies?: string[];
  outcome?: string;
  imageUrl?: string;
  projectUrl?: string;
}

export interface EducationItem {
  id: string;
  institution: string;
  qualification: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface CertificationItem {
  id?: string;
  title: string;
  issuer?: string;
  year?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuerOrEvent?: string;
  year?: string;
  description?: string;
  linkUrl?: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  personName: string;
  designation: string;
  company?: string;
  photoUrl?: string;
  source?: string;
}

export interface DigitalIdentityProfile {
  id: string; // matches employeeId or individual identity id
  employeeId?: string;
  companyId?: string;
  individualId?: string;
  headline?: string;
  about?: string;
  philosophy?: string;
  location?: string;
  heroImageUrl?: string;
  metrics?: ProfileMetric[];
  expertise?: string[];
  skillCategories?: SkillCategory[];
  services?: ServiceItem[] | string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  education?: EducationItem[];
  credentials?: CertificationItem[];
  achievements?: AchievementItem[];
  testimonials?: TestimonialItem[];
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
    medium?: string;
    portfolio?: string;
  };
  sectionConfigs?: CardSectionConfig[];
  fullProfileSections?: Array<{
    id: string;
    title: string;
    type: string;
    content: any;
    enabled: boolean;
  }>;
  companyProfileRef?: {
    companyId?: string;
    enabled?: boolean;
  };
  appearance?: AppearanceConfig;
  updatedAt: string;
}

export interface ResolvedCardProfile {
  // Authoritative Core Identity
  employeeId: string;
  individualId?: string;
  displayName: string;
  firstName: string;
  lastName: string;
  designation: string;
  profilePhotoUrl?: string;
  headline?: string;
  about?: string;
  philosophy?: string;
  location?: string;
  heroImageUrl?: string;
  appearance: AppearanceConfig;

  // Company Association (Optional)
  hasCompanyAssociation: boolean;
  companyId?: string;
  companyName: string;
  /** The company's own tagline (empty when the company has none). */
  companyTagline?: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyDescription?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  showCompanyAddress: boolean;

  // Department
  departmentName?: string;

  // Contact Points
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;

  // Professional Enrichment & Metrics
  metrics: ProfileMetric[];
  expertise: string[];
  skillCategories: SkillCategory[];
  services: ServiceItem[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  credentials: CertificationItem[];
  achievements: AchievementItem[];
  testimonials: TestimonialItem[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
    medium?: string;
    portfolio?: string;
  };

  // Section Ordering & Enabled States
  enabledSections: CardSectionType[];
}

export interface TemplateDefinition {
  templateId: 'classic' | 'modern' | 'minimal';
  name: string;
  description: string;
  version: string;
  supportedSections: CardSectionType[];
  status: 'active' | 'deprecated';
}

export const TEMPLATE_REGISTRY: Record<string, TemplateDefinition> = {
  classic: {
    templateId: 'classic',
    name: 'Executive Classic',
    description: 'Refined corporate presentation featuring a brand header banner, centered avatar, prominent designation, and structured contact hierarchy.',
    version: '2.2.0',
    supportedSections: [
      'CORE_IDENTITY',
      'ABOUT',
      'CONTACT',
      'SOCIAL_PROFESSIONAL',
      'EXPERTISE',
      'EXPERIENCE',
      'SERVICES',
      'PORTFOLIO',
      'CREDENTIALS',
      'EDUCATION',
      'ACHIEVEMENTS',
      'TESTIMONIALS',
      'COMPANY',
      'CONVERSION',
    ],
    status: 'active',
  },
  modern: {
    templateId: 'modern',
    name: 'Dynamic Modern',
    description: 'High-impact geometric layout with gradient hero banner, floating profile badge, and badge-style expertise chips.',
    version: '2.2.0',
    supportedSections: [
      'CORE_IDENTITY',
      'ABOUT',
      'CONTACT',
      'SOCIAL_PROFESSIONAL',
      'EXPERTISE',
      'EXPERIENCE',
      'SERVICES',
      'PORTFOLIO',
      'CREDENTIALS',
      'EDUCATION',
      'ACHIEVEMENTS',
      'TESTIMONIALS',
      'COMPANY',
      'CONVERSION',
    ],
    status: 'active',
  },
  minimal: {
    templateId: 'minimal',
    name: 'Editorial Minimal',
    description: 'Monochrome typographic aesthetic inspired by Swiss graphic design with generous white space and clean typography.',
    version: '2.2.0',
    supportedSections: [
      'CORE_IDENTITY',
      'ABOUT',
      'CONTACT',
      'SOCIAL_PROFESSIONAL',
      'EXPERTISE',
      'EXPERIENCE',
      'SERVICES',
      'PORTFOLIO',
      'CREDENTIALS',
      'EDUCATION',
      'ACHIEVEMENTS',
      'TESTIMONIALS',
      'COMPANY',
      'CONVERSION',
    ],
    status: 'active',
  },
};

export const PROFILE_SECTION_REGISTRY: Array<{
  type: CardSectionType;
  label: string;
  description: string;
  order: number;
}> = [
  { type: 'CORE_IDENTITY', label: 'Profile Header', description: 'Photo, name, title, headline, and primary CTAs', order: 1 },
  { type: 'ABOUT', label: 'About & Background', description: 'Professional biography, philosophy, and summary', order: 2 },
  { type: 'EXPERTISE', label: 'Expertise & Capabilities', description: 'Categorized technical and domain competencies', order: 3 },
  { type: 'EXPERIENCE', label: 'Career Timeline', description: 'Professional career history and achievements', order: 4 },
  { type: 'SERVICES', label: 'Services & Advisory', description: 'Offered consulting and delivery solutions', order: 5 },
  { type: 'PORTFOLIO', label: 'Projects & Case Studies', description: 'Key delivered projects and outcomes', order: 6 },
  { type: 'CREDENTIALS', label: 'Certifications & Licenses', description: 'Verified credentials and accreditations', order: 7 },
  { type: 'EDUCATION', label: 'Education & Training', description: 'Degrees, institutions, and academic history', order: 8 },
  { type: 'ACHIEVEMENTS', label: 'Awards & Recognition', description: 'Industry honors, publications, and speaking', order: 9 },
  { type: 'TESTIMONIALS', label: 'Endorsements & Testimonials', description: 'Professional references and peer reviews', order: 10 },
  { type: 'SOCIAL_PROFESSIONAL', label: 'Professional Links', description: 'External verified profiles and channels', order: 11 },
  { type: 'CONTACT', label: 'Contact & Connect', description: 'Direct contact coordinates and exchange trigger', order: 12 },
  { type: 'COMPANY', label: 'Company Overview', description: 'Associated corporate tenant details (if affiliated)', order: 13 },
];

