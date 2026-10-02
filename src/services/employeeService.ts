import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Employee, EmployeeStatus } from '../types';
import { createCard, findUniqueSlug, generateSlug, updateCard } from './cardService';
import { demoDataAllowed, demoStore } from './demoStore';

const EMPLOYEES_COLLECTION = 'employees';

export async function getAllEmployees(companyIdFilter?: string): Promise<Employee[]> {
  if (!auth.currentUser) {
    if (companyIdFilter && companyIdFilter !== 'all') {
      return demoStore.getEmployeesByCompany(companyIdFilter);
    }
    return demoStore.getAllEmployees();
  }

  try {
    const colRef = collection(db, EMPLOYEES_COLLECTION);
    const q =
      companyIdFilter && companyIdFilter !== 'all'
        ? query(colRef, where('companyId', '==', companyIdFilter))
        : query(colRef);
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Employee[];
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    console.warn('Error fetching all employees from Firestore, using demoStore fallback:', err);
    if (companyIdFilter && companyIdFilter !== 'all') {
      return demoStore.getEmployeesByCompany(companyIdFilter);
    }
    return demoStore.getAllEmployees();
  }
}

export async function getEmployeesByCompany(companyId: string): Promise<Employee[]> {
  if (!auth.currentUser) {
    return demoStore.getEmployeesByCompany(companyId);
  }

  try {
    const colRef = collection(db, EMPLOYEES_COLLECTION);
    const q = query(colRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Employee[];
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    console.error(`Error fetching employees for company ${companyId}:`, err);
    return demoStore.getEmployeesByCompany(companyId);
  }
}

export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return demoDataAllowed() ? demoStore.getEmployeeById(employeeId) : null;
    return { id: snap.id, ...snap.data() } as Employee;
  } catch (err) {
    return demoStore.getEmployeeById(employeeId);
  }
}

export async function createEmployee(
  data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'cardId'>,
  options?: {
    customId?: string;
    cardTemplateId?: 'classic' | 'modern' | 'minimal';
    customSlug?: string;
  }
): Promise<{ employee: Employee; cardId: string; publicSlug: string }> {
  const colRef = collection(db, EMPLOYEES_COLLECTION);
  const empDocRef = options?.customId ? doc(db, EMPLOYEES_COLLECTION, options.customId) : doc(colRef);
  const employeeId = empDocRef.id;

  const displayName =
    data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Employee';

  const now = new Date().toISOString();
  const rawSlug = options?.customSlug ? generateSlug(options.customSlug) : generateSlug(displayName);

  if (!auth.currentUser) {
    // DEVELOPMENT demo persona only (demoStore throws otherwise).
    const employee: Employee = { ...data, id: employeeId, displayName, status: data.status || 'active', createdAt: now, updatedAt: now };
    demoStore.createEmployee(employee);
    return { employee, cardId: '', publicSlug: rawSlug };
  }

  // Directive 26 order: the employee must exist before its card (the card rule
  // verifies the employee belongs to the same company). The slug is only a
  // candidate until the card is published through the backend.
  const uniqueSlug = await findUniqueSlug(rawSlug);
  const cardRef = doc(collection(db, 'cards'));
  const employee: Employee = {
    ...data,
    id: employeeId,
    displayName,
    cardId: cardRef.id,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(empDocRef, employee);
  const card = await createCard(
    {
      companyId: data.companyId,
      employeeId,
      templateId: options?.cardTemplateId || 'classic',
      publicSlug: uniqueSlug,
      status: data.status === 'inactive' ? 'inactive' : 'active',
    },
    cardRef.id
  );

  return {
    employee,
    cardId: card.id,
    publicSlug: uniqueSlug,
  };
}

export async function updateEmployee(
  employeeId: string,
  updates: Partial<Employee>
): Promise<void> {
  if (!auth.currentUser) {
    demoStore.updateEmployee(employeeId, updates);
    return;
  }

  try {
    const docRef = doc(db, EMPLOYEES_COLLECTION, employeeId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore updateEmployee rejected; updating in demoStore:', err);
    demoStore.updateEmployee(employeeId, updates);
  }
}

export async function setEmployeeStatus(
  employeeId: string,
  status: EmployeeStatus,
  cardId?: string
): Promise<void> {
  await updateEmployee(employeeId, { status });

  if (cardId) {
    await updateCard(cardId, {
      status: status === 'active' ? 'active' : 'inactive',
    });
  }
}

