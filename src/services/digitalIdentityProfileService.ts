import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DigitalIdentityProfile } from '../types/cardProfile';
import { demoStore } from './demoStore';

export async function getDigitalIdentityProfile(employeeId: string): Promise<DigitalIdentityProfile | null> {
  // Always check demoStore first or fallback
  if (!auth.currentUser || !db) {
    return demoStore.getDigitalIdentityProfile(employeeId);
  }

  try {
    const docRef = doc(db, 'digitalIdentityProfiles', employeeId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as DigitalIdentityProfile;
      demoStore.saveDigitalIdentityProfile(data);
      return data;
    }
    return demoStore.getDigitalIdentityProfile(employeeId);
  } catch (err) {
    console.warn('Falling back to demoStore for DigitalIdentityProfile:', err);
    return demoStore.getDigitalIdentityProfile(employeeId);
  }
}

export async function saveDigitalIdentityProfile(profile: DigitalIdentityProfile): Promise<DigitalIdentityProfile> {
  // Save in demo store always for local persistence and immediate offline consistency
  demoStore.saveDigitalIdentityProfile(profile);

  if (!auth.currentUser || !db) {
    return profile;
  }

  try {
    const docRef = doc(db, 'digitalIdentityProfiles', profile.employeeId);
    await setDoc(docRef, profile, { merge: true });
  } catch (err) {
    console.error('Error saving digital identity profile to Firestore:', err);
  }

  return profile;
}
