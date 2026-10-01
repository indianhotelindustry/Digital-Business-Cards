// ----------------------------------------------------------------------
// DSBC Digital Business Identity Platform - Company Profile Mini-Website Types
// ----------------------------------------------------------------------

import { AppearanceConfig } from './index';

export type CompanySectionType =
  | 'HERO'
  | 'OVERVIEW'
  | 'ABOUT'
  | 'SERVICES'
  | 'PRODUCTS'
  | 'METRICS'
  | 'CASE_STUDIES'
  | 'TEAM'
  | 'TESTIMONIALS'
  | 'CONTACT'
  | 'ENQUIRY';

export interface CompanyMetricItem {
  label: string;
  value: string;
  description?: string;
}

export interface CompanyCoreValue {
  title: string;
  description: string;
  icon?: string;
}

export interface CompanyServiceItem {
  id: string;
  title: string;
  description: string;
  deliverables?: string[];
  deliveryMode?: string;
  startingPrice?: string;
  ctaLabel?: string;
  category?: string;
}

export interface CompanyProductItem {
  id: string;
  title: string;
  category?: string;
  description: string;
  features?: string[];
  imageUrl?: string;
  badge?: string;
  actionLabel?: string;
}

export interface CompanyCaseStudyItem {
  id: string;
  title: string;
  client?: string;
  industry?: string;
  challenge?: string;
  solution?: string;
  outcome?: string;
  tags?: string[];
}

export interface CompanyTestimonialItem {
  id: string;
  quote: string;
  clientName: string;
  designation: string;
  companyName: string;
  avatarUrl?: string;
  rating?: number;
}

export interface CompanyCertificationItem {
  title: string;
  issuer: string;
  year?: string;
  badgeText?: string;
}

export interface CompanySocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  youtube?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
}

export interface CompanyTeamMember {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  departmentName?: string;
  photoUrl?: string;
  cardSlug: string;
  email?: string;
  phone?: string;
  bio?: string;
}

export interface ResolvedCompanyWebsite {
  // Core Identity & Branding
  companyId: string;
  companySlug: string;
  name: string;
  legalName: string;
  tagline: string;
  logoUrl?: string;
  heroImageUrl?: string;
  positioningStatement: string;
  industry: string;
  location: string;
  foundedYear: string;
  employeeCount: string;
  verified: boolean;

  // Brand Palette
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  appearance: AppearanceConfig;

  // Story & Mission
  aboutStory: string;
  mission: string;
  vision: string;
  coreValues: CompanyCoreValue[];
  certifications: CompanyCertificationItem[];

  // Offerings
  services: CompanyServiceItem[];
  products: CompanyProductItem[];

  // Proof & Work
  metrics: CompanyMetricItem[];
  caseStudies: CompanyCaseStudyItem[];
  testimonials: CompanyTestimonialItem[];

  // Team
  team: CompanyTeamMember[];

  // Contact Coordinates & Hours
  email: string;
  phone: string;
  whatsapp?: string;
  website: string;
  address: string;
  operatingHours: string;
  socialLinks: CompanySocialLinks;

  // Enabled Navigation Sections
  enabledSections: CompanySectionType[];
}
