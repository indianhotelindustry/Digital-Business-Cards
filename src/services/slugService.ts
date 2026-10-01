// ============================================================================
// DSBC CENTRALIZED RESERVED SLUG REGISTRY & COLLISION ENGINE (Directive 20)
// ============================================================================

export interface SlugValidationResult {
  isValid: boolean;
  sanitizedSlug: string;
  errorCode?:
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'MALFORMED'
    | 'RESERVED_SYSTEM_ROUTE'
    | 'COLLISION_DUPLICATE'
    | 'DELETED_ACCOUNT_QUARANTINE'
    | 'CROSS_TENANT_COLLISION';
  errorMessage?: string;
}

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // System root routes
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'billing',
  'card',
  'cards',
  'checkout',
  'company',
  'companies',
  'connect',
  'dashboard',
  'department',
  'departments',
  'dev',
  'developer',
  'docs',
  'edit',
  'employee',
  'employees',
  'events',
  'help',
  'home',
  'invoices',
  'leads',
  'legal',
  'login',
  'logout',
  'my-plan',
  'null',
  'oauth',
  'onboarding',
  'payment',
  'payments',
  'portal',
  'preview',
  'pricing',
  'privacy',
  'profile',
  'profiles',
  'public',
  'register',
  'reset-password',
  'root',
  'saas',
  'security',
  'settings',
  'signup',
  'sitemap',
  'staging',
  'static',
  'status',
  'subscriptions',
  'support',
  'system',
  'team',
  'terms',
  'test',
  'undefined',
  'upgrade',
  'vcard',
  'verify',
  'webhook',
  'webhooks',
  'welcome',
]);

const STORAGE_KEYS = {
  REGISTERED_SLUGS: 'dsbc_registered_slugs_v1',
  QUARANTINED_SLUGS: 'dsbc_quarantined_slugs_v1',
};

interface RegisteredSlugRecord {
  slug: string;
  entityType: 'individual_card' | 'individual_profile' | 'company';
  ownerId: string; // employeeId, userId, or companyId
  tenantId?: string; // companyId if applicable
  registeredAt: string;
  status: 'ACTIVE' | 'QUARANTINED' | 'ARCHIVED';
}

class SlugService {
  private registeredSlugs: Map<string, RegisteredSlugRecord> = new Map();
  private quarantinedSlugs: Map<string, { quarantinedUntil: string; reason: string }> = new Map();

  constructor() {
    this.loadStorage();
    this.seedBaselineSlugs();
  }

  private loadStorage(): void {
    try {
      const reg = localStorage.getItem(STORAGE_KEYS.REGISTERED_SLUGS);
      if (reg) {
        const parsed: RegisteredSlugRecord[] = JSON.parse(reg);
        parsed.forEach((rec) => this.registeredSlugs.set(rec.slug.toLowerCase(), rec));
      }

      const quar = localStorage.getItem(STORAGE_KEYS.QUARANTINED_SLUGS);
      if (quar) {
        const parsed: Array<[string, { quarantinedUntil: string; reason: string }]> = JSON.parse(quar);
        parsed.forEach(([slug, val]) => this.quarantinedSlugs.set(slug.toLowerCase(), val));
      }
    } catch (e) {
      console.error('Error loading slug registry storage:', e);
    }
  }

  private saveStorage(): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.REGISTERED_SLUGS,
        JSON.stringify(Array.from(this.registeredSlugs.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.QUARANTINED_SLUGS,
        JSON.stringify(Array.from(this.quarantinedSlugs.entries()))
      );
    } catch (e) {
      console.error('Error saving slug registry storage:', e);
    }
  }

  private seedBaselineSlugs(): void {
    // Seed known existing card and company slugs if not registered
    const seeds: RegisteredSlugRecord[] = [
      {
        slug: 'acme-innovations',
        entityType: 'company',
        ownerId: 'company_acme',
        tenantId: 'company_acme',
        registeredAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
      {
        slug: 'nexus-enterprise',
        entityType: 'company',
        ownerId: 'company_nexus',
        tenantId: 'company_nexus',
        registeredAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
      {
        slug: 'rahul-sharma',
        entityType: 'individual_card',
        ownerId: 'emp_acme_rahul',
        tenantId: 'company_acme',
        registeredAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
      {
        slug: 'priya-patel',
        entityType: 'individual_card',
        ownerId: 'emp_acme_priya',
        tenantId: 'company_acme',
        registeredAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
      {
        slug: 'marcus-vance',
        entityType: 'individual_card',
        ownerId: 'emp_nexus_marcus',
        tenantId: 'company_nexus',
        registeredAt: '2026-01-01T00:00:00.000Z',
        status: 'ACTIVE',
      },
    ];

    seeds.forEach((seed) => {
      if (!this.registeredSlugs.has(seed.slug.toLowerCase())) {
        this.registeredSlugs.set(seed.slug.toLowerCase(), seed);
      }
    });
  }

  /**
   * Canonicalize and sanitize an input string into standard slug format
   */
  public sanitize(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  /**
   * Validate slug candidate with complete collision and governance checks
   */
  public validateSlug(
    candidate: string,
    currentOwnerId?: string,
    currentTenantId?: string
  ): SlugValidationResult {
    const sanitized = this.sanitize(candidate);

    if (sanitized.length < 3) {
      return {
        isValid: false,
        sanitizedSlug: sanitized,
        errorCode: 'TOO_SHORT',
        errorMessage: 'Public slug must be at least 3 characters in length.',
      };
    }

    if (sanitized.length > 48) {
      return {
        isValid: false,
        sanitizedSlug: sanitized,
        errorCode: 'TOO_LONG',
        errorMessage: 'Public slug cannot exceed 48 characters.',
      };
    }

    // Must match lowercase alphanumeric with single hyphens
    const regex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!regex.test(sanitized)) {
      return {
        isValid: false,
        sanitizedSlug: sanitized,
        errorCode: 'MALFORMED',
        errorMessage: 'Slug must contain only lowercase letters, numbers, and single hyphens without leading or trailing dashes.',
      };
    }

    // 1. Reserved System Route Check
    if (RESERVED_SLUGS.has(sanitized)) {
      return {
        isValid: false,
        sanitizedSlug: sanitized,
        errorCode: 'RESERVED_SYSTEM_ROUTE',
        errorMessage: `"${sanitized}" is a protected system route and cannot be reserved as a public slug.`,
      };
    }

    // 2. Deleted Account Quarantine Check (90-day cooldown to prevent brand takeover)
    const quarantine = this.quarantinedSlugs.get(sanitized);
    if (quarantine) {
      if (new Date(quarantine.quarantinedUntil) > new Date()) {
        return {
          isValid: false,
          sanitizedSlug: sanitized,
          errorCode: 'DELETED_ACCOUNT_QUARANTINE',
          errorMessage: 'This slug was recently released by a deactivated account and is quarantined for safety.',
        };
      } else {
        // Expired quarantine
        this.quarantinedSlugs.delete(sanitized);
      }
    }

    // 3. Collision / Existing Registration Check
    const existing = this.registeredSlugs.get(sanitized);
    if (existing) {
      // If already owned by the same user / entity, it is valid (re-save)
      if (currentOwnerId && existing.ownerId === currentOwnerId) {
        return {
          isValid: true,
          sanitizedSlug: sanitized,
        };
      }

      // Cross-tenant collision check
      if (currentTenantId && existing.tenantId && existing.tenantId !== currentTenantId) {
        return {
          isValid: false,
          sanitizedSlug: sanitized,
          errorCode: 'CROSS_TENANT_COLLISION',
          errorMessage: 'This public URL is already reserved by another organization or user.',
        };
      }

      return {
        isValid: false,
        sanitizedSlug: sanitized,
        errorCode: 'COLLISION_DUPLICATE',
        errorMessage: `The public slug "${sanitized}" is already claimed. Please select a unique identifier.`,
      };
    }

    return {
      isValid: true,
      sanitizedSlug: sanitized,
    };
  }

  /**
   * Register a verified unique slug for an entity
   */
  public registerSlug(
    slug: string,
    entityType: 'individual_card' | 'individual_profile' | 'company',
    ownerId: string,
    tenantId?: string
  ): boolean {
    const val = this.validateSlug(slug, ownerId, tenantId);
    if (!val.isValid) {
      throw new Error(`SLUG_REGISTRATION_FAILED: ${val.errorMessage}`);
    }

    const rec: RegisteredSlugRecord = {
      slug: val.sanitizedSlug,
      entityType,
      ownerId,
      tenantId,
      registeredAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    this.registeredSlugs.set(val.sanitizedSlug, rec);
    this.saveStorage();
    return true;
  }

  /**
   * Quarantine a slug when an account or card is deleted
   */
  public releaseSlugWithQuarantine(slug: string, quarantineDays = 90): void {
    const sanitized = this.sanitize(slug);
    this.registeredSlugs.delete(sanitized);

    const until = new Date();
    until.setDate(until.getDate() + quarantineDays);

    this.quarantinedSlugs.set(sanitized, {
      quarantinedUntil: until.toISOString(),
      reason: 'Account deactivation / Slug modification quarantine',
    });

    this.saveStorage();
  }

  /**
   * Check if a slug is currently registered
   */
  public isSlugRegistered(slug: string): boolean {
    return this.registeredSlugs.has(this.sanitize(slug));
  }

  public getSlugDetails(slug: string): RegisteredSlugRecord | undefined {
    return this.registeredSlugs.get(this.sanitize(slug));
  }

  public getReservedSlugs(): string[] {
    return Array.from(RESERVED_SLUGS);
  }
}

export const slugService = new SlugService();
