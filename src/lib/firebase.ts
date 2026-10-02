import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { currentEnvironment } from './environment';

// Directive 27: every Firebase setting comes from the deployment target this
// bundle was built for (config/environments.json via src/lib/environment.ts):
// project, named Firestore database, Storage bucket, Functions region and
// whether the local Emulator Suite is used. Nothing is hard-coded here and
// nothing can be changed at runtime. currentEnvironment() throws for a
// misconfigured bundle; src/main.tsx never loads the app in that case.
const env = currentEnvironment();

/** True only for the emulator-backed DEVELOPMENT target (demo-dsbc). */
export const USE_EMULATORS: boolean = env.useEmulators;

/** Region of the DSBC Cloud Functions backend (functions/src/shared/config.ts reads the same registry entry). */
export const BACKEND_REGION = env.functionsRegion;

const app = !getApps().length ? initializeApp({ ...env.firebase }) : getApp();

export const auth = getAuth(app);
// Directive 26: optional form fields left empty are undefined; dropping them
// (instead of throwing) keeps writes on Firestore rather than failing.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, env.firestoreDatabaseId || undefined);
export const storage = getStorage(app, `gs://${env.firebase.storageBucket}`);
export const functions = getFunctions(app, BACKEND_REGION);

if (env.useEmulators) {
  const e = env.emulators;
  connectAuthEmulator(auth, e.auth!, { disableWarnings: true });
  connectFirestoreEmulator(db, e.firestoreHost!, e.firestorePort!);
  connectStorageEmulator(storage, e.storageHost!, e.storagePort!);
  connectFunctionsEmulator(functions, e.functionsHost!, e.functionsPort!);
}

export default app;
