// ============================================================================
// DSBC PUBLISHING GOVERNANCE & ACTIVATION SERVICE (Directive 20)
// ============================================================================

import {
  CustomerActivationState,
  PublishingState,
  EntityPublishingRecord,
  ProfileCompletionMetrics,
} from '../types/publishing';
import { slugService } from './slugService';

const STORAGE_KEY = 'dsbc_publishing_records_v1';

class PublishingService {
  private records: Map<string, EntityPublishingRecord> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadStorage();
    this.seedBaselineRecords();
  }

  private loadStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const list: EntityPublishingRecord[] = JSON.parse(stored);
        list.forEach((rec) => this.records.set(rec.id, rec));
      }
    } catch (e) {
      console.error('Error loading publishing governance records:', e);
    }
  }

  private saveStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(this.records.values()))
      );
    } catch (e) {
      console.error('Error saving publishing governance records:', e);
    }
  }

  private seedBaselineRecords(): void {
    const baseline: EntityPublishingRecord[] = [
      {
        id: 'card_acme_rahul',
        entityType: 'card',
        slug: 'rahul-sharma',
        ownerId: 'emp_acme_rahul',
        tenantId: 'company_acme',
        publishingState: 'PUBLISHED',
        activationState: 'PUBLISHED',
        completionScore: 100,
        publishedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'card_acme_priya',
        entityType: 'card',
        slug: 'priya-patel',
        ownerId: 'emp_acme_priya',
        tenantId: 'company_acme',
        publishingState: 'PUBLISHED',
        activationState: 'PUBLISHED',
        completionScore: 90,
        publishedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'company_acme',
        entityType: 'company',
        slug: 'acme-innovations',
        ownerId: 'company_acme',
        tenantId: 'company_acme',
        publishingState: 'PUBLISHED',
        activationState: 'PUBLISHED',
        completionScore: 95,
        publishedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'company_nexus',
        entityType: 'company',
        slug: 'nexus-enterprise',
        ownerId: 'company_nexus',
        tenantId: 'company_nexus',
        publishingState: 'SUSPENDED',
        activationState: 'SUSPENDED',
        completionScore: 85,
        publishedAt: '2026-01-01T00:00:00.000Z',
        suspendedAt: '2026-03-01T00:00:00.000Z',
        suspensionReason: 'Administrative compliance audit in progress',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'card_nexus_marcus',
        entityType: 'card',
        slug: 'marcus-vance',
        ownerId: 'emp_nexus_marcus',
        tenantId: 'company_nexus',
        publishingState: 'SUSPENDED',
        activationState: 'SUSPENDED',
        completionScore: 70,
        publishedAt: '2026-01-01T00:00:00.000Z',
        suspendedAt: '2026-03-01T00:00:00.000Z',
        suspensionReason: 'Parent organization is currently suspended',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'card_draft_sample',
        entityType: 'card',
        slug: 'draft-unpub-test',
        ownerId: 'emp_sample_draft',
        tenantId: 'company_acme',
        publishingState: 'DRAFT',
        activationState: 'PROFILE_INCOMPLETE',
        completionScore: 40,
        publishedAt: null,
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
    ];

    baseline.forEach((b) => {
      if (!this.records.has(b.id)) {
        this.records.set(b.id, b);
      }
    });
  }

  public getRecord(id: string): EntityPublishingRecord | undefined {
    return this.records.get(id);
  }

  public getRecordBySlug(slug: string): EntityPublishingRecord | undefined {
    const target = slug.toLowerCase();
    return Array.from(this.records.values()).find((r) => r.slug.toLowerCase() === target);
  }

  /**
   * Determine if public unauthenticated visitors are permitted to view this entity
   */
  public canPublicView(
    recordOrSlug: string,
    isAdminPreview = false
  ): { allowed: boolean; reason?: 'NOT_FOUND' | 'DRAFT' | 'UNPUBLISHED' | 'SUSPENDED' | 'MAINTENANCE' } {
    const rec =
      this.records.get(recordOrSlug) || this.getRecordBySlug(recordOrSlug);

    if (!rec) {
      return { allowed: false, reason: 'NOT_FOUND' };
    }

    // Explicit Preview mode allows authenticated admins to preview their draft
    if (isAdminPreview) {
      if (rec.publishingState === 'SUSPENDED') {
        return { allowed: false, reason: 'SUSPENDED' };
      }
      return { allowed: true };
    }

    if (rec.publishingState === 'SUSPENDED') {
      return { allowed: false, reason: 'SUSPENDED' };
    }

    if (rec.publishingState === 'DRAFT') {
      return { allowed: false, reason: 'DRAFT' };
    }

    if (rec.publishingState === 'UNPUBLISHED') {
      return { allowed: false, reason: 'UNPUBLISHED' };
    }

    return { allowed: true };
  }

  /**
   * Publish an entity after validation
   */
  public publishEntity(
    id: string,
    slug: string,
    entityType: 'card' | 'company' | 'profile',
    ownerId: string,
    tenantId?: string
  ): EntityPublishingRecord {
    // 1. Verify slug reservation
    slugService.registerSlug(slug, entityType === 'card' ? 'individual_card' : entityType === 'company' ? 'company' : 'individual_profile', ownerId, tenantId);

    const now = new Date().toISOString();
    const existing = this.records.get(id);

    const updated: EntityPublishingRecord = {
      id,
      entityType,
      slug: slug.toLowerCase(),
      ownerId,
      tenantId,
      publishingState: 'PUBLISHED',
      activationState: 'PUBLISHED',
      completionScore: 100,
      publishedAt: existing?.publishedAt || now,
      unpublishedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: now,
    };

    this.records.set(id, updated);
    this.saveStorage();
    this.notify();
    return updated;
  }

  /**
   * Unpublish entity
   */
  public unpublishEntity(id: string): EntityPublishingRecord {
    const rec = this.records.get(id);
    if (!rec) throw new Error('Record not found');

    rec.publishingState = 'UNPUBLISHED';
    rec.activationState = 'READY_TO_PUBLISH';
    rec.unpublishedAt = new Date().toISOString();
    rec.updatedAt = new Date().toISOString();

    this.records.set(id, rec);
    this.saveStorage();
    this.notify();
    return rec;
  }

  /**
   * Administrative suspension
   */
  public suspendEntity(id: string, reason = 'Administrative violation'): EntityPublishingRecord {
    const rec = this.records.get(id);
    if (!rec) throw new Error('Record not found');

    rec.publishingState = 'SUSPENDED';
    rec.activationState = 'SUSPENDED';
    rec.suspendedAt = new Date().toISOString();
    rec.suspensionReason = reason;
    rec.updatedAt = new Date().toISOString();

    this.records.set(id, rec);
    this.saveStorage();
    this.notify();
    return rec;
  }

  /**
   * Calculate Profile Completion Metrics
   */
  public calculateIndividualCardCompletion(cardData: {
    displayName?: string;
    jobTitle?: string;
    email?: string;
    phone?: string;
    bio?: string;
    avatarUrl?: string;
    publicSlug?: string;
    templateId?: string;
  }): ProfileCompletionMetrics {
    const checklist = [
      {
        id: 'name',
        label: 'Full Name',
        isComplete: !!cardData.displayName?.trim(),
        isRequired: true,
        weight: 20,
      },
      {
        id: 'title',
        label: 'Professional Headline / Title',
        isComplete: !!cardData.jobTitle?.trim(),
        isRequired: true,
        weight: 15,
      },
      {
        id: 'contact',
        label: 'Contact Information (Email & Phone)',
        isComplete: !!(cardData.email?.trim() || cardData.phone?.trim()),
        isRequired: true,
        weight: 20,
      },
      {
        id: 'slug',
        label: 'Public Vanity URL Slug',
        isComplete: !!cardData.publicSlug?.trim(),
        isRequired: true,
        weight: 15,
      },
      {
        id: 'avatar',
        label: 'Profile Photo / Avatar',
        isComplete: !!cardData.avatarUrl?.trim(),
        isRequired: false,
        weight: 15,
      },
      {
        id: 'bio',
        label: 'Professional Bio & Headline',
        isComplete: !!cardData.bio?.trim(),
        isRequired: false,
        weight: 15,
      },
    ];

    const completed = checklist.filter((c) => c.isComplete);
    const score = completed.reduce((acc, c) => acc + c.weight, 0);
    const requiredItems = checklist.filter((c) => c.isRequired);
    const requiredDone = requiredItems.every((c) => c.isComplete);

    return {
      score,
      percentage: score,
      isReadyToPublish: requiredDone && score >= 70,
      completedFields: completed.map((c) => c.label),
      missingFields: checklist.filter((c) => !c.isComplete).map((c) => c.label),
      checklist,
    };
  }

  public validateStatusTransition(
    entityType: 'individual' | 'company' | 'card' | 'profile',
    fromState: string,
    toState: string
  ): { allowed: boolean; reason?: string } {
    const from = fromState.toUpperCase();
    const to = toState.toUpperCase();

    // Any entity can transition draft -> active / published
    if ((from === 'DRAFT' || from === 'UNPUBLISHED') && (to === 'ACTIVE' || to === 'PUBLISHED')) {
      return { allowed: true };
    }

    if (from === 'ACTIVE' || from === 'PUBLISHED') {
      if (to === 'UNPUBLISHED' || to === 'DRAFT' || to === 'SUSPENDED') {
        return { allowed: true };
      }
    }

    if (from === 'SUSPENDED' && (to === 'ACTIVE' || to === 'PUBLISHED')) {
      return { allowed: true }; // Admin reactivation
    }

    return { allowed: true };
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Publishing listener error:', e);
      }
    });
  }
}

export const publishingService = new PublishingService();
