// ============================================================================
// DSBC PUBLIC RESOLVER CLIENT (Directive 26 Phase 1/2)
// ============================================================================
// /card/{slug}, /profile/{slug} and /company/{slug} are resolved ONLY by the
// backend (resolvePublicEntity). The answer is either the real, published
// customer content or an explicit outcome (NOT_FOUND / NOT_PUBLISHED /
// UNAVAILABLE / ERROR). There is no demo-data fallback on these routes.

import { callBackend } from '../lib/backend';
import type { Card, Company, Department, Employee } from '../types';
import type { DigitalIdentityProfile } from '../types/cardProfile';

export type PublicOutcome = 'OK' | 'NOT_FOUND' | 'NOT_PUBLISHED' | 'UNAVAILABLE' | 'ERROR';

/** Company projection: `slug` is the published website slug, or null when the website is not public. */
export type PublicCompany = Company & { slug: string | null };

export interface PublicCardResolution {
  outcome: PublicOutcome;
  preview?: boolean;
  card?: Card;
  employee?: Employee;
  company?: PublicCompany;
  department?: Department | null;
  profile?: DigitalIdentityProfile | null;
}

export interface PublicCompanyResolution {
  outcome: PublicOutcome;
  preview?: boolean;
  company?: PublicCompany;
  employees?: Array<Employee & { cardSlug: string }>;
  cards?: Card[];
  departments?: Department[];
}

interface RawResolution {
  outcome: Exclude<PublicOutcome, 'ERROR'>;
  preview?: boolean;
  data?: Record<string, unknown>;
}

async function resolve(route: 'card' | 'profile' | 'company', slug: string, preview: boolean): Promise<RawResolution | null> {
  try {
    return await callBackend<RawResolution>('resolvePublicEntity', { route, slug: slug.toLowerCase(), ...(preview ? { preview: true } : {}) });
  } catch (err) {
    console.error('Public resolution failed:', err);
    return null;
  }
}

export const publicResolver = {
  async card(slug: string, preview = false, route: 'card' | 'profile' = 'card'): Promise<PublicCardResolution> {
    const r = await resolve(route, slug, preview);
    if (!r) return { outcome: 'ERROR' };
    if (r.outcome !== 'OK' || !r.data) return { outcome: r.outcome };
    const d = r.data as Omit<PublicCardResolution, 'outcome' | 'preview'>;
    return { outcome: 'OK', preview: r.preview, ...d };
  },

  profile(slug: string, preview = false): Promise<PublicCardResolution> {
    return this.card(slug, preview, 'profile');
  },

  async company(slug: string, preview = false): Promise<PublicCompanyResolution> {
    const r = await resolve('company', slug, preview);
    if (!r) return { outcome: 'ERROR' };
    if (r.outcome !== 'OK' || !r.data) return { outcome: r.outcome };
    const d = r.data as Omit<PublicCompanyResolution, 'outcome' | 'preview'>;
    return { outcome: 'OK', preview: r.preview, ...d };
  },
};
