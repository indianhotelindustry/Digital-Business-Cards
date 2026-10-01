import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AnalyticsEvent, AnalyticsEventType } from '../types';

const ANALYTICS_COLLECTION = 'analytics';

export async function recordAnalyticsEvent(
  companyId: string,
  employeeId: string,
  cardId: string,
  eventType: AnalyticsEventType,
  metadata?: Record<string, any>
): Promise<void> {
  if (!auth.currentUser) {
    // Non-blocking telemetry in demo mode
    return;
  }
  try {
    const colRef = collection(db, ANALYTICS_COLLECTION);
    const docRef = doc(colRef);
    const event: AnalyticsEvent = {
      id: docRef.id,
      companyId,
      employeeId,
      cardId,
      eventType,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    };
    await setDoc(docRef, event);
  } catch (err) {
    // Non-blocking telemetry
    console.warn('Analytics logging failed:', err);
  }
}

export async function getCompanyAnalytics(companyId: string): Promise<AnalyticsEvent[]> {
  if (!auth.currentUser) {
    return [];
  }

  try {
    const colRef = collection(db, ANALYTICS_COLLECTION);
    const q = query(
      colRef,
      where('companyId', '==', companyId),
      limit(150)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AnalyticsEvent[];
    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.error(`Error fetching analytics for company ${companyId}:`, err);
    return [];
  }
}

export const getAnalyticsByCompany = getCompanyAnalytics;

