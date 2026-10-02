// ============================================================================
// DSBC CUSTOMER ACTIVATION & PUBLISHING GOVERNANCE TYPES (Directive 20)
// ============================================================================

export type CustomerActivationState =
  | 'REGISTERED'
  | 'ONBOARDING'
  | 'PROFILE_INCOMPLETE'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'SUSPENDED';

export type PublishingState =
  | 'DRAFT'
  | 'PREVIEW'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'SUSPENDED';

export interface EntityPublishingRecord {
  id: string; // cardId or companyId
  entityType: 'card' | 'company' | 'profile';
  slug: string;
  ownerId: string;
  tenantId?: string;
  publishingState: PublishingState;
  activationState: CustomerActivationState;
  completionScore: number; // 0 - 100
  publishedAt?: string | null;
  unpublishedAt?: string | null;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  updatedAt: string;
}

export interface ProfileCompletionMetrics {
  score: number;
  percentage: number;
  isReadyToPublish: boolean;
  completedFields: string[];
  missingFields: string[];
  checklist: Array<{
    id: string;
    label: string;
    isComplete: boolean;
    isRequired: boolean;
    weight: number;
  }>;
}
