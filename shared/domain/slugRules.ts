// ============================================================================
// Public slug rules (Directive 20 rules, Directive 25: one implementation)
// ============================================================================
// Used by the browser for instant feedback and by the backend
// (functions/src/publishing) as the authoritative check. Ownership/collision
// is decided only by the backend against slugs/{slug}.

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

export function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function validateSlugFormat(candidate: string): SlugValidationResult {
  const sanitized = sanitizeSlug(candidate);

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

  // Reserved system route check
  if (RESERVED_SLUGS.has(sanitized)) {
    return {
      isValid: false,
      sanitizedSlug: sanitized,
      errorCode: 'RESERVED_SYSTEM_ROUTE',
      errorMessage: `"${sanitized}" is a protected system route and cannot be reserved as a public slug.`,
    };
  }

  return { isValid: true, sanitizedSlug: sanitized };
}
