import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

// Directive 25: VITE_DSBC_USE_EMULATORS=true points the whole client (Auth,
// Firestore, Storage, Cloud Functions) at the local Firebase Emulator Suite
// (project demo-dsbc, default database) so nothing touches the live project.
export const USE_EMULATORS: boolean = import.meta.env?.VITE_DSBC_USE_EMULATORS === 'true';

// Configuration from firebase-applet-config.json
const liveConfig = {
  projectId: "v-nexus-lite",
  appId: "1:801214429564:web:6b4ce21ca9b2c009b08cf9",
  apiKey: "AIzaSyBfbd3Tslx4Lyj1XLAnQG7c34d-MDp8sT4",
  authDomain: "v-nexus-lite.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5",
  storageBucket: "v-nexus-lite.firebasestorage.app",
  messagingSenderId: "801214429564",
  measurementId: "",
  oAuthClientId: "801214429564-7lbbrvr6s534k5htn4jash1euk5ablur.apps.googleusercontent.com"
};

const firebaseConfig = USE_EMULATORS
  ? { ...liveConfig, projectId: 'demo-dsbc', authDomain: 'demo-dsbc.firebaseapp.com', storageBucket: 'demo-dsbc.appspot.com', firestoreDatabaseId: '' }
  : liveConfig;

/** Region of the DSBC Cloud Functions backend (functions/src/shared/config.ts). */
export const BACKEND_REGION = 'us-central1';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// Directive 26: optional form fields left empty are undefined; dropping them
// (instead of throwing) keeps writes on Firestore rather than failing.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId || undefined);
export const storage = getStorage(app);
export const functions = getFunctions(app, BACKEND_REGION);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9477', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  connectStorageEmulator(storage, '127.0.0.1', 9479);
  connectFunctionsEmulator(functions, '127.0.0.1', 5481);
}

export default app;
