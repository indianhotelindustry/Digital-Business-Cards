import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Company, CompanyStatus } from '../types';
import { demoStore } from './demoStore';

const COMPANIES_COLLECTION = 'companies';

export async function getAllCompanies(): Promise<Company[]> {
  if (!auth.currentUser) {
    return demoStore.getCompanies();
  }

  try {
    const colRef = collection(db, COMPANIES_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Company[];
  } catch (err) {
    console.error('Error fetching companies:', err);
    return demoStore.getCompanies();
  }
}

export async function getCompanyById(companyId: string): Promise<Company | null> {
  try {
    const docRef = doc(db, COMPANIES_COLLECTION, companyId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return demoStore.getCompanyById(companyId);
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Company;
  } catch (err) {
    return demoStore.getCompanyById(companyId);
  }
}

export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  const normalizedSlug = slug.toLowerCase().trim();
  const all = await getAllCompanies();
  
  // 1. Direct ID match
  const byId = all.find((c) => c.id.toLowerCase() === normalizedSlug);
  if (byId) return byId;

  // 2. Stripped id match (e.g. 'company_acme' -> 'acme')
  const byStrippedId = all.find((c) => c.id.replace('company_', '').toLowerCase() === normalizedSlug);
  if (byStrippedId) return byStrippedId;

  // 3. Known predefined mappings
  if (normalizedSlug === 'acme-innovations' || normalizedSlug === 'acme') {
    const acme = all.find((c) => c.id === 'company_acme' || c.name.toLowerCase().includes('acme'));
    if (acme) return acme;
  }
  if (normalizedSlug === 'nexus-global' || normalizedSlug === 'nexus') {
    const nexus = all.find((c) => c.id === 'company_nexus' || c.name.toLowerCase().includes('nexus'));
    if (nexus) return nexus;
  }

  // 4. Name to slug match
  const byName = all.find((c) => {
    const genSlug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return genSlug === normalizedSlug || genSlug.includes(normalizedSlug) || normalizedSlug.includes(genSlug);
  });
  if (byName) return byName;

  return null;
}

export async function createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>, customId?: string): Promise<Company> {
  const colRef = collection(db, COMPANIES_COLLECTION);
  const docRef = customId ? doc(db, COMPANIES_COLLECTION, customId) : doc(colRef);
  const now = new Date().toISOString();

  const newCompany: Company = {
    ...data,
    id: docRef.id,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };

  if (!auth.currentUser) {
    demoStore.updateCompany(newCompany.id, newCompany);
    return newCompany;
  }

  try {
    await setDoc(docRef, newCompany);
    return newCompany;
  } catch (err) {
    console.warn('Firestore createCompany rejected; saving to demoStore:', err);
    demoStore.updateCompany(newCompany.id, newCompany);
    return newCompany;
  }
}

export async function updateCompany(companyId: string, updates: Partial<Company>): Promise<void> {
  if (!auth.currentUser) {
    demoStore.updateCompany(companyId, updates);
    return;
  }

  try {
    const docRef = doc(db, COMPANIES_COLLECTION, companyId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore updateCompany rejected; updating in demoStore:', err);
    demoStore.updateCompany(companyId, updates);
  }
}


export async function setCompanyStatus(companyId: string, status: CompanyStatus): Promise<void> {
  await updateCompany(companyId, { status });
}
