import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Company, Department, Employee, Card, CardTemplate, UserProfile, Contact, Connection, RelationshipNote, FollowUp, ConnectionEvent } from '../types';
import { DEFAULT_TEMPLATES } from './cardService';

export const DEMO_USERS = {
  appOwner: {
    id: 'user_app_owner_demo',
    email: 'owner@saas-cards.io',
    displayName: 'Alex Thorne (App Owner)',
    role: 'app_owner' as const,
    companyId: null,
    employeeId: null,
    status: 'active' as const,
  },
  companyAdminAcme: {
    id: 'user_admin_acme_demo',
    email: 'admin@acme-innovations.com',
    displayName: 'David Vance (Acme Admin)',
    role: 'company_admin' as const,
    companyId: 'company_acme',
    employeeId: null,
    status: 'active' as const,
  },
  companyAdminNexus: {
    id: 'user_admin_nexus_demo',
    email: 'admin@nexus-global.org',
    displayName: 'Rachel Chen (Nexus Admin)',
    role: 'company_admin' as const,
    companyId: 'company_nexus',
    employeeId: null,
    status: 'active' as const,
  },
  employeeRahul: {
    id: 'user_emp_rahul_demo',
    email: 'rahul.sharma@acme-innovations.com',
    displayName: 'Rahul Sharma',
    role: 'employee' as const,
    companyId: 'company_acme',
    employeeId: 'emp_acme_rahul',
    status: 'active' as const,
  },
};

export const DEMO_COMPANIES = {
  acme: {
    id: 'company_acme',
    name: 'Acme Innovations Inc.',
    slug: 'acme-innovations',
  },
  nexus: {
    id: 'company_nexus',
    name: 'Nexus Global Logistics',
    slug: 'nexus-global',
  },
};

export const DEMO_EMPLOYEES = {
  rahul: {
    id: 'emp_acme_rahul',
    companyId: 'company_acme',
    name: 'Rahul Sharma',
  },
  priya: {
    id: 'emp_acme_priya',
    companyId: 'company_acme',
    name: 'Priya Patel',
  },
  marcus: {
    id: 'emp_nexus_marcus',
    companyId: 'company_nexus',
    name: 'Marcus Vance',
  },
  elena: {
    id: 'emp_nexus_elena',
    companyId: 'company_nexus',
    name: 'Elena Rostova',
  },
};

export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const acmeRef = doc(db, 'companies', 'company_acme');
    const snap = await getDoc(acmeRef);
    return snap.exists();
  } catch (err) {
    return false;
  }
}

export type DemoSeedWriter = (collectionName: string, id: string, data: object) => Promise<void>;

/**
 * Legacy client-SDK seeding. Since Directive 24 Phase 3 the Firestore rules no
 * longer allow unauthenticated bootstrap writes, so this only succeeds where
 * rules permit it. Demo data is created by `npm run seed`
 * (scripts/admin/seedDemoData.ts, Admin SDK, never production).
 */
export async function seedInitialSaaSData(): Promise<{ success: boolean; message: string }> {
  return writeDemoSeedData((collectionName, id, data) => setDoc(doc(db, collectionName, id), data));
}

/** Writes the complete demo dataset through `write` (DEVELOPMENT/emulator only). */
export async function writeDemoSeedData(write: DemoSeedWriter): Promise<{ success: boolean; message: string }> {
  try {
    const now = new Date().toISOString();

    // 1. Templates
    for (const tpl of DEFAULT_TEMPLATES) {
      await write('cardTemplates', tpl.id, tpl);
    }

    // 2. Company A: Acme Innovations
    const companyAcme: Company = {
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
        primaryColor: '#0f766e', // Deep Teal
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
    };
    await write('companies', 'company_acme', companyAcme);

    // 3. Company B: Nexus Global
    const companyNexus: Company = {
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
        primaryColor: '#2563eb', // Vivid Royal Blue
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
    };
    await write('companies', 'company_nexus', companyNexus);

    // 4. Departments for Acme
    const deptSalesAcme: Department = {
      id: 'dept_acme_sales',
      companyId: 'company_acme',
      name: 'Sales & Strategic Accounts',
      description: 'Global enterprise direct sales and key partnership development.',
      departmentHeadEmployeeId: 'emp_acme_rahul',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const deptMktAcme: Department = {
      id: 'dept_acme_marketing',
      companyId: 'company_acme',
      name: 'Marketing & Brand Strategy',
      description: 'Growth marketing, brand narrative, and public relations.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const deptHrAcme: Department = {
      id: 'dept_acme_hr',
      companyId: 'company_acme',
      name: 'People Operations & HR',
      description: 'Global talent acquisition, employee experience, and compliance.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await write('departments', deptSalesAcme.id, deptSalesAcme);
    await write('departments', deptMktAcme.id, deptMktAcme);
    await write('departments', deptHrAcme.id, deptHrAcme);

    // 5. Departments for Nexus
    const deptOpsNexus: Department = {
      id: 'dept_nexus_ops',
      companyId: 'company_nexus',
      name: 'Global Operations',
      description: 'Fleet orchestration and automated port routing systems.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const deptSalesNexus: Department = {
      id: 'dept_nexus_sales',
      companyId: 'company_nexus',
      name: 'Enterprise Brokerage',
      description: 'North American carrier relationships and freight sales.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await write('departments', deptOpsNexus.id, deptOpsNexus);
    await write('departments', deptSalesNexus.id, deptSalesNexus);

    // 6. Employees for Acme
    const empRahul: Employee = {
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
    };
    const cardRahul: Card = {
      id: 'card_acme_rahul',
      companyId: 'company_acme',
      employeeId: 'emp_acme_rahul',
      templateId: 'classic',
      publicSlug: 'rahul-sharma',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const empSarah: Employee = {
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
    };
    const cardSarah: Card = {
      id: 'card_acme_sarah',
      companyId: 'company_acme',
      employeeId: 'emp_acme_sarah',
      templateId: 'modern',
      publicSlug: 'sarah-jenkins',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    // 7. Employees for Nexus
    const empMarcus: Employee = {
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
    };
    const cardMarcus: Card = {
      id: 'card_nexus_marcus',
      companyId: 'company_nexus',
      employeeId: 'emp_nexus_marcus',
      templateId: 'minimal',
      publicSlug: 'marcus-vance',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await write('employees', empRahul.id, empRahul);
    await write('cards', cardRahul.id, cardRahul);

    await write('employees', empSarah.id, empSarah);
    await write('cards', cardSarah.id, cardSarah);

    await write('employees', empMarcus.id, empMarcus);
    await write('cards', cardMarcus.id, cardMarcus);

    // 8. Demo User accounts in Firestore
    for (const [key, user] of Object.entries(DEMO_USERS)) {
      const uProfile: UserProfile = {
        ...user,
        createdAt: now,
        updatedAt: now,
      };
      await write('users', user.id, uProfile);
    }

    // 9. V2 Connect Data: Contacts, Connections, Notes, Follow-ups
    // Contacts for Rahul Sharma
    const contactMarcus: Contact = {
      id: 'contact_rahul_marcus',
      ownerUserId: DEMO_USERS.employeeRahul.id,
      sourceType: 'dsbc_card',
      linkedIdentityId: empMarcus.id,
      linkedCardId: cardMarcus.id,
      displayName: 'Marcus Vance',
      companyName: 'Nexus Global Logistics',
      jobTitle: 'Chief Operations Officer',
      email: 'm.vance@nexus-global.org',
      phone: '+1 (212) 555-8890',
      website: 'https://nexus-global.example.com',
      notesSummary: 'Lead contact for transatlantic supply chain contract.',
      createdAt: now,
      updatedAt: now,
    };
    await write('contacts', contactMarcus.id, contactMarcus);

    const contactPriya: Contact = {
      id: 'contact_rahul_priya',
      ownerUserId: DEMO_USERS.employeeRahul.id,
      sourceType: 'manual',
      displayName: 'Priya Nair',
      companyName: 'Apex Cloud Systems',
      jobTitle: 'VP Enterprise Architecture',
      email: 'priya.nair@apexcloud.io',
      phone: '+1 (415) 555-0182',
      notesSummary: 'Met at Cloud Expo 2026. Evaluating our API platform.',
      createdAt: now,
      updatedAt: now,
    };
    await write('contacts', contactPriya.id, contactPriya);

    // Connections
    const connMarcus: Connection = {
      id: 'conn_rahul_marcus',
      connectionVersion: 'v2.0',
      requesterUserId: DEMO_USERS.employeeRahul.id,
      recipientUserId: DEMO_USERS.companyAdminNexus.id,
      requesterIdentityId: empRahul.id,
      recipientIdentityId: empMarcus.id,
      requesterName: 'Marcus Vance',
      requesterCompany: 'Nexus Global Logistics',
      requesterTitle: 'Chief Operations Officer',
      requesterEmail: 'm.vance@nexus-global.org',
      requesterPhone: '+1 (212) 555-8890',
      requesterCompanyId: 'company_nexus',
      recipientCompanyId: 'company_acme',
      status: 'accepted',
      initiatedBy: DEMO_USERS.employeeRahul.id,
      exchangeMethod: 'qr_scan',
      consentState: 'accepted',
      sharedCategories: ['profile', 'company', 'job_title', 'phone', 'email', 'website'],
      initialNote: 'Connected after keynote presentation at the Global Logistics Summit.',
      createdAt: now,
      updatedAt: now,
      acceptedAt: now,
      lastInteractionAt: now,
    };
    await write('connections', connMarcus.id, connMarcus);

    const connSarahIncoming: Connection = {
      id: 'conn_rahul_sarah_incoming',
      connectionVersion: 'v2.0',
      requesterUserId: 'visitor_sarah_chen',
      recipientUserId: DEMO_USERS.employeeRahul.id,
      requesterIdentityId: 'visitor_sarah_chen',
      recipientIdentityId: empRahul.id,
      requesterName: 'Sarah Chen',
      requesterCompany: 'Vertex AI Labs',
      requesterTitle: 'Head of Developer Relations',
      requesterEmail: 'sarah.chen@vertex-ai.example.com',
      requesterPhone: '+1 (408) 555-0144',
      requesterCompanyId: null,
      recipientCompanyId: 'company_acme',
      status: 'pending',
      initiatedBy: 'visitor_sarah_chen',
      exchangeMethod: 'card_exchange',
      consentState: 'requested',
      sharedCategories: ['profile', 'company', 'job_title', 'email', 'phone'],
      initialNote: 'Loved your digital business card demo! Would love to explore SDK integration.',
      createdAt: now,
      updatedAt: now,
      lastInteractionAt: now,
    };
    await write('connections', connSarahIncoming.id, connSarahIncoming);

    // Private Relationship Notes
    const note1: RelationshipNote = {
      id: 'note_rahul_marcus_1',
      ownerUserId: DEMO_USERS.employeeRahul.id,
      connectionId: connMarcus.id,
      content: 'Marcus indicated they are standardizing their digital business cards across 500 field engineers in Q3.',
      authorName: 'Rahul Sharma',
      createdAt: now,
      updatedAt: now,
    };
    await write('relationshipNotes', note1.id, note1);

    // Follow-ups
    const fu1: FollowUp = {
      id: 'fu_rahul_marcus_1',
      ownerUserId: DEMO_USERS.employeeRahul.id,
      connectionId: connMarcus.id,
      targetName: 'Marcus Vance',
      title: 'Send enterprise volume pricing and security whitepaper',
      dueAt: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      status: 'pending',
      notes: 'Ensure SOC2 and ISO27001 summary sheets are attached.',
      createdAt: now,
      updatedAt: now,
    };
    await write('followUps', fu1.id, fu1);

    const fu2: FollowUp = {
      id: 'fu_rahul_priya_1',
      ownerUserId: DEMO_USERS.employeeRahul.id,
      targetName: 'Priya Nair',
      title: 'Introductory discovery call on API architecture',
      dueAt: new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: 'Prepare Swagger documentation links.',
      createdAt: now,
      updatedAt: now,
    };
    await write('followUps', fu2.id, fu2);

    // Connection Events (Timeline)
    const evt1: ConnectionEvent = {
      id: 'cevt_seed_1',
      connectionId: connMarcus.id,
      participantUserIds: [DEMO_USERS.employeeRahul.id, DEMO_USERS.companyAdminNexus.id],
      eventType: 'CARD_SHARED',
      actorUserId: DEMO_USERS.employeeRahul.id,
      actorName: 'Rahul Sharma',
      description: 'Shared digital card via QR code scan',
      timestamp: now,
    };
    await write('connectionEvents', evt1.id, evt1);

    const evt2: ConnectionEvent = {
      id: 'cevt_seed_2',
      connectionId: connMarcus.id,
      participantUserIds: [DEMO_USERS.employeeRahul.id, DEMO_USERS.companyAdminNexus.id],
      eventType: 'CONNECTION_ACCEPTED',
      actorUserId: DEMO_USERS.companyAdminNexus.id,
      actorName: 'Marcus Vance',
      description: 'Accepted connection request and exchanged verified business profile',
      timestamp: now,
    };
    await write('connectionEvents', evt2.id, evt2);

    return {
      success: true,
      message: 'Successfully seeded SaaS database with Acme Innovations & Nexus Global tenants, departments, employees, digital cards, and DSBC Connect V2.0 foundation relationships.',
    };
  } catch (err: any) {
    console.error('Seeding error:', err);
    return {
      success: false,
      message: err.message || 'Failed to seed database',
    };
  }
}
