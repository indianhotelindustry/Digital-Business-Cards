import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile as updateAuthProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

const USERS_COLLECTION = 'users';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (err) {
    console.error(`Error fetching user profile for ${userId}:`, err);
    return null;
  }
}

export async function createUserProfile(
  userId: string,
  data: {
    email: string;
    displayName: string;
    role: UserRole;
    companyId?: string | null;
    employeeId?: string | null;
  }
): Promise<UserProfile> {
  const userDocRef = doc(db, USERS_COLLECTION, userId);
  const now = new Date().toISOString();

  const profile: UserProfile = {
    id: userId,
    email: data.email,
    displayName: data.displayName || 'User',
    role: data.role,
    companyId: data.companyId || null,
    employeeId: data.employeeId || null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(userDocRef, profile);
  return profile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userDocRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile | null> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return getUserProfile(userCredential.user.uid);
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: UserRole = 'company_admin',
  companyId: string | null = null,
  employeeId: string | null = null
): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  await updateAuthProfile(userCredential.user, { displayName });

  const profile = await createUserProfile(userCredential.user.uid, {
    email,
    displayName,
    role,
    companyId,
    employeeId,
  });

  return profile;
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}
