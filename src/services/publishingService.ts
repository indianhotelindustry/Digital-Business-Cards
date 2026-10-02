// ============================================================================
// DSBC PUBLISHING CLIENT (Directive 20 UX, Directive 25 authority)
// ============================================================================
// Publishing state used to live in localStorage (dsbc_publishing_records_v1),
// so any browser could mark anything PUBLISHED, and "?preview=true" showed
// drafts to any visitor. Authority now lives in the backend:
//
//   publishingRecords/{entityId}  written only by setPublishingState /
//                                 adminSetPublishingSuspension (functions/)
//   slugs/{slug}                  global slug ownership, backend-written
//   entity.publicationHidden      backend-mirrored: DRAFT / UNPUBLISHED
//   entity.platformSuspended      backend-mirrored: App Owner suspension
//
// firestore.rules hide entities carrying either flag from the public, so a
// preview flag in the URL grants nothing: only tenant members and the App
// Owner can read a hidden entity at all. This module reads records and asks
// the backend to change them.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callBackend } from '../lib/backend';
import { toIso } from './commercialStore';
import {
  EntityPublishingRecord,
  ProfileCompletionMetrics,
} from '../types/publishing';

export type PublicViewDenial = 'NOT_FOUND' | 'DRAFT' | 'UNPUBLISHED' | 'SUSPENDED' | 'MAINTENANCE';

/** Backend-owned visibility flags that may be present on a loaded entity. */
export interface EntityVisibilityFlags {
  platformSuspended?: boolean;
  publicationHidden?: boolean;
}

type EntityType = 'card' | 'company' | 'profile';

function recordFromDoc(id: string, d: Record<string, unknown>): EntityPublishingRecord {
  return {
    ...(d as unknown as EntityPublishingRecord),
    id,
    publishedAt: toIso(d.publishedAt),
    unpublishedAt: toIso(d.unpublishedAt),
    suspendedAt: toIso(d.suspendedAt),
    updatedAt: toIso(d.updatedAt) || '',
    completionScore: typeof d.completionScore === 'number' ? d.completionScore : 0,
  };
}

class PublishingService {
  private records: Map<string, EntityPublishingRecord> = new Map();
  private listeners: Set<() => void> = new Set();

  /** Cached record (populated by fetchRecord). */
  public getRecord(id: string): EntityPublishingRecord | undefined {
    return this.records.get(id);
  }

  public getRecordBySlug(slug: string): EntityPublishingRecord | undefined {
    const target = slug.toLowerCase();
    return Array.from(this.records.values()).find((r) => (r.slug || '').toLowerCase() === target);
  }

  /**
   * Reads publishingRecords/{id}. Returns null when there is no record or the
   * caller may not read it (the public can read PUBLISHED records only).
   */
  public async fetchRecord(id: string): Promise<EntityPublishingRecord | null> {
    try {
      const snap = await getDoc(doc(db, 'publishingRecords', id));
      if (!snap.exists()) return null;
      const rec = recordFromDoc(snap.id, snap.data());
      this.records.set(id, rec);
      this.notify();
      return rec;
    } catch {
      return null;
    }
  }

  /**
   * Presentation check for public pages. The real gate is firestore.rules: an
   * entity hidden or suspended by the backend is not readable by the public in
   * the first place. This only chooses which notice to show.
   */
  public async canPublicView(
    entityId: string,
    isAdminPreview = false,
    flags: EntityVisibilityFlags = {}
  ): Promise<{ allowed: boolean; reason?: PublicViewDenial }> {
    if (flags.platformSuspended) return { allowed: false, reason: 'SUSPENDED' };
    const rec = await this.fetchRecord(entityId);
    const state = rec?.publishingState;
    if (state === 'SUSPENDED') return { allowed: false, reason: 'SUSPENDED' };
    // A DRAFT/UNPUBLISHED record is only readable by tenant members and the
    // App Owner, so reaching this point means the viewer may preview it.
    if (state === 'DRAFT' || state === 'UNPUBLISHED' || flags.publicationHidden) {
      return isAdminPreview ? { allowed: true } : { allowed: false, reason: state === 'DRAFT' ? 'DRAFT' : 'UNPUBLISHED' };
    }
    return { allowed: true };
  }

  /** Owner request; the backend checks ownership, entitlement, seat lock and slug availability. */
  public async setState(entityType: EntityType, entityId: string, state: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED', slug?: string) {
    const res = await callBackend<{ entityId: string; publishingState: string; slug: string }>('setPublishingState', {
      entityType,
      entityId,
      state,
      ...(slug ? { slug } : {}),
    });
    await this.fetchRecord(entityId);
    return res;
  }

  public publishEntity(entityId: string, slug: string, entityType: EntityType) {
    return this.setState(entityType, entityId, 'PUBLISHED', slug);
  }

  public unpublishEntity(entityId: string, entityType: EntityType) {
    return this.setState(entityType, entityId, 'UNPUBLISHED');
  }

  /** App Owner only (verified server-side). */
  public async setSuspension(entityType: EntityType, entityId: string, suspended: boolean, reason: string) {
    const res = await callBackend<{ entityId: string; publishingState: string }>('adminSetPublishingSuspension', {
      entityType,
      entityId,
      suspended,
      reason,
    });
    await this.fetchRecord(entityId);
    return res;
  }

  /** Is the slug free? (slugs/{slug} is publicly readable; the backend enforces ownership.) */
  public async isSlugAvailable(slug: string, entityId?: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'slugs', slug.toLowerCase()));
      return !snap.exists() || snap.get('entityId') === entityId;
    } catch {
      return true;
    }
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
