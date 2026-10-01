import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { DEFAULT_TEMPLATES } from '../src/services/cardService';

async function seed() {
  console.log('Seeding initial SaaS data into live Firestore...');
  const now = new Date().toISOString();

  // 1. Templates
  for (const tpl of DEFAULT_TEMPLATES) {
    await setDoc(doc(db, 'cardTemplates', tpl.id), tpl);
    console.log(`- Template ${tpl.id} saved`);
  }

  // 2. Company Acme
  const companyAcme = {
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
      secondaryColor: '#14b8a6',
      accentColor: '#f59e0b',
      themeMode: 'light',
    },
    planId: 'enterprise',
    status: 'active',
    totalCardLimit: 50,
    activeCardCount: 2,
    createdAt: now,
    updatedAt: now,
  };

  // 3. Company Nexus
  const companyNexus = {
    id: 'company_nexus',
    name: 'Nexus Global Logistics',
    legalName: 'Nexus Global Logistics & Supply Chain Corp.',
    logoUrl: 'https://images.unsplash.com/photo-1516876437184-593fda40c7ce?w=200&auto=format&fit=crop&q=80',
    website: 'https://nexus-global.example.com',
    email: 'info@nexus-global.example.com',
    phone: '+1 (555) 890-1234',
    address: '100 Harbor Boulevard, Floor 14, Chicago, IL 60601',
    description: 'Autonomous global freight networks and AI-powered multi-modal logistics operations.',
    branding: {
      primaryColor: '#1e3a8a',
      secondaryColor: '#3b82f6',
      accentColor: '#10b981',
      themeMode: 'light',
    },
    planId: 'growth',
    status: 'active',
    totalCardLimit: 20,
    activeCardCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  // 4. Departments
  const deptAcmeEng = {
    id: 'dept_acme_eng',
    companyId: 'company_acme',
    name: 'Core Engineering',
    code: 'ENG',
    description: 'Software architecture, firmware, and infrastructure systems.',
    status: 'active',
    employeeCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  const deptNexusOps = {
    id: 'dept_nexus_leadership',
    companyId: 'company_nexus',
    name: 'Global Operations',
    code: 'OPS',
    description: 'Air, marine, and ground freight logistics.',
    status: 'active',
    employeeCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  // 5. Employees
  const empRahul = {
    id: 'emp_acme_rahul',
    companyId: 'company_acme',
    departmentId: 'dept_acme_eng',
    userId: 'user_emp_rahul_demo',
    firstName: 'Rahul',
    lastName: 'Sharma',
    displayName: 'Rahul Sharma',
    jobTitle: 'Principal Cloud Architect',
    email: 'rahul.sharma@acme-innovations.com',
    phone: '+1 (555) 789-0123',
    whatsapp: '+15557890123',
    bio: 'Architecting ultra-resilient distributed cloud services and multi-tenant architectures.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    website: 'https://rahulsharma.dev',
    linkedin: 'https://linkedin.com/in/rahul-sharma-demo',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const empMarcus = {
    id: 'emp_nexus_marcus',
    companyId: 'company_nexus',
    departmentId: 'dept_nexus_leadership',
    userId: 'user_admin_nexus_demo',
    firstName: 'Marcus',
    lastName: 'Vance',
    displayName: 'Marcus Vance',
    jobTitle: 'VP of Global Operations',
    email: 'marcus.v@nexus-global.example.com',
    phone: '+1 (555) 998-3321',
    bio: 'Directing real-time global freight corridors and automated supply chain hubs.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // 6. Cards
  const cardRahul = {
    id: 'card_acme_rahul',
    companyId: 'company_acme',
    employeeId: 'emp_acme_rahul',
    templateId: 'modern',
    publicSlug: 'rahul-sharma',
    status: 'active',
    viewCount: 142,
    saveCount: 38,
    shareCount: 19,
    qrCodeUrl: '',
    createdAt: now,
    updatedAt: now,
  };

  const cardMarcus = {
    id: 'card_nexus_marcus',
    companyId: 'company_nexus',
    employeeId: 'emp_nexus_marcus',
    templateId: 'classic',
    publicSlug: 'marcus-vance',
    status: 'active',
    viewCount: 89,
    saveCount: 22,
    shareCount: 11,
    qrCodeUrl: '',
    createdAt: now,
    updatedAt: now,
  };

  // 7. Users
  const userAppOwner = {
    id: 'user_app_owner_demo',
    email: 'owner@saas-cards.io',
    displayName: 'Alex Thorne (App Owner)',
    role: 'app_owner',
    companyId: null,
    employeeId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const userAcmeAdmin = {
    id: 'user_admin_acme_demo',
    email: 'admin@acme-innovations.com',
    displayName: 'David Vance (Acme Admin)',
    role: 'company_admin',
    companyId: 'company_acme',
    employeeId: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // Write in safe dependency order
  await setDoc(doc(db, 'users', userAppOwner.id), userAppOwner);
  await setDoc(doc(db, 'users', userAcmeAdmin.id), userAcmeAdmin);
  console.log('- Users created');

  await setDoc(doc(db, 'departments', deptAcmeEng.id), deptAcmeEng);
  await setDoc(doc(db, 'departments', deptNexusOps.id), deptNexusOps);
  console.log('- Departments created');

  await setDoc(doc(db, 'employees', empRahul.id), empRahul);
  await setDoc(doc(db, 'employees', empMarcus.id), empMarcus);
  console.log('- Employees created');

  await setDoc(doc(db, 'cards', cardRahul.id), cardRahul);
  await setDoc(doc(db, 'cards', cardMarcus.id), cardMarcus);
  console.log('- Cards created');

  // Finally create companies (sealing the bootstrap gate)
  await setDoc(doc(db, 'companies', companyNexus.id), companyNexus);
  await setDoc(doc(db, 'companies', companyAcme.id), companyAcme);
  console.log('- Companies created (bootstrap gate sealed)');

  console.log('✅ SEEDING COMPLETE');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ SEED ERROR:', err);
  process.exit(1);
});
