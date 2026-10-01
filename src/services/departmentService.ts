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
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Department, DepartmentStatus } from '../types';
import { demoStore } from './demoStore';

const DEPARTMENTS_COLLECTION = 'departments';

export async function getDepartmentsByCompany(companyId: string): Promise<Department[]> {
  // If not authenticated in Firebase Auth, safely read from demoStore to prevent unauthenticated rules rejection
  if (!auth.currentUser) {
    return demoStore.getDepartmentsByCompany(companyId);
  }

  try {
    const colRef = collection(db, DEPARTMENTS_COLLECTION);
    const q = query(colRef, where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const depts = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Department[];
    // Sort in memory by name
    return depts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error(`Error fetching departments for company ${companyId}:`, err);
    // Graceful fallback to demo data if permission denied in demo preview
    return demoStore.getDepartmentsByCompany(companyId);
  }
}

export async function getDepartmentById(deptId: string): Promise<Department | null> {
  if (!auth.currentUser) {
    return demoStore.getDepartmentById(deptId);
  }

  try {
    const docRef = doc(db, DEPARTMENTS_COLLECTION, deptId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return demoStore.getDepartmentById(deptId);
    return { id: snap.id, ...snap.data() } as Department;
  } catch (err) {
    return demoStore.getDepartmentById(deptId);
  }
}

export async function createDepartment(
  data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>,
  customId?: string
): Promise<Department> {
  const colRef = collection(db, DEPARTMENTS_COLLECTION);
  const docRef = customId ? doc(db, DEPARTMENTS_COLLECTION, customId) : doc(colRef);
  const now = new Date().toISOString();

  const dept: Department = {
    ...data,
    id: docRef.id,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };

  if (!auth.currentUser) {
    return demoStore.createDepartment(dept);
  }

  try {
    await setDoc(docRef, dept);
    return dept;
  } catch (err) {
    console.warn('Firestore createDepartment rejected under demo auth; stored in demo store:', err);
    return demoStore.createDepartment(dept);
  }
}

export async function updateDepartment(deptId: string, updates: Partial<Department>): Promise<void> {
  if (!auth.currentUser) {
    demoStore.updateDepartment(deptId, updates);
    return;
  }

  try {
    const docRef = doc(db, DEPARTMENTS_COLLECTION, deptId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore updateDepartment rejected; updated in demo store:', err);
    demoStore.updateDepartment(deptId, updates);
  }
}

export async function deleteDepartment(deptId: string): Promise<void> {
  if (!auth.currentUser) {
    demoStore.deleteDepartment(deptId);
    return;
  }

  try {
    const docRef = doc(db, DEPARTMENTS_COLLECTION, deptId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore deleteDepartment rejected; deleted in demo store:', err);
    demoStore.deleteDepartment(deptId);
  }
}

