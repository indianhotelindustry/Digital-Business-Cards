// ============================================================================
// DSBC SLUG CLIENT (Directive 20 UX, Directive 25 authority)
// ============================================================================
// Format and reserved-route rules come from shared/domain/slugRules (the
// backend applies the same rules). Ownership is no longer a localStorage
// registry: slugs/{slug} is written only by the backend when an entity is
// published, and the backend refuses a slug owned by another entity.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  RESERVED_SLUGS,
  sanitizeSlug,
  validateSlugFormat,
  type SlugValidationResult,
} from '../../shared/domain/slugRules';

export { RESERVED_SLUGS, type SlugValidationResult };

class SlugService {
  public sanitize(raw: string): string {
    return sanitizeSlug(raw);
  }

  /** Instant format / reserved-route check. Availability: checkAvailability(). */
  public validateSlug(candidate: string): SlugValidationResult {
    return validateSlugFormat(candidate);
  }

  /** Format check plus a read of slugs/{slug}. The backend re-checks when publishing. */
  public async checkAvailability(candidate: string, entityId?: string): Promise<SlugValidationResult> {
    const res = validateSlugFormat(candidate);
    if (!res.isValid) return res;
    try {
      const snap = await getDoc(doc(db, 'slugs', res.sanitizedSlug));
      if (snap.exists() && snap.get('entityId') !== entityId) {
        return {
          isValid: false,
          sanitizedSlug: res.sanitizedSlug,
          errorCode: 'COLLISION_DUPLICATE',
          errorMessage: `The public slug "${res.sanitizedSlug}" is already claimed. Please select a unique identifier.`,
        };
      }
    } catch {
      /* availability unknown: the backend decides at publish time */
    }
    return res;
  }

  public getReservedSlugs(): string[] {
    return Array.from(RESERVED_SLUGS);
  }
}

export const slugService = new SlugService();
