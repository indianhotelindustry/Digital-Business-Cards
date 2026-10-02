import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DigitalIdentityProfile } from '../types/cardProfile';
import { demoDataAllowed, demoStore } from './demoStore';

// Directive 26: Firestore is the only store for a signed-in customer. The demo
// store is used only for DEVELOPMENT demo personas (no Firebase session).

export async function getDigitalIdentityProfile(employeeId: string): Promise<DigitalIdentityProfile | null> {
  if (!auth.currentUser) {
    return demoDataAllowed() ? demoStore.getDigitalIdentityProfile(employeeId) : null;
  }
  const snap = await getDoc(doc(db, 'digitalIdentityProfiles', employeeId));
  return snap.exists() ? (snap.data() as DigitalIdentityProfile) : null;
}

export async function saveDigitalIdentityProfile(profile: DigitalIdentityProfile): Promise<DigitalIdentityProfile> {
  if (!auth.currentUser) {
    if (!demoDataAllowed()) throw new Error('Sign in to save your profile.');
    demoStore.saveDigitalIdentityProfile(profile);
    return profile;
  }
  await setDoc(doc(db, 'digitalIdentityProfiles', profile.employeeId!), profile, { merge: true });
  return profile;
}
