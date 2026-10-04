import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  updateProfile as updateAuthProfile,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AccountType, UserProfile } from '../types';
import { buildRegistrationDocuments } from './registrationModel';
import { INITIAL_ACCOUNT_STATUS } from '../../shared/domain/accountStatus';
import { describeVerificationError, sendVerificationEmail, type VerificationError } from './emailVerification';

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

export interface RegistrationResult {
  profile: UserProfile;
  verificationEmailSent: boolean;
  verificationError: VerificationError | null;
}

/**
 * Register a new account (Directive 24 Phase 2).
 *
 * The caller supplies identity and the requested account type only. Role,
 * tenant, companyId and plan are derived by registrationModel and re-checked
 * by firestore.rules. Profile, tenant (and company) are written in one batch.
 * If that batch is rejected the just-created Auth user is deleted so no
 * half-registered account remains — registration fails closed.
 *
 * Directive 29: once the profile exists, Firebase sends a verification
 * email. The account starts unverified; verification never grants authority
 * by itself (App Owner additionally needs the server-set claim). A failed
 * send does not undo the registration: the account is complete and the user
 * can resend from the verification banner.
 */

export async function registerAccount(params: {
  email: string;
  password: string;
  displayName: string;
  accountType: AccountType;
  companyName?: string;
}): Promise<RegistrationResult> {
  const credential = await createUserWithEmailAndPassword(auth, params.email, params.password);
  const user = credential.user;
  let profile: UserProfile;

  try {
    await updateAuthProfile(user, { displayName: params.displayName });

    // Use the email as normalised by Firebase Auth; the rules compare against
    // the ID token's email claim.
    const docs = buildRegistrationDocuments({
      uid: user.uid,
      email: user.email || params.email,
      displayName: params.displayName,
      accountType: params.accountType,
      companyName: params.companyName,
      status: INITIAL_ACCOUNT_STATUS,
    });

    const batch = writeBatch(db);
    if (docs.company) batch.set(doc(db, 'companies', docs.company.id), docs.company);
    batch.set(doc(db, 'tenants', docs.tenant.id), docs.tenant);
    batch.set(doc(db, USERS_COLLECTION, user.uid), docs.user);
    await batch.commit();
    profile = docs.user;
  } catch (err) {
    try {
      await deleteUser(user);
    } catch (cleanupErr) {
      console.error('Registration rollback failed; account has no profile:', cleanupErr);
    }
    throw err;
  }

  try {
    await sendVerificationEmail(user);
    return { profile, verificationEmailSent: true, verificationError: null };
  } catch (err) {
    console.error('Verification email could not be sent:', err);
    return { profile, verificationEmailSent: false, verificationError: describeVerificationError(err) };
  }
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}
