import {
  Company,
  Department,
  Employee,
  Card,
  Event,
  Campaign,
  Lead,
  CompanyLeadNote,
  LeadEvent,
} from '../types';
import { DigitalIdentityProfile } from '../types/cardProfile';
import { DEMO_USERS } from './seedService';
import { DEMO_FEATURES_ENABLED } from '../lib/runtimeFlags';
import { auth } from '../lib/firebase';

const now = '2026-03-15T12:00:00.000Z';

// ----------------------------------------------------
// DEFAULT DEMO DATA STORE (In-Memory / Local Storage)
// ----------------------------------------------------

export const INITIAL_DEMO_COMPANIES: Company[] = [
  {
    id: 'company_acme',
    name: 'Acme Innovations Inc.',
    legalName: 'Acme Innovations International Ltd.',
    logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80',
    website: 'https://acme-innovations.example.com',
    email: 'contact@acme-innovations.com',
    phone: '+1 (555) 234-8901',
    address: '742 Evergreen Terrace, Suite 500, San Francisco, CA 94107',
    description: 'Pioneering next-generation enterprise hardware and intelligent software solutions.',
    branding: {
      primaryColor: '#0f766e',
      secondaryColor: '#134e4a',
      accentColor: '#14b8a6',
      fontFamily: 'sans-serif',
      cardThemePreference: 'classic',
      showCompanyAddress: true,
    },
    status: 'active',
    planId: 'enterprise',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'company_nexus',
    name: 'Nexus Global Logistics',
    legalName: 'Nexus Global Supply Chain Group Inc.',
    logoUrl: 'https://images.unsplash.com/photo-1516876437184-593fda40c7ce?w=200&auto=format&fit=crop&q=80',
    website: 'https://nexus-global.example.com',
    email: 'info@nexus-global.org',
    phone: '+1 (800) 555-0199',
    address: '120 Wall Street, 28th Floor, New York, NY 10005',
    description: 'End-to-end autonomous maritime freight and multi-modal logistics brokerage.',
    branding: {
      primaryColor: '#2563eb',
      secondaryColor: '#1e3a8a',
      accentColor: '#60a5fa',
      fontFamily: 'sans-serif',
      cardThemePreference: 'modern',
      showCompanyAddress: true,
    },
    status: 'active',
    planId: 'pro',
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_DEPARTMENTS: Department[] = [
  {
    id: 'dept_acme_sales',
    companyId: 'company_acme',
    name: 'Sales & Strategic Accounts',
    description: 'Global enterprise direct sales and key partnership development.',
    departmentHeadEmployeeId: 'emp_acme_rahul',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'dept_acme_marketing',
    companyId: 'company_acme',
    name: 'Marketing & Brand Strategy',
    description: 'Growth marketing, brand narrative, and public relations.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'dept_acme_hr',
    companyId: 'company_acme',
    name: 'People Operations & HR',
    description: 'Global talent acquisition, employee experience, and compliance.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'dept_nexus_ops',
    companyId: 'company_nexus',
    name: 'Global Operations',
    description: 'Fleet orchestration and automated port routing systems.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'dept_nexus_sales',
    companyId: 'company_nexus',
    name: 'Enterprise Brokerage',
    description: 'North American carrier relationships and freight sales.',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'emp_acme_rahul',
    companyId: 'company_acme',
    departmentId: 'dept_acme_sales',
    firstName: 'Rahul',
    lastName: 'Sharma',
    displayName: 'Rahul Sharma',
    designation: 'VP of Global Enterprise Sales',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    email: 'rahul.sharma@acme-innovations.com',
    phone: '+1 (415) 890-2341',
    whatsapp: '+14158902341',
    bio: 'Leading strategic accounts and enterprise architecture transitions across Fortune 500 partners.',
    linkedin: 'https://linkedin.com/in/rahul-sharma-sales-leader',
    website: 'https://rahulsharma.me',
    instagram: 'rahul.sharma.exec',
    cardId: 'card_acme_rahul',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_acme_sarah',
    companyId: 'company_acme',
    departmentId: 'dept_acme_marketing',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    displayName: 'Sarah Jenkins',
    designation: 'Director of Brand & Product Marketing',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    email: 'sarah.j@acme-innovations.com',
    phone: '+1 (415) 890-4422',
    whatsapp: '+14158904422',
    bio: 'Brand architect and product evangelist connecting technical innovation with customer value.',
    linkedin: 'https://linkedin.com/in/sarah-jenkins-brand',
    website: 'https://sarahjenkins.design',
    cardId: 'card_acme_sarah',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_nexus_marcus',
    companyId: 'company_nexus',
    departmentId: 'dept_nexus_ops',
    firstName: 'Marcus',
    lastName: 'Vance',
    displayName: 'Marcus Vance',
    designation: 'Chief Operations Officer',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    email: 'm.vance@nexus-global.org',
    phone: '+1 (212) 555-8890',
    whatsapp: '+12125558890',
    bio: 'Directing real-time container logistics and transatlantic cargo operations.',
    linkedin: 'https://linkedin.com/in/marcus-vance-ops',
    website: 'https://nexus-global.example.com/leadership',
    cardId: 'card_nexus_marcus',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_CARDS: Card[] = [
  {
    id: 'card_acme_rahul',
    companyId: 'company_acme',
    employeeId: 'emp_acme_rahul',
    templateId: 'classic',
    publicSlug: 'rahul-sharma',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'card_acme_sarah',
    companyId: 'company_acme',
    employeeId: 'emp_acme_sarah',
    templateId: 'modern',
    publicSlug: 'sarah-jenkins',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'card_nexus_marcus',
    companyId: 'company_nexus',
    employeeId: 'emp_nexus_marcus',
    templateId: 'minimal',
    publicSlug: 'marcus-vance',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_EVENTS: Event[] = [
  {
    id: 'event_acme_ces_2026',
    companyId: 'company_acme',
    name: 'Global Tech Expo 2026',
    eventType: 'exhibition',
    location: 'Las Vegas Convention Center, Hall B',
    startAt: '2026-03-20',
    endAt: '2026-03-23',
    status: 'active',
    description: 'Premier consumer & enterprise electronic systems summit. Booth #4092.',
    createdBy: DEMO_USERS.companyAdminAcme.id,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'event_acme_summit_q2',
    companyId: 'company_acme',
    name: 'Enterprise Architecture Leadership Summit',
    eventType: 'conference',
    location: 'Marriott Marquis, San Francisco, CA',
    startAt: '2026-04-10',
    endAt: '2026-04-11',
    status: 'active',
    description: 'Annual invitation-only executive cloud and digital card deployment symposium.',
    createdBy: DEMO_USERS.companyAdminAcme.id,
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_acme_booth_qr',
    companyId: 'company_acme',
    eventId: 'event_acme_ces_2026',
    name: 'Main Exhibition Booth Banner QR',
    campaignType: 'booth_qr',
    status: 'active',
    createdBy: DEMO_USERS.companyAdminAcme.id,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'camp_acme_linkedin_q1',
    companyId: 'company_acme',
    name: 'Q1 Executive Digital Business Card Campaign',
    campaignType: 'linkedin',
    status: 'active',
    createdBy: DEMO_USERS.companyAdminAcme.id,
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_LEADS: Lead[] = [
  {
    id: 'lead_acme_priya_apex',
    companyId: 'company_acme',
    ownerEmployeeId: 'emp_acme_rahul',
    ownerUserId: DEMO_USERS.employeeRahul.id,
    ownerName: 'Rahul Sharma',
    eventId: 'event_acme_ces_2026',
    campaignId: 'camp_acme_booth_qr',
    sourceType: 'EVENT',
    name: 'Priya Nair',
    email: 'priya.nair@apexcloud.io',
    phone: '+1 (415) 555-0182',
    companyName: 'Apex Cloud Systems',
    jobTitle: 'VP Enterprise Architecture',
    leadStatus: 'qualified',
    qualificationStatus: 'qualified',
    priority: 'high',
    notesSummary: 'Met at Booth #4092. Evaluated our digital card SDK for 1,200 consultants.',
    createdBy: DEMO_USERS.employeeRahul.id,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'lead_acme_marcus_vance',
    companyId: 'company_acme',
    ownerEmployeeId: 'emp_acme_rahul',
    ownerUserId: DEMO_USERS.employeeRahul.id,
    ownerName: 'Rahul Sharma',
    sourceType: 'CARD_QR',
    sourceConnectionId: 'conn_rahul_marcus',
    name: 'Marcus Vance',
    email: 'm.vance@nexus-global.org',
    phone: '+1 (212) 555-8890',
    companyName: 'Nexus Global Logistics',
    jobTitle: 'Chief Operations Officer',
    leadStatus: 'qualifying',
    qualificationStatus: 'qualifying',
    priority: 'high',
    notesSummary: 'Standardizing digital business cards across transatlantic logistics team.',
    createdBy: DEMO_USERS.employeeRahul.id,
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_LEAD_NOTES: CompanyLeadNote[] = [
  {
    id: 'lnote_acme_priya_1',
    leadId: 'lead_acme_priya_apex',
    companyId: 'company_acme',
    authorUserId: DEMO_USERS.employeeRahul.id,
    authorName: 'Rahul Sharma',
    content: 'Completed technical qualification. They require SSO integration and custom subdomains.',
    createdAt: now,
    updatedAt: now,
  },
];

export const INITIAL_DEMO_LEAD_EVENTS: LeadEvent[] = [
  {
    id: 'levt_acme_priya_1',
    leadId: 'lead_acme_priya_apex',
    companyId: 'company_acme',
    eventType: 'LEAD_CREATED',
    actorUserId: DEMO_USERS.employeeRahul.id,
    actorName: 'Rahul Sharma',
    description: 'Captured lead at Global Tech Expo 2026 Booth',
    metadata: { source: 'event_booth' },
    timestamp: now,
  },
  {
    id: 'levt_acme_priya_2',
    leadId: 'lead_acme_priya_apex',
    companyId: 'company_acme',
    eventType: 'LEAD_STATUS_CHANGED',
    actorUserId: DEMO_USERS.employeeRahul.id,
    actorName: 'Rahul Sharma',
    description: 'Progressed stage from new to qualified',
    metadata: { oldStage: 'new', newStage: 'qualified' },
    timestamp: now,
  },
];

export const INITIAL_DEMO_PROFILES: DigitalIdentityProfile[] = [
  {
    id: 'emp_acme_rahul',
    employeeId: 'emp_acme_rahul',
    companyId: 'company_acme',
    headline: 'Architecting ultra-resilient distributed cloud services and enterprise digital business systems.',
    about: 'VP of Global Enterprise Sales & Cloud Architecture with 14+ years designing high-throughput distributed systems and scaling digital card infrastructures across Fortune 500 enterprises.',
    philosophy: 'Resilience is not an afterthought; it is the mathematical foundation of zero-trust architecture and enduring enterprise trust.',
    location: 'San Francisco, CA • Silicon Valley',
    heroImageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
    metrics: [
      { label: 'Cloud Migrations', value: '45+ Enterprise' },
      { label: 'Uptime Architected', value: '99.999%' },
      { label: 'Patents & Papers', value: '8 Published' },
      { label: 'Years Experience', value: '14+ Yrs' },
    ],
    expertise: [
      'Cloud Architecture',
      'Distributed Systems',
      'Zero-Trust Security',
      'Multi-Tenant SaaS',
      'High-Throughput APIs',
      'RFC 6350 Standards',
      'Disaster Recovery',
      'FinOps Optimization',
    ],
    skillCategories: [
      {
        categoryName: 'Cloud & Infrastructure',
        skills: ['Google Cloud Platform', 'AWS Systems', 'Kubernetes / Service Mesh', 'Terraform / IaC', 'Serverless & Edge'],
      },
      {
        categoryName: 'Architecture & Security',
        skills: ['Zero-Trust RBAC', 'OAuth 2.0 / OpenID', 'Multi-Tenant Isolation', 'Data Compliance (SOC 2, GDPR)'],
      },
      {
        categoryName: 'Executive Leadership',
        skills: ['Enterprise Solution Sales', 'C-Suite Strategy', 'Technical Advisory', 'Cross-Functional Team Scaling'],
      },
    ],
    services: [
      {
        id: 'srv_rahul_1',
        title: 'Executive Architecture Advisory',
        description: 'Comprehensive review of multi-tenant enterprise topologies, security rules, and cloud migration blueprints.',
        deliveryMode: 'Advisory',
        startingPrice: 'Retainer / Project',
        ctaLabel: 'Request Advisory',
      },
      {
        id: 'srv_rahul_2',
        title: 'Zero-Trust Security & Compliance Audit',
        description: 'In-depth assessment of tenant boundary isolation, authorization controls, and SOC2/HIPAA compliance readiness.',
        deliveryMode: 'Turnkey',
        startingPrice: 'Fixed Engagement',
        ctaLabel: 'Schedule Audit',
      },
      {
        id: 'srv_rahul_3',
        title: 'Enterprise Digital Identity Transformation',
        description: 'Strategic rollout of digital business cards and NFC identity ecosystems across distributed corporate workforces.',
        deliveryMode: 'Consulting',
        startingPrice: 'Custom Scope',
        ctaLabel: 'Explore Transformation',
      },
    ],
    experiences: [
      {
        id: 'exp_rahul_1',
        organization: 'Acme Innovations Inc.',
        role: 'VP of Global Enterprise Sales & Cloud Architecture',
        startDate: '2022',
        endDate: 'Present',
        isCurrent: true,
        location: 'San Francisco, CA',
        description: 'Directing enterprise digital identity adoption and leading cloud infrastructure engineering for high-security multi-tenant SaaS products.',
        achievements: [
          'Scaled enterprise customer deployments from 12 to 140+ organizations across North America and EMEA.',
          'Engineered sub-50ms global public card resolution engine serving 2M+ monthly interactions.',
          'Formulated zero-trust cross-tenant security framework maintaining 100% boundary isolation compliance.',
        ],
        technologies: ['Google Cloud', 'Distributed Firestore', 'TypeScript', 'Kubernetes', 'Fastly CDN'],
      },
      {
        id: 'exp_rahul_2',
        organization: 'Apex Cloud Systems',
        role: 'Principal Cloud Architect',
        startDate: '2017',
        endDate: '2022',
        isCurrent: false,
        location: 'San Jose, CA',
        description: 'Spearheaded cloud migration strategies for Fortune 100 financial institutions, designing fault-tolerant multi-region payment gateways.',
        achievements: [
          'Designed fault-tolerant database replication achieving 99.999% availability over 4 consecutive years.',
          'Reduced corporate cloud infrastructure expenditure by 38% through automated workload scheduling.',
        ],
        technologies: ['AWS', 'Terraform', 'PostgreSQL', 'Redis', 'Kafka'],
      },
      {
        id: 'exp_rahul_3',
        organization: 'Oracle Corporation',
        role: 'Senior Infrastructure Engineer',
        startDate: '2012',
        endDate: '2017',
        isCurrent: false,
        location: 'Redwood City, CA',
        description: 'Engineered high-throughput relational data engine modules and federated identity connectors.',
        achievements: [
          'Authored core synchronization routines adopted by 40,000+ enterprise database instances globally.',
        ],
        technologies: ['Java', 'C++', 'Oracle Cloud', 'LDAP / Active Directory'],
      },
    ],
    projects: [
      {
        id: 'proj_rahul_1',
        title: 'DSBC Zero-Trust Identity Core',
        description: 'Next-generation digital business card SaaS infrastructure featuring strict tenant data isolation, sub-second vCard export, and real-time event telemetry.',
        role: 'Lead System Architect',
        organizationOrClient: 'Acme Innovations',
        technologies: ['React 19', 'TypeScript', 'Tailwind CSS', 'Firebase Firestore', 'RFC 6350'],
        outcome: 'Zero recorded cross-tenant permission leaks across 75/75 automated verification vectors.',
        projectUrl: 'https://acme-innovations.example.com',
      },
      {
        id: 'proj_rahul_2',
        title: 'Global FinTech Multi-Region Cloud Migration',
        description: 'Architected synchronous transactional data replication across 3 continents with automated failover and zero data loss.',
        role: 'Principal Consultant',
        organizationOrClient: 'Tier-1 Banking Institution',
        technologies: ['GCP Spanner', 'Terraform', 'Vault', 'Prometheus'],
        outcome: 'Migrated 40M active accounts with 0 minutes of unannounced downtime.',
      },
    ],
    education: [
      {
        id: 'edu_rahul_1',
        institution: 'Stanford University',
        qualification: 'Master of Science (M.S.)',
        field: 'Computer Science (Distributed Systems)',
        startDate: '2010',
        endDate: '2012',
      },
      {
        id: 'edu_rahul_2',
        institution: 'Indian Institute of Technology (IIT) Delhi',
        qualification: 'Bachelor of Technology (B.Tech)',
        field: 'Computer Science and Engineering',
        startDate: '2006',
        endDate: '2010',
      },
    ],
    credentials: [
      {
        title: 'Google Cloud Certified Professional Cloud Architect',
        issuer: 'Google Cloud',
        year: '2025',
        credentialId: 'GCP-PCA-89421',
        credentialUrl: 'https://google.accredited.example.com/verify/GCP-PCA-89421',
      },
      {
        title: 'CISSP - Certified Information Systems Security Professional',
        issuer: 'ISC2',
        year: '2024',
        credentialId: 'ISC2-658291',
      },
      {
        title: 'AWS Certified Solutions Architect – Professional',
        issuer: 'Amazon Web Services',
        year: '2023',
      },
    ],
    achievements: [
      {
        id: 'ach_rahul_1',
        title: 'Cloud Architecture Leadership Award 2025',
        issuerOrEvent: 'Silicon Valley Technology Forum',
        year: '2025',
        description: 'Recognized for pioneering multi-tenant isolation benchmarks and zero-trust identity architectures.',
      },
      {
        id: 'ach_rahul_2',
        title: 'Keynote Speaker: Distributed Identity & Privacy',
        issuerOrEvent: 'Global Cloud Expo (Las Vegas)',
        year: '2024',
        description: 'Delivered plenary address on RFC 6350 compliance, contact provenance, and AI privacy gates.',
      },
    ],
    testimonials: [
      {
        id: 'test_rahul_1',
        quote: 'Rahul architected our entire digital identity backbone. His zero-trust approach provided the exact security posture our Fortune 50 clients demanded.',
        personName: 'Elena Rostova',
        designation: 'Chief Technology Officer',
        company: 'Apex Cloud Systems',
        photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
      },
      {
        id: 'test_rahul_2',
        quote: 'A rare leader who bridges deep distributed systems engineering with executive business acumen. Working with Rahul elevated our entire technical capability.',
        personName: 'Marcus Vance',
        designation: 'Chief Operations Officer',
        company: 'Nexus Global Logistics',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      },
    ],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/rahul-sharma-sales-leader',
      twitter: 'https://twitter.com/rahul_sharma_tech',
      github: 'https://github.com/rahul-sharma-arch',
      website: 'https://rahulsharma.me',
      medium: 'https://medium.com/@rahul.sharma.cloud',
      portfolio: 'https://rahulsharma.me/architecture',
    },
    updatedAt: now,
  },
  {
    id: 'emp_acme_sarah',
    employeeId: 'emp_acme_sarah',
    companyId: 'company_acme',
    headline: 'Connecting technical innovation with human customer value and high-growth brand equity.',
    about: 'Director of Brand & Product Marketing specializing in B2B enterprise narratives, event marketing campaigns, and global go-to-market strategies.',
    philosophy: 'Great technology creates capability; great narrative creates category leadership.',
    location: 'San Francisco, CA',
    metrics: [
      { label: 'Product Launches', value: '18 Global' },
      { label: 'Event Reach', value: '500k+ Visitors' },
      { label: 'Brand Recognition', value: 'Top 10 SaaS' },
      { label: 'Years in Brand', value: '11+ Yrs' },
    ],
    expertise: ['Brand Architecture', 'Product Marketing', 'Event Sponsorships', 'Field Campaigns', 'Growth Marketing', 'Category Creation'],
    skillCategories: [
      {
        categoryName: 'Brand Strategy',
        skills: ['Category Positioning', 'Executive Communications', 'Brand Identity Systems', 'Narrative Design'],
      },
      {
        categoryName: 'Campaign Execution',
        skills: ['Global Events & Expos', 'Digital Performance Marketing', 'Product Hunt Launches', 'Partner Ecosystems'],
      },
    ],
    services: [
      {
        id: 'srv_sarah_1',
        title: 'B2B Category Positioning & Narrative',
        description: 'Developing high-conviction messaging frameworks and market positioning for enterprise software companies.',
        deliveryMode: 'Advisory',
      },
      {
        id: 'srv_sarah_2',
        title: 'Global Event Marketing Strategy',
        description: 'End-to-end conference booth architecture, digital business card integration, and lead capture acceleration.',
        deliveryMode: 'Consulting',
      },
    ],
    experiences: [
      {
        id: 'exp_sarah_1',
        organization: 'Acme Innovations Inc.',
        role: 'Director of Brand & Product Marketing',
        startDate: '2023',
        endDate: 'Present',
        isCurrent: true,
        location: 'San Francisco, CA',
        description: 'Leading global brand architecture and field marketing campaigns across North America and Europe.',
        achievements: [
          'Architected Global Tech Expo campaign generating 420+ qualified enterprise leads.',
          'Unified brand design language across digital cards, enterprise portals, and mobile experiences.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_sarah_1',
        institution: 'Northwestern University',
        qualification: 'Bachelor of Science (B.S.)',
        field: 'Marketing & Strategic Communications',
        startDate: '2011',
        endDate: '2015',
      },
    ],
    credentials: [
      { title: 'Executive Marketing Leadership Certification', issuer: 'Kellogg Executive Education', year: '2024' },
    ],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/sarah-jenkins-brand',
      website: 'https://sarahjenkins.design',
      twitter: 'https://twitter.com/sarahjenkins_mktg',
    },
    updatedAt: now,
  },
  {
    id: 'emp_nexus_marcus',
    employeeId: 'emp_nexus_marcus',
    companyId: 'company_nexus',
    headline: 'Directing transatlantic container freight automation and real-time carrier networks.',
    about: 'Chief Operations Officer overseeing global multi-modal logistics, freight brokerage infrastructure, and supply chain telemetry.',
    philosophy: 'Operational excellence is the discipline of making complex global logistics feel effortless.',
    location: 'New York, NY • Chicago, IL',
    metrics: [
      { label: 'Freight Volume', value: '$1.4B Managed' },
      { label: 'Carrier Network', value: '12,000+ Ships' },
      { label: 'On-Time Rate', value: '99.4%' },
      { label: 'Operational Hubs', value: '24 Worldwide' },
    ],
    expertise: ['Supply Chain Operations', 'Maritime Logistics', 'Carrier Relations', 'Freight Optimization', 'Customs Telemetry'],
    skillCategories: [
      {
        categoryName: 'Logistics Operations',
        skills: ['Transatlantic Freight', 'Intermodal Rail Routing', 'Port Automation', 'Customs Brokerage'],
      },
      {
        categoryName: 'Executive Leadership',
        skills: ['Supply Chain Risk Management', 'Fleet Orchestration', 'Vendor Contracting', 'Crisis Mitigation'],
      },
    ],
    services: [
      {
        id: 'srv_marcus_1',
        title: 'Global Supply Chain Audit & Optimization',
        description: 'Comprehensive evaluation of international container routes, carrier contracts, and port clearance bottlenecks.',
        deliveryMode: 'Advisory',
      },
    ],
    experiences: [
      {
        id: 'exp_marcus_1',
        organization: 'Nexus Global Logistics',
        role: 'Chief Operations Officer',
        startDate: '2021',
        endDate: 'Present',
        isCurrent: true,
        location: 'New York, NY',
        description: 'Leading 24 global maritime and intermodal hubs managing over $1.4B in annual freight movement.',
        achievements: [
          'Reduced transatlantic transit variance by 26% using real-time telemetry systems.',
          'Standardized digital exchange protocols across 150+ international partner port authorities.',
        ],
      },
    ],
    education: [
      {
        id: 'edu_marcus_1',
        institution: 'Columbia University',
        qualification: 'Master of Business Administration (MBA)',
        field: 'Operations & Global Logistics',
        startDate: '2014',
        endDate: '2016',
      },
    ],
    credentials: [
      { title: 'Certified Supply Chain Professional (CSCP)', issuer: 'APICS', year: '2023' },
    ],
    testimonials: [
      {
        id: 'test_marcus_1',
        quote: 'Marcus transformed our supply chain resilience. During major port congestions, his proactive routing saved us millions.',
        personName: 'David Vance',
        designation: 'Managing Director',
        company: 'Atlantic Freight Partners',
      },
    ],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/marcus-vance-ops',
      website: 'https://nexus-global.example.com/leadership',
    },
    updatedAt: now,
  },
];


const DEMO_STORAGE_KEY = 'dsbc_demo_store_v2';

// Helper memory store class with localStorage persistence
class DemoDataStore {
  private companies: Company[] = [...INITIAL_DEMO_COMPANIES];
  private departments: Department[] = [...INITIAL_DEMO_DEPARTMENTS];
  private employees: Employee[] = [...INITIAL_DEMO_EMPLOYEES];
  private cards: Card[] = [...INITIAL_DEMO_CARDS];
  private events: Event[] = [...INITIAL_DEMO_EVENTS];
  private campaigns: Campaign[] = [...INITIAL_DEMO_CAMPAIGNS];
  private leads: Lead[] = [...INITIAL_DEMO_LEADS];
  private leadNotes: CompanyLeadNote[] = [...INITIAL_DEMO_LEAD_NOTES];
  private leadEvents: LeadEvent[] = [...INITIAL_DEMO_LEAD_EVENTS];
  private digitalProfiles: DigitalIdentityProfile[] = [...INITIAL_DEMO_PROFILES];

  constructor() {
    this.hydrateFromLocalStorage();
  }

  private hydrateFromLocalStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.companies && Array.isArray(parsed.companies)) {
        this.companies = parsed.companies;
      }
      if (parsed.departments && Array.isArray(parsed.departments)) {
        this.departments = parsed.departments;
      }
      if (parsed.employees && Array.isArray(parsed.employees)) {
        this.employees = parsed.employees;
      }
      if (parsed.cards && Array.isArray(parsed.cards)) {
        this.cards = parsed.cards;
      }
      if (parsed.events && Array.isArray(parsed.events)) {
        this.events = parsed.events;
      }
      if (parsed.campaigns && Array.isArray(parsed.campaigns)) {
        this.campaigns = parsed.campaigns;
      }
      if (parsed.leads && Array.isArray(parsed.leads)) {
        this.leads = parsed.leads;
      }
      if (parsed.leadNotes && Array.isArray(parsed.leadNotes)) {
        this.leadNotes = parsed.leadNotes;
      }
      if (parsed.leadEvents && Array.isArray(parsed.leadEvents)) {
        this.leadEvents = parsed.leadEvents;
      }
      if (parsed.digitalProfiles && Array.isArray(parsed.digitalProfiles)) {
        this.digitalProfiles = parsed.digitalProfiles;
      }
    } catch (e) {
      console.warn('Failed to hydrate demoStore from localStorage:', e);
    }
  }

  private persist(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const data = {
        companies: this.companies,
        departments: this.departments,
        employees: this.employees,
        cards: this.cards,
        events: this.events,
        campaigns: this.campaigns,
        leads: this.leads,
        leadNotes: this.leadNotes,
        leadEvents: this.leadEvents,
        digitalProfiles: this.digitalProfiles,
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist demoStore to localStorage:', e);
    }
  }

  // Companies
  getCompanies(): Company[] {
    return this.companies;
  }
  getCompanyById(id: string): Company | null {
    return this.companies.find((c) => c.id === id) || null;
  }
  createCompany(company: Company): Company {
    const idx = this.companies.findIndex((c) => c.id === company.id);
    if (idx >= 0) {
      this.companies[idx] = company;
    } else {
      this.companies.push(company);
    }
    this.persist();
    return company;
  }
  updateCompany(id: string, updates: Partial<Company>): Company | null {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.companies[idx] = { ...this.companies[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.companies[idx];
    } else {
      const newCompany: Company = {
        id,
        name: updates.name || 'Organization Entity',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...updates,
      } as Company;
      this.companies.push(newCompany);
      this.persist();
      return newCompany;
    }
  }

  // Departments
  getDepartmentsByCompany(companyId: string): Department[] {
    return this.departments.filter((d) => d.companyId === companyId);
  }
  getDepartmentById(id: string): Department | null {
    return this.departments.find((d) => d.id === id) || null;
  }
  createDepartment(dept: Department): Department {
    this.departments.push(dept);
    this.persist();
    return dept;
  }
  updateDepartment(id: string, updates: Partial<Department>): Department | null {
    const idx = this.departments.findIndex((d) => d.id === id);
    if (idx >= 0) {
      this.departments[idx] = { ...this.departments[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.departments[idx];
    }
    return null;
  }
  deleteDepartment(id: string): void {
    this.departments = this.departments.filter((d) => d.id !== id);
    this.persist();
  }

  // Employees
  getAllEmployees(): Employee[] {
    return this.employees;
  }
  getEmployeesByCompany(companyId: string): Employee[] {
    return this.employees.filter((e) => e.companyId === companyId);
  }
  getEmployeeById(id: string): Employee | null {
    return this.employees.find((e) => e.id === id) || null;
  }
  createEmployee(emp: Employee): Employee {
    const idx = this.employees.findIndex((e) => e.id === emp.id);
    if (idx >= 0) {
      this.employees[idx] = emp;
    } else {
      this.employees.push(emp);
    }
    this.persist();
    return emp;
  }
  updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    const idx = this.employees.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.employees[idx] = { ...this.employees[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.employees[idx];
    }
    return null;
  }

  // Cards
  getCards(): Card[] {
    return this.cards;
  }
  getCardById(id: string): Card | null {
    return this.cards.find((c) => c.id === id) || null;
  }
  getCardBySlug(slug: string): Card | null {
    return this.cards.find((c) => c.publicSlug === slug) || null;
  }
  createCard(card: Card): Card {
    const idx = this.cards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      this.cards[idx] = card;
    } else {
      this.cards.push(card);
    }
    this.persist();
    return card;
  }
  updateCard(id: string, updates: Partial<Card>): Card | null {
    const idx = this.cards.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.cards[idx] = { ...this.cards[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.cards[idx];
    }
    return null;
  }

  // Events
  getEventsByCompany(companyId: string): Event[] {
    return this.events.filter((e) => e.companyId === companyId);
  }
  getEventById(id: string): Event | null {
    return this.events.find((e) => e.id === id) || null;
  }
  createEvent(event: Event): Event {
    this.events.push(event);
    this.persist();
    return event;
  }
  updateEvent(id: string, updates: Partial<Event>): Event | null {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.events[idx] = { ...this.events[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.events[idx];
    }
    return null;
  }

  // Campaigns
  getCampaignsByCompany(companyId: string): Campaign[] {
    return this.campaigns.filter((c) => c.companyId === companyId);
  }
  getCampaignById(id: string): Campaign | null {
    return this.campaigns.find((c) => c.id === id) || null;
  }
  createCampaign(campaign: Campaign): Campaign {
    this.campaigns.push(campaign);
    this.persist();
    return campaign;
  }
  updateCampaign(id: string, updates: Partial<Campaign>): Campaign | null {
    const idx = this.campaigns.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.campaigns[idx] = { ...this.campaigns[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.campaigns[idx];
    }
    return null;
  }

  // Leads
  getLeadsByCompany(companyId: string): Lead[] {
    return this.leads.filter((l) => l.companyId === companyId);
  }
  getLeadById(id: string): Lead | null {
    return this.leads.find((l) => l.id === id) || null;
  }
  createLead(lead: Lead): Lead {
    this.leads.push(lead);
    this.persist();
    return lead;
  }
  updateLead(id: string, updates: Partial<Lead>): Lead | null {
    const idx = this.leads.findIndex((l) => l.id === id);
    if (idx >= 0) {
      this.leads[idx] = { ...this.leads[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.leads[idx];
    }
    return null;
  }

  // Lead Notes
  getLeadNotes(leadId: string): CompanyLeadNote[] {
    return this.leadNotes.filter((n) => n.leadId === leadId);
  }
  createLeadNote(note: CompanyLeadNote): CompanyLeadNote {
    this.leadNotes.push(note);
    this.persist();
    return note;
  }

  // Lead Events
  getLeadEvents(leadId: string): LeadEvent[] {
    return this.leadEvents.filter((e) => e.leadId === leadId);
  }
  createLeadEvent(evt: LeadEvent): LeadEvent {
    this.leadEvents.push(evt);
    this.persist();
    return evt;
  }

  // Digital Identity Profiles
  getDigitalIdentityProfile(employeeId: string): DigitalIdentityProfile | null {
    return this.digitalProfiles.find((p) => p.employeeId === employeeId) || null;
  }
  saveDigitalIdentityProfile(profile: DigitalIdentityProfile): DigitalIdentityProfile {
    const idx = this.digitalProfiles.findIndex((p) => p.employeeId === profile.employeeId);
    if (idx >= 0) {
      this.digitalProfiles[idx] = { ...this.digitalProfiles[idx], ...profile, updatedAt: new Date().toISOString() };
    } else {
      this.digitalProfiles.push(profile);
    }
    this.persist();
    return profile;
  }
}

// ============================================================================
// Directive 26 demo-data policy
// ============================================================================
// Demo data exists only for DEVELOPMENT demo personas: demo features enabled
// (vite dev) AND no Firebase session. For a signed-in customer, or in any
// production build, every demoStore call throws, so a failed Firestore read or
// write can never be silently replaced by sample data.
export class DemoDataBlockedError extends Error {
  constructor(operation: string) {
    super(`The request could not be completed and was not saved (${operation}). Please try again; sample data is never substituted for your data.`);
    this.name = 'DemoDataBlockedError';
  }
}

export function demoDataAllowed(): boolean {
  return DEMO_FEATURES_ENABLED && !auth.currentUser;
}

const demoStoreImpl = new DemoDataStore();

export const demoStore: DemoDataStore = new Proxy(demoStoreImpl, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      if (!demoDataAllowed()) throw new DemoDataBlockedError(String(prop));
      return value.apply(target, args);
    };
  },
});
