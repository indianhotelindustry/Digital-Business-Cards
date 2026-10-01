import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Contact,
  Connection,
  RelationshipNote,
  FollowUp,
  ConnectionEvent,
  ConnectionStatus,
  FollowUpStatus,
  ConnectionEventType,
} from '../types';

// ==========================================
// 1. CONNECTIONS API
// ==========================================

export async function getConnectionsForUser(userId: string, employeeId?: string | null): Promise<Connection[]> {
  try {
    const list: Connection[] = [];
    const seenIds = new Set<string>();

    // Query connections where user is requester
    const q1 = query(
      collection(db, 'connections'),
      where('requesterUserId', '==', userId)
    );
    const snap1 = await getDocs(q1);
    snap1.forEach((d) => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        list.push({ id: d.id, ...d.data() } as Connection);
      }
    });

    // Query connections where user is recipient
    const q2 = query(
      collection(db, 'connections'),
      where('recipientUserId', '==', userId)
    );
    const snap2 = await getDocs(q2);
    snap2.forEach((d) => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        list.push({ id: d.id, ...d.data() } as Connection);
      }
    });

    // If employeeId is provided, also query where recipientIdentityId matches
    if (employeeId) {
      const q3 = query(
        collection(db, 'connections'),
        where('recipientIdentityId', '==', employeeId)
      );
      const snap3 = await getDocs(q3);
      snap3.forEach((d) => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          list.push({ id: d.id, ...d.data() } as Connection);
        }
      });
    }

    // Sort by lastInteractionAt desc
    return list.sort((a, b) => new Date(b.lastInteractionAt || b.createdAt).getTime() - new Date(a.lastInteractionAt || a.createdAt).getTime());
  } catch (err) {
    console.error('Error fetching connections:', err);
    return [];
  }
}

export async function getConnectionById(connectionId: string): Promise<Connection | null> {
  try {
    const d = await getDoc(doc(db, 'connections', connectionId));
    if (d.exists()) {
      return { id: d.id, ...d.data() } as Connection;
    }
    return null;
  } catch (err) {
    console.error(`Error fetching connection ${connectionId}:`, err);
    return null;
  }
}

export async function createConnectionRequest(
  data: Omit<Connection, 'id' | 'createdAt' | 'updatedAt' | 'lastInteractionAt' | 'connectionVersion'>
): Promise<Connection> {
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newConnection: Connection = {
    ...data,
    id: connectionId,
    connectionVersion: 'v2.0',
    createdAt: now,
    updatedAt: now,
    lastInteractionAt: now,
  };

  await setDoc(doc(db, 'connections', connectionId), newConnection);

  // Record initial timeline event
  await recordConnectionEvent({
    connectionId,
    participantUserIds: [data.requesterUserId, data.recipientUserId || ''].filter(Boolean),
    eventType: 'CONNECTION_REQUESTED',
    actorUserId: data.initiatedBy,
    actorName: data.requesterName,
    description: `Connection requested via ${data.exchangeMethod.replace('_', ' ')}`,
    timestamp: now,
    metadata: {
      requesterCompany: data.requesterCompany,
      requesterTitle: data.requesterTitle,
    },
  });

  return newConnection;
}

export async function updateConnectionStatus(
  connectionId: string,
  newStatus: ConnectionStatus,
  actorUserId: string,
  actorName: string,
  notes?: string
): Promise<void> {
  const docRef = doc(db, 'connections', connectionId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Connection not found');
  }

  const existing = snap.data() as Connection;
  const now = new Date().toISOString();

  // Validate state transitions
  if (existing.status === 'blocked' && newStatus !== 'blocked') {
    throw new Error('Blocked connections cannot transition directly to another state.');
  }

  const updates: Partial<Connection> = {
    status: newStatus,
    updatedAt: now,
    lastInteractionAt: now,
  };

  let eventType: ConnectionEventType = 'CONNECTION_ACCEPTED';
  if (newStatus === 'accepted') {
    updates.acceptedAt = now;
    eventType = 'CONNECTION_ACCEPTED';
  } else if (newStatus === 'declined') {
    updates.declinedAt = now;
    eventType = 'CONNECTION_DECLINED';
  } else if (newStatus === 'revoked') {
    updates.revokedAt = now;
    eventType = 'CONNECTION_REVOKED';
  }

  await updateDoc(docRef, updates);

  // Record timeline event
  await recordConnectionEvent({
    connectionId,
    participantUserIds: [existing.requesterUserId, existing.recipientUserId || ''].filter(Boolean),
    eventType,
    actorUserId,
    actorName,
    description: `Connection status changed to ${newStatus}${notes ? `: ${notes}` : ''}`,
    timestamp: now,
  });
}

// ==========================================
// 2. CONTACTS API (Personal Address Book)
// ==========================================

export async function getContactsForUser(ownerUserId: string): Promise<Contact[]> {
  try {
    const q = query(
      collection(db, 'contacts'),
      where('ownerUserId', '==', ownerUserId)
    );
    const snap = await getDocs(q);
    const list: Contact[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as Contact);
    });
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  } catch (err) {
    console.error('Error fetching contacts:', err);
    return [];
  }
}

export async function createContact(
  data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Contact> {
  const contactId = `contact_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newContact: Contact = {
    ...data,
    id: contactId,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'contacts', contactId), newContact);
  return newContact;
}

export async function updateContact(
  contactId: string,
  data: Partial<Omit<Contact, 'id' | 'ownerUserId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'contacts', contactId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function archiveContact(contactId: string, archive = true): Promise<void> {
  const docRef = doc(db, 'contacts', contactId);
  await updateDoc(docRef, {
    archivedAt: archive ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
}

// ==========================================
// 3. RELATIONSHIP NOTES API (Private to User)
// ==========================================

export async function getRelationshipNotes(
  ownerUserId: string,
  connectionId?: string | null,
  contactId?: string | null
): Promise<RelationshipNote[]> {
  try {
    const q = query(
      collection(db, 'relationshipNotes'),
      where('ownerUserId', '==', ownerUserId)
    );
    const snap = await getDocs(q);
    const list: RelationshipNote[] = [];
    snap.forEach((d) => {
      const data = d.data() as RelationshipNote;
      if (connectionId && data.connectionId === connectionId) {
        list.push({ id: d.id, ...data });
      } else if (contactId && data.contactId === contactId) {
        list.push({ id: d.id, ...data });
      } else if (!connectionId && !contactId) {
        list.push({ id: d.id, ...data });
      }
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Error fetching relationship notes:', err);
    return [];
  }
}

export async function createRelationshipNote(
  data: Omit<RelationshipNote, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RelationshipNote> {
  const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newNote: RelationshipNote = {
    ...data,
    id: noteId,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'relationshipNotes', noteId), newNote);

  // If associated with a connection, record timeline event
  if (data.connectionId) {
    await recordConnectionEvent({
      connectionId: data.connectionId,
      ownerUserId: data.ownerUserId,
      participantUserIds: [data.ownerUserId],
      eventType: 'NOTE_ADDED',
      actorUserId: data.ownerUserId,
      actorName: data.authorName,
      description: `Added private relationship note: "${data.content.substring(0, 40)}${data.content.length > 40 ? '...' : ''}"`,
      timestamp: now,
    });
  }

  return newNote;
}

export async function deleteRelationshipNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'relationshipNotes', noteId));
}

// ==========================================
// 4. FOLLOW-UPS API
// ==========================================

export async function getFollowUpsForUser(ownerUserId: string): Promise<FollowUp[]> {
  try {
    const q = query(
      collection(db, 'followUps'),
      where('ownerUserId', '==', ownerUserId)
    );
    const snap = await getDocs(q);
    const list: FollowUp[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as FollowUp);
    });
    return list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  } catch (err) {
    console.error('Error fetching follow ups:', err);
    return [];
  }
}

export async function createFollowUp(
  data: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FollowUp> {
  const followUpId = `fu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newFollowUp: FollowUp = {
    ...data,
    id: followUpId,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'followUps', followUpId), newFollowUp);

  if (data.connectionId) {
    await recordConnectionEvent({
      connectionId: data.connectionId,
      ownerUserId: data.ownerUserId,
      participantUserIds: [data.ownerUserId],
      eventType: 'FOLLOW_UP_CREATED',
      actorUserId: data.ownerUserId,
      actorName: 'Self',
      description: `Created follow-up: "${data.title}" due ${data.dueAt}`,
      timestamp: now,
    });
  }

  return newFollowUp;
}

export async function updateFollowUpStatus(
  followUpId: string,
  newStatus: FollowUpStatus
): Promise<void> {
  const docRef = doc(db, 'followUps', followUpId);
  const now = new Date().toISOString();

  const updates: Partial<FollowUp> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'completed') {
    updates.completedAt = now;
  } else if (newStatus === 'cancelled') {
    updates.cancelledAt = now;
  }

  await updateDoc(docRef, updates);
}

// ==========================================
// 5. CONNECTION TIMELINE API
// ==========================================

export async function getConnectionTimeline(connectionId: string, userId: string): Promise<ConnectionEvent[]> {
  try {
    const q = query(
      collection(db, 'connectionEvents'),
      where('connectionId', '==', connectionId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const list: ConnectionEvent[] = [];
    snap.forEach((d) => {
      const event = { id: d.id, ...d.data() } as ConnectionEvent;
      // Filter out events that are scoped to another user's private notes
      if (!event.ownerUserId || event.ownerUserId === userId || (event.participantUserIds && event.participantUserIds.includes(userId))) {
        list.push(event);
      }
    });
    return list;
  } catch (err) {
    console.error(`Error fetching timeline for connection ${connectionId}:`, err);
    return [];
  }
}

export async function recordConnectionEvent(
  event: Omit<ConnectionEvent, 'id'>
): Promise<ConnectionEvent> {
  const eventId = `cevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newEvent: ConnectionEvent = {
    ...event,
    id: eventId,
  };

  try {
    await setDoc(doc(db, 'connectionEvents', eventId), newEvent);
  } catch (err) {
    console.warn('Failed to record connection event:', err);
  }

  return newEvent;
}
