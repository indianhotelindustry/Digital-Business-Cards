import { Company, Employee, Department, Card } from '../types';
import { ResolvedCompanyWebsite } from '../types/companyProfile';

export function resolveCompanySlug(company: Company): string {
  if ((company as any).slug) return (company as any).slug;
  if (company.id === 'company_acme') return 'acme-innovations';
  if (company.id === 'company_nexus') return 'nexus-global';
  // Directive 26: a real company has a public URL only once its website is
  // published (the backend resolver supplies company.slug). Never guess one.
  return '';
}

export function resolveCompanyWebsiteProfile(
  company: Company,
  employees: Employee[] = [],
  departments: Department[] = [],
  cards: Card[] = []
): ResolvedCompanyWebsite {
  const slug = resolveCompanySlug(company);
  // Directive 26: sample content belongs ONLY to the two built-in demo tenants
  // (matched by id, never by slug or name). A real customer's website shows
  // exactly what the customer entered — nothing invented.
  const isAcme = company.id === 'company_acme';
  const isNexus = company.id === 'company_nexus';
  const isDemoTenant = isAcme || isNexus;

  // Map employees to team members
  const teamMembers = employees
    .filter((e) => e.status === 'active')
    .map((emp) => {
      const dept = departments.find((d) => d.id === emp.departmentId);
      const card = cards.find((c) => c.employeeId === emp.id && c.status === 'active');
      const cardSlug = card ? card.publicSlug : isDemoTenant ? emp.displayName.toLowerCase().replace(/\s+/g, '-') : '';
      return {
        id: emp.id,
        employeeId: emp.id,
        name: emp.displayName || `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation,
        departmentName: dept?.name || 'Leadership',
        photoUrl: emp.profilePhotoUrl,
        cardSlug,
        email: emp.email,
        phone: emp.phone,
        bio: emp.bio,
      };
    })
    // Real customers: only members with a published card are linked publicly.
    .filter((m) => isDemoTenant || !!m.cardSlug);

  // Default seed values based on profile ID if not overridden by company admin
  const defaultAcmeValues = {
    tagline: 'Innovating today for a smarter tomorrow',
    logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80',
    heroImageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&auto=format&fit=crop&q=80',
    positioningStatement: 'Pioneering zero-trust digital business identity, multi-tenant enterprise cloud architectures, and next-generation contactless corporate communication infrastructure.',
    industry: 'Enterprise Software & Cloud Systems',
    location: 'San Francisco, CA',
    foundedYear: '2018',
    aboutStory: 'Founded in 2018 in San Francisco, Acme Innovations emerged to solve a critical enterprise problem: modern corporate professionals required a secure, unified, and verifiable digital identity standard that scales effortlessly across distributed workforces.\n\nToday, we power digital identity and contactless exchange infrastructure for over 140 Fortune 500 enterprises, processing millions of interactions with mathematical zero-trust tenant isolation and sub-50ms latency globally.',
    mission: 'To empower global enterprises with seamless, verifiable, and secure digital identity ecosystems that eliminate physical friction and elevate professional connection.',
    vision: 'A universally connected enterprise world where every professional interaction is instant, verified, and protected by mathematical zero-trust security.',
    coreValues: [
      { title: 'Zero-Trust Security', description: 'Architecting every subsystem with strict tenant boundary isolation and cryptographic data integrity.', icon: 'Shield' },
      { title: 'Architectural Elegance', description: 'Sub-second response times, RFC 6350 compliance, and intuitive mobile-first user ergonomics.', icon: 'Sparkles' },
      { title: 'Customer-Centric Scale', description: 'Delivering 99.999% availability for enterprise teams operating across every global timezone.', icon: 'Users' },
      { title: 'Continuous Innovation', description: 'Constantly advancing NFC, QR telemetry, and privacy-first AI intelligence for digital networking.', icon: 'Lightbulb' },
    ],
    certifications: [
      { title: 'SOC 2 Type II Certified', issuer: 'AICPA / TrustArc', year: '2025', badgeText: 'Security & Availability' },
      { title: 'ISO/IEC 27001 Certified', issuer: 'International Organization for Standardization', year: '2024', badgeText: 'Information Security' },
      { title: 'GDPR & CCPA Compliant', issuer: 'Global Data Privacy Board', year: '2025', badgeText: 'Privacy Protected' },
      { title: 'RFC 6350 vCard Standard Certified', issuer: 'IETF Interoperability Lab', year: '2026', badgeText: 'Universal Exchange' },
    ],
    services: [
      {
        id: 'svc_acme_1',
        title: 'Enterprise Digital Identity Rollout',
        description: 'Complete deployment of standardized digital business cards, dynamic QR badges, and NFC cards for enterprise workforces.',
        deliverables: ['Custom Domain & Subdomains', 'SSO / SAML 2.0 Integration', 'Automated Employee Provisioning', 'Corporate Brand Enforcement'],
        deliveryMode: 'Turnkey Enterprise',
        startingPrice: 'Custom Plan',
        ctaLabel: 'Enquire for Workforce',
        category: 'Identity & Access',
      },
      {
        id: 'svc_acme_2',
        title: 'Zero-Trust Architecture Advisory',
        description: 'Executive consulting and technical review for multi-tenant SaaS topologies, Firestore security rules, and ABAC frameworks.',
        deliverables: ['Tenant Isolation Audit', 'Security Rules Pen-Test', 'High-Throughput Optimization', 'Compliance Documentation'],
        deliveryMode: 'Advisory & Retainer',
        startingPrice: '$12,500 / Project',
        ctaLabel: 'Schedule Architecture Review',
        category: 'Cloud Engineering',
      },
      {
        id: 'svc_acme_3',
        title: 'Event & Campaign Lead Telemetry',
        description: 'Booth QR badge orchestration, real-time conference engagement tracking, and instant CRM lead sync.',
        deliverables: ['Real-Time Event Dashboards', 'Custom Booth Campaign QRs', 'Offline Fallback Capture', 'HubSpot & Salesforce Integrations'],
        deliveryMode: 'Managed Solution',
        startingPrice: '$4,500 / Event',
        ctaLabel: 'Request Event Kit',
        category: 'Growth & Events',
      },
    ],
    products: [
      {
        id: 'prod_acme_1',
        title: 'DSBC Enterprise Suite v2.2',
        category: 'Digital Identity Platform',
        description: 'The premier multi-tenant digital business card platform with RFC 6350 vCard generation, multi-template rendering, and real-time interaction analytics.',
        features: ['Executive Classic, Neo Modern & Nordic Minimal templates', 'Zero-Trust RBAC security', 'Lead capture & CRM sync', 'Interactive individual & company mini-websites'],
        badge: 'Flagship Platform',
        actionLabel: 'Request Platform Demo',
      },
      {
        id: 'prod_acme_2',
        title: 'DSBC Tap NFC Hardware Suite',
        category: 'Smart Hardware',
        description: 'Eco-conscious bamboo and matte metal NFC cards encoded with encrypted dynamic card URLs for instant tap-to-phone contact exchange.',
        features: ['Laser-etched corporate logo', 'Encrypted dynamic chip', 'Universal iOS & Android compatibility', 'Zero app required for recipient'],
        badge: 'Hardware Innovation',
        actionLabel: 'Order Hardware Sample',
      },
    ],
    metrics: [
      { label: 'Enterprise Clients', value: '140+', description: 'Global corporate deployments' },
      { label: 'Cards Active', value: '85,000+', description: 'Across North America and EMEA' },
      { label: 'Monthly Interactions', value: '2.4M+', description: 'Sub-50ms resolution latency' },
      { label: 'Cloud Uptime', value: '99.999%', description: 'Fault-tolerant multi-region cluster' },
    ],
    caseStudies: [
      {
        id: 'cs_acme_1',
        title: 'Standardizing 1,200 Global Consultants Across 14 Countries',
        client: 'Apex Cloud Systems',
        industry: 'FinTech & Cloud Systems',
        challenge: 'Legacy paper business cards caused outdated contact distribution, zero analytics, and security non-compliance during client pitches.',
        solution: 'Deployed DSBC Enterprise with Active Directory automated sync, branded classic executive templates, and company mini-website linking.',
        outcome: 'Achieved 100% digital card adoption in 14 days, saved $140,000 in annual printing costs, and generated 4,800+ qualified leads.',
        tags: ['SSO Integration', 'Lead Acceleration', 'Zero-Trust Security'],
      },
      {
        id: 'cs_acme_2',
        title: 'Transatlantic Trade Show Lead Velocity Acceleration',
        client: 'Global Tech Expo 2026',
        industry: 'Exhibitions & Conferences',
        challenge: 'Exhibitors lost 40% of prospective leads due to slow physical badge scanning and lost paper business cards.',
        solution: 'Implemented DSBC Campaign QR stations and 1-tap mobile exchange across 60 booth staff members.',
        outcome: 'Captured 420+ high-intent enterprise leads in 72 hours with instant CRM sync and zero dropped connections.',
        tags: ['Event Campaigns', 'Real-Time Telemetry', 'Instant Sync'],
      },
    ],
    testimonials: [
      {
        id: 'test_acme_1',
        quote: 'Deploying Acme’s DSBC platform across our global leadership team transformed how we present our brand. The mini-company website linked to our cards delivers instant corporate credibility in every meeting.',
        clientName: 'Elena Rostova',
        designation: 'Chief Technology Officer',
        companyName: 'Apex Cloud Systems',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        rating: 5,
      },
      {
        id: 'test_acme_2',
        quote: 'The security posture and zero-trust data isolation provided by Acme gave our compliance board total confidence. Our sales velocity has increased significantly.',
        clientName: 'Marcus Vance',
        designation: 'Chief Operations Officer',
        companyName: 'Nexus Global Logistics',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        rating: 5,
      },
    ],
    operatingHours: 'Monday – Friday: 8:00 AM – 6:00 PM PST',
    socialLinks: {
      linkedin: 'https://linkedin.com/company/acme-innovations-inc',
      twitter: 'https://twitter.com/acme_innovations',
      github: 'https://github.com/acme-innovations',
      youtube: 'https://youtube.com/@acme-innovations',
    },
  };

  const defaultNexusValues = {
    tagline: 'Precision freight orchestration across global waters',
    logoUrl: 'https://images.unsplash.com/photo-1516876437184-593fda40c7ce?w=200&auto=format&fit=crop&q=80',
    heroImageUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1600&auto=format&fit=crop&q=80',
    positioningStatement: 'Directing end-to-end autonomous maritime freight, transatlantic container routing, and high-velocity multi-modal logistics brokerage worldwide.',
    industry: 'Global Supply Chain & Maritime Logistics',
    location: 'New York, NY • Transatlantic Hubs',
    foundedYear: '2015',
    aboutStory: 'Nexus Global Logistics was founded in 2015 with a singular vision: to eliminate transatlantic maritime freight opacity through real-time telemetry, automated port routing, and enterprise logistics brokerage.\n\nOperating across 24 global maritime hubs, we manage over $1.4B in annual cargo volume with a 99.4% on-time delivery index.',
    mission: 'To streamline global commerce with transparent, data-driven freight infrastructure that guarantees container velocity and supply chain resilience.',
    vision: 'An intelligent, connected global supply network where intermodal freight moves with zero friction and total environmental accountability.',
    coreValues: [
      { title: 'Operational Precision', description: 'Real-time vessel telemetry and proactive route optimization mitigating port congestion before delays occur.', icon: 'Compass' },
      { title: 'Transatlantic Reliability', description: 'Deep carrier contracting providing guaranteed container capacity during peak global shipping seasons.', icon: 'Anchor' },
      { title: 'Customs & Compliance Mastery', description: 'Automated digital documentation clearance across 150+ international trade ports.', icon: 'FileCheck' },
    ],
    certifications: [
      { title: 'C-TPAT Tier 3 Certified', issuer: 'U.S. Customs and Border Protection', year: '2025', badgeText: 'Customs Security' },
      { title: 'ISO 9001:2015 Quality Logistics', issuer: 'Bureau Veritas', year: '2024', badgeText: 'Quality Standard' },
      { title: 'IATA & FMC Licensed Broker', issuer: 'Federal Maritime Commission', year: '2026', badgeText: 'Licensed Operator' },
    ],
    services: [
      {
        id: 'svc_nexus_1',
        title: 'Transatlantic Maritime Container Brokerage',
        description: 'Dedicated FCL and LCL container allocation with automated port routing and customs clearance.',
        deliverables: ['Guaranteed Vessel Space', 'Customs Clearance Brokerage', 'Reefer & Hazardous Cargo Care', 'Port Drayage Coordination'],
        deliveryMode: 'Scheduled Carrier Service',
        startingPrice: 'Per TEU / Contract',
        ctaLabel: 'Request Freight Quote',
        category: 'Ocean Freight',
      },
      {
        id: 'svc_nexus_2',
        title: 'Supply Chain Telemetry & Predictive Routing',
        description: 'Cloud telemetry monitoring vessel velocity, weather forecasts, and port dwell times to predict and prevent delays.',
        deliverables: ['Real-Time GPS Vessel Tracking', 'Automated ETA Deviation Alerts', 'Exception Management Hub', 'API Telemetry Feeds'],
        deliveryMode: 'SaaS + Operations Service',
        startingPrice: 'Enterprise License',
        ctaLabel: 'Book Telemetry Demo',
        category: 'Logistics Tech',
      },
    ],
    products: [
      {
        id: 'prod_nexus_1',
        title: 'Nexus PortFlow Orchestrator',
        category: 'Logistics Software',
        description: 'Automated container routing engine coordinating drayage trucks, rail ramps, and deep-sea vessels in real time.',
        features: ['Multi-modal routing algorithms', 'Dynamic dwell time mitigation', 'Electronic bill of lading integration'],
        badge: 'Patented Technology',
        actionLabel: 'Explore PortFlow',
      },
    ],
    metrics: [
      { label: 'Freight Volume', value: '$1.4B+', description: 'Annual cargo managed' },
      { label: 'Carrier Network', value: '12,000+', description: 'Verified maritime vessels' },
      { label: 'On-Time Rate', value: '99.4%', description: 'Across transatlantic lanes' },
      { label: 'Global Hubs', value: '24 Worldwide', description: 'Active port offices' },
    ],
    caseStudies: [
      {
        id: 'cs_nexus_1',
        title: 'Mitigating Major East Coast Port Congestion for Automotive Manufacturer',
        client: 'Tier-1 Auto Supply Group',
        industry: 'Automotive Manufacturing',
        challenge: 'Unprecedented 11-day port dwell times threatened assembly line shutdowns across three Midwest factories.',
        solution: 'Rerouted 180 maritime containers to secondary deep-water ports with coordinated express intermodal rail bridges.',
        outcome: 'Prevented $6.2M in downtime losses and maintained 100% assembly schedule continuity.',
        tags: ['Crisis Routing', 'Intermodal Rail', 'Automotive Logistics'],
      },
    ],
    testimonials: [
      {
        id: 'test_nexus_1',
        quote: 'Nexus Global is the most reliable freight partner we have worked with. Their telemetry and proactive exception handling kept our transatlantic operations flawlessly on schedule.',
        clientName: 'David Vance',
        designation: 'Managing Director',
        companyName: 'Atlantic Freight Partners',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        rating: 5,
      },
    ],
    operatingHours: '24/7 Global Operations Center',
    socialLinks: {
      linkedin: 'https://linkedin.com/company/nexus-global-logistics',
    },
  };

  const defaults = isAcme ? defaultAcmeValues : isNexus ? defaultNexusValues : {
    tagline: '',
    logoUrl: undefined as string | undefined,
    heroImageUrl: undefined as string | undefined,
    positioningStatement: company.description || '',
    industry: '',
    location: company.address || '',
    foundedYear: '',
    aboutStory: company.description || '',
    mission: '',
    vision: '',
    coreValues: [] as any[],
    certifications: [] as any[],
    services: [] as any[],
    products: [] as any[],
    metrics: [] as any[],
    caseStudies: [] as any[],
    testimonials: [] as any[],
    operatingHours: '',
    socialLinks: {} as Record<string, string>,
  };

  const name = company.name || (isAcme ? 'Acme Innovations Inc.' : isNexus ? 'Nexus Global Logistics' : '');
  const legalName = company.legalName || name;
  const tagline = company.tagline || defaults.tagline;
  const logoUrl = company.logoUrl || defaults.logoUrl;
  const heroImageUrl = company.heroImageUrl || defaults.heroImageUrl;
  const positioningStatement = company.positioningStatement || company.description || defaults.positioningStatement;
  const industry = company.industry || defaults.industry;
  const location = company.address || defaults.location;
  const foundedYear = company.foundedYear || defaults.foundedYear;
  const employeeCount = isDemoTenant ? `${teamMembers.length || 25}+ Specialists` : teamMembers.length ? `${teamMembers.length} team member${teamMembers.length === 1 ? '' : 's'}` : '';
  const primaryColor = company.branding?.primaryColor || (isAcme ? '#0f766e' : isNexus ? '#2563eb' : '#0f766e');
  const secondaryColor = company.branding?.secondaryColor || (isAcme ? '#134e4a' : isNexus ? '#1e3a8a' : '#134e4a');
  const accentColor = company.branding?.accentColor || (isAcme ? '#14b8a6' : isNexus ? '#60a5fa' : '#14b8a6');
  const appearance = company.branding?.appearance || { mode: 'dark' };

  const aboutStory = (company as any).aboutStory || company.description || defaults.aboutStory;
  const mission = company.mission || defaults.mission;
  const vision = company.vision || defaults.vision;
  const coreValues = company.coreValues && company.coreValues.length > 0 ? company.coreValues : defaults.coreValues;
  const certifications = (company as any).certifications && (company as any).certifications.length > 0 ? (company as any).certifications : defaults.certifications;

  const services = company.services && company.services.length > 0 ? company.services : defaults.services;
  const products = company.products && company.products.length > 0 ? company.products : defaults.products;
  const metrics = company.metrics && company.metrics.length > 0 ? company.metrics : defaults.metrics;
  const caseStudies = company.caseStudies && company.caseStudies.length > 0 ? company.caseStudies : defaults.caseStudies;
  const testimonials = company.testimonials && company.testimonials.length > 0 ? company.testimonials : defaults.testimonials;

  const email = company.email || (isAcme ? 'contact@acme-innovations.com' : isNexus ? 'info@nexus-global.org' : '');
  const phone = company.phone || (isAcme ? '+1 (555) 234-8901' : isNexus ? '+1 (800) 555-0199' : '');
  const whatsapp = company.whatsapp || (isAcme ? '+14158902341' : isNexus ? '+12125558890' : undefined);
  const website = company.website || (isAcme ? 'https://acme-innovations.example.com' : isNexus ? 'https://nexus-global.example.com' : '');
  const address = company.address || (isAcme ? '742 Evergreen Terrace, Suite 500, San Francisco, CA 94107' : isNexus ? '120 Wall Street, 28th Floor, New York, NY 10005' : '');
  const operatingHours = company.operatingHours || defaults.operatingHours;

  const socialLinks = {
    ...(website ? { website } : {}),
    ...(defaults.socialLinks || {}),
    ...(company.socialLinks || {}),
  };

  // Sections appear only when there is real content for them.
  const enabledSections: any[] = [
    'HERO',
    'OVERVIEW',
    ...(aboutStory || mission || vision || coreValues.length > 0 ? ['ABOUT'] : []),
    ...(services.length > 0 ? ['SERVICES'] : []),
    ...(products.length > 0 ? ['PRODUCTS'] : []),
    ...(metrics.length > 0 ? ['METRICS'] : []),
    ...(caseStudies.length > 0 ? ['CASE_STUDIES'] : []),
    ...(teamMembers.length > 0 ? ['TEAM'] : []),
    ...(testimonials.length > 0 ? ['TESTIMONIALS'] : []),
    ...(email || phone || address || website ? ['CONTACT'] : []),
    'ENQUIRY',
  ];

  return {
    companyId: company.id,
    companySlug: slug,
    name,
    legalName,
    tagline,
    logoUrl,
    heroImageUrl,
    positioningStatement,
    industry,
    location,
    foundedYear,
    employeeCount,
    verified: isDemoTenant,
    primaryColor,
    secondaryColor,
    accentColor,
    appearance,
    aboutStory,
    mission,
    vision,
    coreValues,
    certifications,
    services,
    products,
    metrics,
    caseStudies,
    testimonials,
    team: teamMembers,
    email,
    phone,
    whatsapp,
    website,
    address,
    operatingHours,
    socialLinks,
    enabledSections,
  };
}
