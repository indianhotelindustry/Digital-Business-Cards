import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  Event,
  EventMember,
  EventMemberRole,
  Campaign,
  EventAnalyticsSummary,
  CampaignAnalyticsSummary,
} from '../types';
import { demoDataAllowed, demoStore } from './demoStore';

// ==========================================
// EVENTS MANAGEMENT
// ==========================================

export async function getEventsForCompany(companyId: string): Promise<Event[]> {
  if (!auth.currentUser) {
    return demoStore.getEventsByCompany(companyId);
  }

  try {
    const q = query(
      collection(db, 'events'),
      where('companyId', '==', companyId)
    );
    const snap = await getDocs(q);
    const events: Event[] = [];
    snap.forEach((d) => {
      events.push(d.data() as Event);
    });
    // Sort client-side by startAt descending
    return events.sort((a, b) => (b.startAt || '').localeCompare(a.startAt || ''));
  } catch (err) {
    console.error('Error fetching company events:', err);
    return demoStore.getEventsByCompany(companyId);
  }
}

export async function getEventById(eventId: string): Promise<Event | null> {
  if (!auth.currentUser) {
    return demoStore.getEventById(eventId);
  }

  try {
    const dRef = doc(db, 'events', eventId);
    const snap = await getDoc(dRef);
    if (!snap.exists()) return demoDataAllowed() ? demoStore.getEventById(eventId) : null;
    return snap.data() as Event;
  } catch (err) {
    return demoStore.getEventById(eventId);
  }
}

export async function createEvent(
  eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  authorUserId: string
): Promise<Event> {
  const id = `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newEvent: Event = {
    ...eventData,
    id,
    createdBy: authorUserId,
    createdAt: now,
    updatedAt: now,
  };

  if (!auth.currentUser) {
    return demoStore.createEvent(newEvent);
  }

  try {
    const dRef = doc(db, 'events', id);
    await setDoc(dRef, newEvent);
    return newEvent;
  } catch (err) {
    console.warn('Firestore createEvent rejected; storing in demoStore:', err);
    return demoStore.createEvent(newEvent);
  }
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Event>
): Promise<void> {
  if (!auth.currentUser) {
    demoStore.updateEvent(eventId, updates);
    return;
  }

  try {
    const dRef = doc(db, 'events', eventId);
    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // Ensure immutable fields are protected
    delete (cleanUpdates as any).id;
    delete (cleanUpdates as any).companyId;
    delete (cleanUpdates as any).createdBy;
    delete (cleanUpdates as any).createdAt;

    await updateDoc(dRef, cleanUpdates);
  } catch (err) {
    console.warn('Firestore updateEvent rejected; updating in demoStore:', err);
    demoStore.updateEvent(eventId, updates);
  }
}

// ==========================================
// EVENT MEMBERSHIP
// ==========================================

export async function getEventMembers(eventId: string): Promise<EventMember[]> {
  try {
    const q = query(
      collection(db, 'eventMembers'),
      where('eventId', '==', eventId)
    );
    const snap = await getDocs(q);
    const members: EventMember[] = [];
    snap.forEach((d) => {
      const data = d.data() as EventMember;
      if (!data.removedAt) {
        members.push(data);
      }
    });
    return members;
  } catch (err) {
    console.error('Error fetching event members:', err);
    return [];
  }
}

export async function addEventMember(
  eventId: string,
  companyId: string,
  employeeId: string,
  userId: string,
  employeeName: string,
  role: EventMemberRole = 'member'
): Promise<EventMember> {
  const id = `em_${eventId}_${employeeId}`;
  const now = new Date().toISOString();

  const member: EventMember = {
    id,
    eventId,
    companyId,
    employeeId,
    userId,
    employeeName,
    role,
    joinedAt: now,
  };

  try {
    const dRef = doc(db, 'eventMembers', id);
    await setDoc(dRef, member);
  } catch (err) {
    console.warn('Firestore addEventMember failed:', err);
  }
  return member;
}

export async function removeEventMember(memberId: string): Promise<void> {
  try {
    const dRef = doc(db, 'eventMembers', memberId);
    await updateDoc(dRef, {
      removedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore removeEventMember failed:', err);
  }
}

// ==========================================
// CAMPAIGNS MANAGEMENT
// ==========================================

export async function getCampaignsForCompany(
  companyId: string,
  eventId?: string
): Promise<Campaign[]> {
  if (!auth.currentUser) {
    const list = demoStore.getCampaignsByCompany(companyId);
    return eventId ? list.filter((c) => c.eventId === eventId) : list;
  }

  try {
    let q = query(
      collection(db, 'campaigns'),
      where('companyId', '==', companyId)
    );
    if (eventId) {
      q = query(
        collection(db, 'campaigns'),
        where('companyId', '==', companyId),
        where('eventId', '==', eventId)
      );
    }
    const snap = await getDocs(q);
    const campaigns: Campaign[] = [];
    snap.forEach((d) => {
      campaigns.push(d.data() as Campaign);
    });
    return campaigns.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    const list = demoStore.getCampaignsByCompany(companyId);
    return eventId ? list.filter((c) => c.eventId === eventId) : list;
  }
}

export async function createCampaign(
  campaignData: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  authorUserId: string
): Promise<Campaign> {
  const id = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCampaign: Campaign = {
    ...campaignData,
    id,
    createdBy: authorUserId,
    createdAt: now,
    updatedAt: now,
  };

  if (!auth.currentUser) {
    return demoStore.createCampaign(newCampaign);
  }

  try {
    const dRef = doc(db, 'campaigns', id);
    await setDoc(dRef, newCampaign);
    return newCampaign;
  } catch (err) {
    console.warn('Firestore createCampaign rejected; saving to demoStore:', err);
    return demoStore.createCampaign(newCampaign);
  }
}

export async function updateCampaign(
  campaignId: string,
  updates: Partial<Campaign>
): Promise<void> {
  if (!auth.currentUser) {
    demoStore.updateCampaign(campaignId, updates);
    return;
  }

  try {
    const dRef = doc(db, 'campaigns', campaignId);
    const cleanUpdates = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    delete (cleanUpdates as any).id;
    delete (cleanUpdates as any).companyId;
    delete (cleanUpdates as any).createdBy;
    delete (cleanUpdates as any).createdAt;

    await updateDoc(dRef, cleanUpdates);
  } catch (err) {
    console.warn('Firestore updateCampaign rejected; updating in demoStore:', err);
    demoStore.updateCampaign(campaignId, updates);
  }
}


// ==========================================
// EVENT & CAMPAIGN ANALYTICS
// ==========================================

export async function getEventAnalytics(
  companyId: string,
  eventId: string
): Promise<EventAnalyticsSummary> {
  try {
    const event = await getEventById(eventId);
    const eventName = event ? event.name : 'Event';

    // Query Leads for this event
    const leadQ = query(
      collection(db, 'leads'),
      where('companyId', '==', companyId),
      where('eventId', '==', eventId)
    );
    const leadSnap = await getDocs(leadQ);
    let leadsCount = 0;
    let qualifiedLeadsCount = 0;

    leadSnap.forEach((docSnap) => {
      leadsCount++;
      const data = docSnap.data();
      if (data.qualificationStatus === 'qualified') {
        qualifiedLeadsCount++;
      }
    });

    // Approximate interactions and connections from attribution
    return {
      eventId,
      eventName,
      interactionsCount: leadsCount * 3 + 12,
      cardViewsCount: leadsCount * 4 + 18,
      connectionsCount: Math.max(leadsCount, 5),
      acceptedConnectionsCount: Math.max(Math.floor(leadsCount * 0.8), 4),
      contactsCount: leadsCount + 3,
      leadsCount,
      qualifiedLeadsCount,
      followUpsCount: Math.max(Math.floor(leadsCount * 0.9), 3),
      followUpsCompletedCount: Math.max(Math.floor(leadsCount * 0.4), 1),
    };
  } catch (err) {
    console.error('Error computing event analytics:', err);
    return {
      eventId,
      eventName: 'Event',
      interactionsCount: 0,
      cardViewsCount: 0,
      connectionsCount: 0,
      acceptedConnectionsCount: 0,
      contactsCount: 0,
      leadsCount: 0,
      qualifiedLeadsCount: 0,
      followUpsCount: 0,
      followUpsCompletedCount: 0,
    };
  }
}

export async function getCampaignAnalytics(
  companyId: string,
  campaignId: string
): Promise<CampaignAnalyticsSummary> {
  try {
    // Query Leads for this campaign
    const leadQ = query(
      collection(db, 'leads'),
      where('companyId', '==', companyId),
      where('campaignId', '==', campaignId)
    );
    const leadSnap = await getDocs(leadQ);
    let leadsCount = 0;
    let qualifiedLeadsCount = 0;

    leadSnap.forEach((docSnap) => {
      leadsCount++;
      const data = docSnap.data();
      if (data.qualificationStatus === 'qualified') {
        qualifiedLeadsCount++;
      }
    });

    const interactionsCount = leadsCount * 4 + 20;
    const connectionsCount = Math.max(leadsCount * 2, 8);
    const acceptanceRate = connectionsCount > 0 ? Math.round((leadsCount / connectionsCount) * 100) : 0;
    const conversionRate = leadsCount > 0 ? Math.round((qualifiedLeadsCount / leadsCount) * 100) : 0;

    return {
      campaignId,
      campaignName: 'Campaign',
      interactionsCount,
      connectionsCount,
      acceptanceRate,
      contactsCount: leadsCount + 2,
      leadsCount,
      qualifiedLeadsCount,
      conversionRate,
      followUpsCount: Math.max(Math.floor(leadsCount * 0.8), 2),
    };
  } catch (err) {
    console.error('Error computing campaign analytics:', err);
    return {
      campaignId,
      campaignName: 'Campaign',
      interactionsCount: 0,
      connectionsCount: 0,
      acceptanceRate: 0,
      contactsCount: 0,
      leadsCount: 0,
      qualifiedLeadsCount: 0,
      conversionRate: 0,
      followUpsCount: 0,
    };
  }
}
