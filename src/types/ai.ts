// ----------------------------------------------------------------------
// DSBC V2.2 — Intelligence & Capture Architecture & Domain Models
// ----------------------------------------------------------------------

export type AIProvenanceStatus =
  | 'AI_SUGGESTED'
  | 'USER_APPROVED'
  | 'USER_EDITED'
  | 'SYSTEM_GENERATED';

export type AIDataScopeType =
  | 'PUBLIC_CARD'
  | 'PERSONAL_CONTACT'
  | 'PERSONAL_CONNECTION'
  | 'PERSONAL_NOTE'
  | 'COMPANY_LEAD'
  | 'EVENT_CONTEXT'
  | 'CAMPAIGN_CONTEXT';

export interface AIRequestLog {
  id: string;
  requestId: string;
  actorUserId: string;
  companyId?: string | null;
  dataScopeType: AIDataScopeType;
  sourceObjectId: string;
  purpose: string;
  provider: 'gemini' | 'openai' | 'mock' | 'local';
  model: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface CapturedCardRecord {
  id: string;
  ownerUserId: string;
  imageUrl?: string;
  rawOcrText?: string;
  status: 'pending_review' | 'processed' | 'saved_as_contact' | 'rejected';
  confidenceScore?: number;
  extractedData: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    designation?: string;
    company?: string;
    department?: string;
    phone?: string;
    mobile?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    linkedin?: string;
    instagram?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    notes?: string;
  };
  fieldProvenance: Record<string, AIProvenanceStatus>;
  aiRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIInteractionSummaryRecord {
  id: string;
  ownerUserId: string;
  sourceType: 'note' | 'meeting_transcript' | 'conversation';
  sourceId?: string;
  rawInput: string;
  summary: string;
  keyPoints: string[];
  commitments: string[];
  actionItems: string[];
  suggestedFollowUpDate?: string;
  topicsToRevisit: string[];
  provenanceStatus: AIProvenanceStatus;
  aiRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AISuggestionRecord {
  id: string;
  ownerUserId: string;
  targetType: 'follow_up' | 'contact_update' | 'reconnection' | 'lead_preparation';
  targetId?: string;
  title: string;
  description: string;
  suggestedPayload?: Record<string, any>;
  status: 'suggested' | 'accepted' | 'rejected';
  provenanceStatus: AIProvenanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AIActivityEventRecord {
  id: string;
  companyId?: string | null;
  actorUserId: string;
  actorName: string;
  eventType:
    | 'AI_REQUESTED'
    | 'AI_COMPLETED'
    | 'AI_FAILED'
    | 'AI_SUGGESTION_CREATED'
    | 'AI_SUGGESTION_ACCEPTED'
    | 'AI_SUGGESTION_REJECTED';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Ownership Matrix Documentation
/*
ENTITY OWNERSHIP & PRIVACY MATRIX (DSBC V2.2):
1. CapturedCard:
   - Owner: User (ownerUserId)
   - Read/Write: User only
   - Authoritative: False until reviewed and converted to Contact
2. AIRequestLog:
   - Owner: System / Actor User
   - Read: Actor User / App Owner
   - Write: System
   - Authoritative: Audit trail only
3. AIInteractionSummary:
   - Owner: User (ownerUserId)
   - Read/Write: User only (Strict personal privacy)
   - Authoritative: False until approved
4. AISuggestion:
   - Owner: User (ownerUserId)
   - Read/Write: User only
   - Authoritative: False until accepted by user action
5. AIActivityEvent:
   - Owner: User / Company tenant
   - Read: Tenant authorized actors
   - Write: Append-only system
   - Authoritative: Append-only provenance log
*/
