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
  Lead,
  LeadStatus,
  LeadQualificationStatus,
  LeadPriority,
  LeadSourceType,
  CompanyLeadNote,
  LeadEvent,
  LeadEventType,
  Connection,
} from '../types';
import { demoDataAllowed, demoStore } from './demoStore';

// ==========================================
// LEADS QUERY & RETRIEVAL
// ==========================================

export async function getLeadsForCompany(
  companyId: string,
  filters?: {
    status?: LeadStatus | 'all';
    qualificationStatus?: LeadQualificationStatus | 'all';
    priority?: LeadPriority | 'all';
    eventId?: string;
    campaignId?: string;
    ownerEmployeeId?: string;
    search?: string;
  }
): Promise<Lead[]> {
  if (!auth.currentUser) {
    let leads = demoStore.getLeadsByCompany(companyId);
    if (filters?.eventId && filters.eventId !== 'all') {
      leads = leads.filter((l) => l.eventId === filters.eventId);
    }
    if (filters?.campaignId && filters.campaignId !== 'all') {
      leads = leads.filter((l) => l.campaignId === filters.campaignId);
    }
    if (filters?.status && filters.status !== 'all') {
      leads = leads.filter((l) => l.leadStatus === filters.status);
    }
    if (filters?.qualificationStatus && filters.qualificationStatus !== 'all') {
      leads = leads.filter((l) => l.qualificationStatus === filters.qualificationStatus);
    }
    if (filters?.priority && filters.priority !== 'all') {
      leads = leads.filter((l) => l.priority === filters.priority);
    }
    if (filters?.ownerEmployeeId && filters.ownerEmployeeId !== 'all') {
      leads = leads.filter((l) => l.ownerEmployeeId === filters.ownerEmployeeId);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      leads = leads.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(s) ||
          (l.companyName || '').toLowerCase().includes(s) ||
          (l.jobTitle || '').toLowerCase().includes(s) ||
          (l.email || '').toLowerCase().includes(s) ||
          (l.phone || '').toLowerCase().includes(s)
      );
    }
    return leads.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  try {
    let q = query(
      collection(db, 'leads'),
      where('companyId', '==', companyId)
    );

    if (filters?.eventId && filters.eventId !== 'all') {
      q = query(
        collection(db, 'leads'),
        where('companyId', '==', companyId),
        where('eventId', '==', filters.eventId)
      );
    } else if (filters?.campaignId && filters.campaignId !== 'all') {
      q = query(
        collection(db, 'leads'),
        where('companyId', '==', companyId),
        where('campaignId', '==', filters.campaignId)
      );
    }

    const snap = await getDocs(q);
    let leads: Lead[] = [];
    snap.forEach((d) => {
      leads.push(d.data() as Lead);
    });

    // In-memory filters for compound criteria
    if (filters?.status && filters.status !== 'all') {
      leads = leads.filter((l) => l.leadStatus === filters.status);
    }
    if (filters?.qualificationStatus && filters.qualificationStatus !== 'all') {
      leads = leads.filter((l) => l.qualificationStatus === filters.qualificationStatus);
    }
    if (filters?.priority && filters.priority !== 'all') {
      leads = leads.filter((l) => l.priority === filters.priority);
    }
    if (filters?.ownerEmployeeId && filters.ownerEmployeeId !== 'all') {
      leads = leads.filter((l) => l.ownerEmployeeId === filters.ownerEmployeeId);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      leads = leads.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(s) ||
          (l.companyName || '').toLowerCase().includes(s) ||
          (l.jobTitle || '').toLowerCase().includes(s) ||
          (l.email || '').toLowerCase().includes(s) ||
          (l.phone || '').toLowerCase().includes(s)
      );
    }

    // Sort by createdAt descending
    return leads.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.error('Error fetching leads for company:', err);
    return demoStore.getLeadsByCompany(companyId);
  }
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  if (!auth.currentUser) {
    return demoStore.getLeadById(leadId);
  }

  try {
    const dRef = doc(db, 'leads', leadId);
    const snap = await getDoc(dRef);
    if (!snap.exists()) return demoDataAllowed() ? demoStore.getLeadById(leadId) : null;
    return snap.data() as Lead;
  } catch (err) {
    return demoStore.getLeadById(leadId);
  }
}

// ==========================================
// LEAD CREATION & CONVERSION
// ==========================================

export async function createLead(
  leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  actorUserId: string,
  actorName: string
): Promise<Lead> {
  const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newLead: Lead = {
    ...leadData,
    id,
    createdBy: actorUserId,
    createdAt: now,
    updatedAt: now,
  };

  if (!auth.currentUser) {
    demoStore.createLead(newLead);
    return newLead;
  }

  try {
    const dRef = doc(db, 'leads', id);
    await setDoc(dRef, newLead);

    // Record audit log
    await createLeadEvent(
      id,
      newLead.companyId,
      'LEAD_CREATED',
      `Lead captured for ${newLead.name} via ${newLead.sourceType}`,
      actorUserId,
      actorName,
      { sourceType: newLead.sourceType, eventId: newLead.eventId, campaignId: newLead.campaignId }
    );

    return newLead;
  } catch (err) {
    console.warn('Firestore createLead rejected; saving to demoStore:', err);
    demoStore.createLead(newLead);
    return newLead;
  }
}


export interface ConvertConnectionOptions {
  companyId: string;
  ownerEmployeeId: string;
  ownerUserId: string;
  ownerName?: string;
  eventId?: string | null;
  campaignId?: string | null;
  qualificationStatus: LeadQualificationStatus;
  priority: LeadPriority;
  qualificationNotes?: string;
  notesSummary?: string;
  sharedName: string;
  sharedCompany?: string;
  sharedTitle?: string;
  sharedEmail?: string;
  sharedPhone?: string;
}

export async function convertConnectionToLead(
  connection: Connection,
  options: ConvertConnectionOptions,
  actorUserId: string,
  actorName: string
): Promise<Lead> {
  const id = `lead_conn_${connection.id}_${Date.now()}`;
  const now = new Date().toISOString();

  // Create company-owned lead with explicit reference to source connection
  // CRITICAL PRIVACY INVARIANT: Private relationship notes and personal follow-ups are NEVER copied.
  const newLead: Lead = {
    id,
    companyId: options.companyId,
    sourceConnectionId: connection.id,
    eventId: options.eventId || null,
    campaignId: options.campaignId || null,
    ownerEmployeeId: options.ownerEmployeeId,
    ownerUserId: options.ownerUserId,
    ownerName: options.ownerName,
    createdBy: actorUserId,
    name: options.sharedName,
    companyName: options.sharedCompany,
    jobTitle: options.sharedTitle,
    email: options.sharedEmail,
    phone: options.sharedPhone,
    qualificationStatus: options.qualificationStatus,
    leadStatus: options.qualificationStatus === 'qualified' ? 'qualified' : 'qualifying',
    priority: options.priority,
    sourceType: options.eventId ? 'EVENT' : options.campaignId ? 'CAMPAIGN' : 'CARD_QR',
    sourceReference: `Connection ${connection.id}`,
    qualificationNotes: options.qualificationNotes,
    notesSummary: options.notesSummary,
    createdAt: now,
    updatedAt: now,
    qualifiedAt: options.qualificationStatus === 'qualified' ? now : null,
  };

  const dRef = doc(db, 'leads', id);
  await setDoc(dRef, newLead);

  // Emit immutable audit event
  await createLeadEvent(
    id,
    options.companyId,
    'LEAD_CREATED',
    `Converted connection with ${options.sharedName} into company lead`,
    actorUserId,
    actorName,
    {
      sourceConnectionId: connection.id,
      eventId: options.eventId,
      campaignId: options.campaignId,
    }
  );

  return newLead;
}

// ==========================================
// LEAD MUTATIONS & LIFECYCLE
// ==========================================

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  actorUserId: string,
  actorName: string
): Promise<void> {
  const dRef = doc(db, 'leads', leadId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) throw new Error('Lead not found');
  const existing = snap.data() as Lead;

  const now = new Date().toISOString();
  const updates: Partial<Lead> = {
    leadStatus: status,
    updatedAt: now,
  };

  if (status === 'qualified' && !existing.qualifiedAt) {
    updates.qualifiedAt = now;
  }
  if (status === 'converted' && !existing.convertedAt) {
    updates.convertedAt = now;
  }
  if (status === 'archived') {
    updates.archivedAt = now;
  }

  await updateDoc(dRef, updates);

  await createLeadEvent(
    leadId,
    existing.companyId,
    status === 'archived' ? 'LEAD_ARCHIVED' : status === 'converted' ? 'LEAD_CONVERTED' : 'LEAD_STATUS_CHANGED',
    `Lead status changed from ${existing.leadStatus} to ${status}`,
    actorUserId,
    actorName,
    { previousStatus: existing.leadStatus, newStatus: status }
  );
}

export async function updateLeadQualification(
  leadId: string,
  qualificationStatus: LeadQualificationStatus,
  priority: LeadPriority,
  qualificationNotes: string | undefined,
  actorUserId: string,
  actorName: string
): Promise<void> {
  const dRef = doc(db, 'leads', leadId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) throw new Error('Lead not found');
  const existing = snap.data() as Lead;

  const now = new Date().toISOString();
  const updates: Partial<Lead> = {
    qualificationStatus,
    priority,
    qualificationNotes: qualificationNotes ?? existing.qualificationNotes,
    updatedAt: now,
  };

  if (qualificationStatus === 'qualified') {
    updates.qualifiedAt = now;
    if (existing.leadStatus === 'new' || existing.leadStatus === 'qualifying') {
      updates.leadStatus = 'qualified';
    }
  } else if (qualificationStatus === 'disqualified') {
    updates.leadStatus = 'disqualified';
  }

  await updateDoc(dRef, updates);

  const eventType: LeadEventType =
    qualificationStatus === 'qualified'
      ? 'LEAD_QUALIFIED'
      : qualificationStatus === 'disqualified'
      ? 'LEAD_DISQUALIFIED'
      : 'LEAD_UPDATED';

  await createLeadEvent(
    leadId,
    existing.companyId,
    eventType,
    `Lead qualification updated to ${qualificationStatus} (Priority: ${priority})`,
    actorUserId,
    actorName,
    { qualificationStatus, priority }
  );
}

export async function reassignLead(
  leadId: string,
  newOwnerEmployeeId: string,
  newOwnerUserId: string,
  newOwnerName: string,
  actorUserId: string,
  actorName: string
): Promise<void> {
  const dRef = doc(db, 'leads', leadId);
  const snap = await getDoc(dRef);
  if (!snap.exists()) throw new Error('Lead not found');
  const existing = snap.data() as Lead;

  const now = new Date().toISOString();
  await updateDoc(dRef, {
    ownerEmployeeId: newOwnerEmployeeId,
    ownerUserId: newOwnerUserId,
    ownerName: newOwnerName,
    updatedAt: now,
  });

  await createLeadEvent(
    leadId,
    existing.companyId,
    'LEAD_ASSIGNED',
    `Lead reassigned from ${existing.ownerName || existing.ownerEmployeeId} to ${newOwnerName}`,
    actorUserId,
    actorName,
    { previousOwner: existing.ownerEmployeeId, newOwner: newOwnerEmployeeId }
  );
}

// ==========================================
// COMPANY LEAD NOTES (COMPANY-OWNED)
// ==========================================

export async function getLeadNotes(leadId: string): Promise<CompanyLeadNote[]> {
  try {
    const q = query(
      collection(db, 'leadNotes'),
      where('leadId', '==', leadId)
    );
    const snap = await getDocs(q);
    const notes: CompanyLeadNote[] = [];
    snap.forEach((d) => {
      notes.push(d.data() as CompanyLeadNote);
    });
    return notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.error('Error fetching lead notes:', err);
    return [];
  }
}

export async function addLeadNote(
  leadId: string,
  companyId: string,
  content: string,
  authorUserId: string,
  authorEmployeeId: string | null,
  authorName: string
): Promise<CompanyLeadNote> {
  const id = `ln_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const note: CompanyLeadNote = {
    id,
    companyId,
    leadId,
    authorUserId,
    authorEmployeeId,
    authorName,
    content,
    createdAt: now,
    updatedAt: now,
  };

  const dRef = doc(db, 'leadNotes', id);
  await setDoc(dRef, note);

  await createLeadEvent(
    leadId,
    companyId,
    'LEAD_UPDATED',
    `Added company lead note: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
    authorUserId,
    authorName
  );

  return note;
}

// ==========================================
// LEAD AUDIT TIMELINE (APPEND-ONLY)
// ==========================================

export async function getLeadEvents(leadId: string): Promise<LeadEvent[]> {
  try {
    const q = query(
      collection(db, 'leadEvents'),
      where('leadId', '==', leadId)
    );
    const snap = await getDocs(q);
    const events: LeadEvent[] = [];
    snap.forEach((d) => {
      events.push(d.data() as LeadEvent);
    });
    return events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  } catch (err) {
    console.error('Error fetching lead events:', err);
    return [];
  }
}

export async function createLeadEvent(
  leadId: string,
  companyId: string,
  eventType: LeadEventType,
  description: string,
  actorUserId: string,
  actorName: string,
  metadata?: Record<string, any>
): Promise<LeadEvent> {
  const id = `levt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const event: LeadEvent = {
    id,
    companyId,
    leadId,
    eventType,
    actorUserId,
    actorName,
    description,
    timestamp,
    metadata,
  };

  const dRef = doc(db, 'leadEvents', id);
  await setDoc(dRef, event);
  return event;
}
