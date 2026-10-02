// Admin SDK handles. The Firestore database id comes from the deployment
// environment (DSBC_FIRESTORE_DATABASE, see functions/.env.*), never from a
// request. In the emulator it is "(default)".
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

export const DATABASE_ID = process.env.DSBC_FIRESTORE_DATABASE || '(default)';

const app = getApps()[0] ?? initializeApp();

let firestore: Firestore | null = null;
export function db(): Firestore {
  if (!firestore) {
    firestore = DATABASE_ID === '(default)' ? getFirestore(app) : getFirestore(app, DATABASE_ID);
  }
  return firestore;
}

export const adminAuth = () => getAuth(app);
export const bucket = () => getStorage(app).bucket();
