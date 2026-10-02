import { Employee, Company, Department } from '../types';
import {
  DigitalIdentityProfile,
  ResolvedCardProfile,
  CardSectionType,
  ProfileMetric,
  ServiceItem,
  SkillCategory,
  ExperienceItem,
  ProjectItem,
  EducationItem,
  CertificationItem,
  AchievementItem,
  TestimonialItem,
} from '../types/cardProfile';

/**
 * Pure resolution function that merges authoritative employee/company data
 * with optional DigitalIdentityProfile without modifying authoritative records.
 */
export function resolveCardProfile(
  employee: Employee,
  company?: Company | null,
  department?: Department | null,
  profile?: DigitalIdentityProfile | null
): ResolvedCardProfile {
  const hasCompanyAssociation = Boolean(
    company &&
    employee.companyId &&
    employee.companyId !== 'independent' &&
    company.name &&
    company.status !== 'suspended'
  );

  const primaryColor = (hasCompanyAssociation && company?.branding?.primaryColor) || '#0f766e';
  const secondaryColor = (hasCompanyAssociation && company?.branding?.secondaryColor) || '#134e4a';
  const accentColor = (hasCompanyAssociation && company?.branding?.accentColor) || '#14b8a6';
  const showCompanyAddress = Boolean(
    hasCompanyAssociation &&
    company?.branding?.showCompanyAddress !== false &&
    company?.address
  );

  // Social Links merger
  const socialLinks = {
    linkedin: profile?.socialLinks?.linkedin || employee.linkedin || '',
    twitter: profile?.socialLinks?.twitter || employee.otherSocialLinks?.twitter || '',
    github: profile?.socialLinks?.github || employee.otherSocialLinks?.github || '',
    instagram: profile?.socialLinks?.instagram || employee.instagram || '',
    youtube: profile?.socialLinks?.youtube || employee.otherSocialLinks?.youtube || '',
    website: profile?.socialLinks?.website || employee.website || (hasCompanyAssociation ? company?.website : '') || '',
    medium: profile?.socialLinks?.medium || '',
    portfolio: profile?.socialLinks?.portfolio || '',
  };

  // Expertise resolution
  const expertise: string[] = profile?.expertise || [];

  // Skill categories resolution
  let skillCategories: SkillCategory[] = profile?.skillCategories || [];
  if (skillCategories.length === 0 && expertise.length > 0) {
    skillCategories = [
      {
        categoryName: 'Core Competencies',
        skills: expertise,
      },
    ];
  }

  // Normalize Services (support array of strings or ServiceItem objects)
  let services: ServiceItem[] = [];
  if (profile?.services && profile.services.length > 0) {
    services = profile.services.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `srv_${idx + 1}`,
          title: item,
          description: `Specialized professional delivery in ${item.toLowerCase()}.`,
          deliveryMode: 'Consulting',
        };
      }
      return item;
    });
  }

  // Credentials / Certifications
  const credentials: CertificationItem[] = profile?.credentials || [];

  // Career Experiences
  const experiences: ExperienceItem[] = profile?.experiences || [];

  // Portfolio / Projects
  const projects: ProjectItem[] = profile?.projects || [];

  // Education
  const education: EducationItem[] = profile?.education || [];

  // Achievements / Recognition
  const achievements: AchievementItem[] = profile?.achievements || [];

  // Testimonials
  const testimonials: TestimonialItem[] = profile?.testimonials || [];

  // Metrics resolution
  let metrics: ProfileMetric[] = [];
  if (profile?.metrics && profile.metrics.length > 0) {
    metrics = profile.metrics;
  } else {
    const derived: ProfileMetric[] = [];
    if (credentials.length > 0) {
      derived.push({ label: 'Certifications', value: `${credentials.length} Verified` });
    }
    if (expertise.length > 0) {
      derived.push({ label: 'Core Skills', value: `${expertise.length} Areas` });
    }
    if (services.length > 0) {
      derived.push({ label: 'Services', value: `${services.length} Solutions` });
    }
    if (experiences.length > 0) {
      derived.push({ label: 'Experience', value: `${experiences.length} Roles` });
    }
    if (projects.length > 0) {
      derived.push({ label: 'Projects', value: `${projects.length} Delivered` });
    }
    metrics = derived;
  }

  // Determine enabled sections
  const defaultSections: CardSectionType[] = [
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
  ];

  let rawEnabledSections = defaultSections;
  if (profile?.sectionConfigs && profile.sectionConfigs.length > 0) {
    rawEnabledSections = profile.sectionConfigs
      .filter((s) => s.enabled && s.visibility === 'PUBLIC')
      .sort((a, b) => a.order - b.order)
      .map((s) => s.type);
  }

  // Auto-prune empty sections
  const enabledSections = rawEnabledSections.filter((sec) => {
    if (sec === 'ABOUT' && !profile?.about && !employee.bio) return false;
    if (sec === 'EXPERTISE' && expertise.length === 0 && skillCategories.length === 0) return false;
    if (sec === 'SERVICES' && services.length === 0) return false;
    if (sec === 'CREDENTIALS' && credentials.length === 0) return false;
    if (sec === 'EXPERIENCE' && experiences.length === 0) return false;
    if (sec === 'PORTFOLIO' && projects.length === 0) return false;
    if (sec === 'EDUCATION' && education.length === 0) return false;
    if (sec === 'ACHIEVEMENTS' && achievements.length === 0) return false;
    if (sec === 'TESTIMONIALS' && testimonials.length === 0) return false;
    if (sec === 'COMPANY' && !hasCompanyAssociation) return false;
    return true;
  });

  return {
    employeeId: employee.id,
    individualId: profile?.individualId || employee.id,
    displayName: employee.displayName || `${employee.firstName} ${employee.lastName}`.trim(),
    firstName: employee.firstName,
    lastName: employee.lastName,
    designation: employee.designation || 'Professional',
    profilePhotoUrl: employee.profilePhotoUrl,
    headline:
      profile?.headline ||
      (hasCompanyAssociation && employee.designation && company?.name
        ? `${employee.designation} at ${company.name}`
        : employee.designation || ''),
    about: profile?.about || employee.bio || '',
    philosophy: profile?.philosophy || '',
    location: profile?.location || (hasCompanyAssociation ? company?.address : undefined),
    heroImageUrl: profile?.heroImageUrl,

    hasCompanyAssociation,
    companyId: hasCompanyAssociation ? employee.companyId : undefined,
    companyName: hasCompanyAssociation ? (company?.name || '') : '',
    companyTagline: hasCompanyAssociation ? (company?.tagline || '') : '',
    companyLogoUrl: hasCompanyAssociation ? company?.logoUrl : undefined,
    companyAddress: hasCompanyAssociation ? company?.address : undefined,
    companyWebsite: hasCompanyAssociation ? company?.website : undefined,
    companyDescription: hasCompanyAssociation ? company?.description : undefined,
    primaryColor,
    secondaryColor,
    accentColor,
    showCompanyAddress,
    appearance: profile?.appearance || company?.branding?.appearance || { mode: 'light' },

    departmentName: hasCompanyAssociation ? department?.name : undefined,

    email: employee.email,
    phone: employee.phone,
    whatsapp: employee.whatsapp,
    website: employee.website || (hasCompanyAssociation ? company?.website : undefined),

    metrics,
    expertise,
    skillCategories,
    services,
    experiences,
    projects,
    education,
    credentials,
    achievements,
    testimonials,
    socialLinks,
    enabledSections,
  };
}

