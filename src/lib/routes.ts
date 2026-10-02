// ============================================================================
// DSBC public routes (Directive 27 Phase 9)
// ============================================================================
// Canonical public URLs are paths:
//   /                      marketing home
//   /pricing               public pricing
//   /card/{slug}           employee / individual card
//   /profile/{slug}        full profile
//   /company/{slug}        company website
//   /app                   signed-in application
// Legacy hash links (/#/card/x, /#card/x) keep working: they are parsed and
// the address bar is rewritten to the canonical path. Anything else is
// NOT_FOUND (hosting also answers unknown paths with HTTP 404, firebase.production.json).

export type PublicEntityKind = 'card' | 'profile' | 'company';

export type Route =
  | { kind: 'home' }
  | { kind: 'app' }
  | { kind: 'pricing' }
  | { kind: 'marketing'; section: string }
  | { kind: PublicEntityKind; slug: string; preview: boolean }
  | { kind: 'not_found'; path: string };

/** Marketing sections that are routes of their own (single path segment). */
export const MARKETING_SECTIONS = ['marketing', 'home', 'features', 'individual', 'company', 'how-it-works', 'faq', 'contact'] as const;
const ENTITY_KINDS: readonly PublicEntityKind[] = ['card', 'profile', 'company'];
/**
 * Shape check only (a superset of shared/domain/slugRules.ts, which also covers
 * legacy slugs); whether a slug is published is decided by the backend resolver.
 */
const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Parse "card/acme?preview=true" style route text (path or legacy hash, without the leading / or #). */
export function parseRouteText(text: string): Route {
  const [pathPart, query = ''] = text.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const preview = new URLSearchParams(query).get('preview') === 'true';
  if (segments.length === 0) return { kind: 'home' };
  const [first, second, ...rest] = segments;
  if (segments.length === 1) {
    if (first === 'pricing') return { kind: 'pricing' };
    if (first === 'app' || first === 'dashboard') return { kind: 'app' };
    if ((MARKETING_SECTIONS as readonly string[]).includes(first)) return { kind: 'marketing', section: first };
  }
  if (segments.length === 2 && rest.length === 0 && (ENTITY_KINDS as readonly string[]).includes(first)) {
    const slug = decode(second);
    if (slug && SLUG.test(slug)) return { kind: first as PublicEntityKind, slug, preview };
  }
  return { kind: 'not_found', path: `/${pathPart.replace(/^\/+/, '')}` };
}

/** Route for a location: the path is canonical; a legacy hash route applies only on "/". */
export function routeFromLocation(loc: Pick<Location, 'pathname' | 'search' | 'hash'>): Route {
  const path = loc.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (path) return parseRouteText(`${path}${loc.search}`);
  const hash = loc.hash.replace(/^#\/?/, '');
  if (hash) return parseRouteText(hash);
  return { kind: 'home' };
}

/** Canonical path for a route ("/card/acme", "/card/acme?preview=true"). */
export function pathOf(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'app':
      return '/app';
    case 'pricing':
      return '/pricing';
    case 'marketing':
      return `/${route.section}`;
    case 'not_found':
      return route.path;
    default:
      return `/${route.kind}/${encodeURIComponent(route.slug)}${route.preview ? '?preview=true' : ''}`;
  }
}

/** Absolute canonical public URL for a published entity (what QR codes and share links carry). */
export function publicEntityUrl(kind: PublicEntityKind, slug: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${pathOf({ kind, slug, preview: false })}`;
}

export const ROUTE_CHANGE_EVENT = 'dsbc:routechange';

/**
 * Navigate inside the app. Accepts the same text the old hash router used
 * ("card/acme?preview=true", "pricing", "" for home) or an absolute path.
 */
export function navigate(text: string, opts: { replace?: boolean } = {}): void {
  const route = parseRouteText(text.replace(/^[#/]+/, ''));
  const target = pathOf(route);
  const current = `${window.location.pathname}${window.location.search}`;
  if (target !== current || window.location.hash) {
    window.history[opts.replace ? 'replaceState' : 'pushState'](null, '', target);
  }
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}

/** Rewrite a legacy hash URL (/#/card/x) to its canonical path without reloading. */
export function canonicalizeLegacyHash(): void {
  if (window.location.pathname !== '/' || !window.location.hash.replace(/^#\/?/, '')) return;
  const route = routeFromLocation(window.location);
  if (route.kind === 'not_found') return;
  window.history.replaceState(null, '', pathOf(route));
}

/** Subscribe to route changes (back/forward and in-app navigation). */
export function onRouteChange(fn: () => void): () => void {
  window.addEventListener('popstate', fn);
  window.addEventListener('hashchange', fn);
  window.addEventListener(ROUTE_CHANGE_EVENT, fn);
  return () => {
    window.removeEventListener('popstate', fn);
    window.removeEventListener('hashchange', fn);
    window.removeEventListener(ROUTE_CHANGE_EVENT, fn);
  };
}

/** True when the current address is an admin preview (?preview=true, or a legacy hash preview). */
export function isPreviewLocation(): boolean {
  return new URLSearchParams(window.location.search).get('preview') === 'true' || window.location.hash.includes('preview=true');
}

/** In-app route text for a public entity ("card/acme?preview=true"), for navigate(). */
export function entityRoute(kind: PublicEntityKind, slug: string, preview = false): string {
  return `${kind}/${slug}${preview ? '?preview=true' : ''}`;
}
