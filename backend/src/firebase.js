import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  return undefined;
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: getCredential(),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });

export const adminAuth = getAuth(app);
export const adminDb = getDatabase(app);
