import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

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

// Directive 34: accounts are created only by the backend (registerIndividual /
// registerCompany callables). The browser no longer writes users, tenants or
// companies, and email/password is sign-in only for existing accounts.

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}
