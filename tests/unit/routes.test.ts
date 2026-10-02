// Directive 27 Phase 5: canonical public routes and fail-closed health aggregation.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRouteText, pathOf, publicEntityUrl, routeFromLocation } from '../../src/lib/routes';
import { overallHealth, PLATFORM_HEALTH_CHECKS, type PlatformHealthCheck } from '../../shared/domain/platformHealth';
import { environmentOutcome } from '../../functions/src/platform/health';
import { evaluateBackendEnvironment } from '../../functions/src/shared/environment';

const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('ROUTE: canonical public paths', () => {
  it('ROUTE-001 /card, /profile and /company resolve to their entity with the slug', () => {
    expect(routeFromLocation(loc('/card/acme-rahul'))).toEqual({ kind: 'card', slug: 'acme-rahul', preview: false });
    expect(routeFromLocation(loc('/profile/acme-rahul'))).toEqual({ kind: 'profile', slug: 'acme-rahul', preview: false });
    expect(routeFromLocation(loc('/company/acme'))).toEqual({ kind: 'company', slug: 'acme', preview: false });
    expect(routeFromLocation(loc('/company/acme/'))).toEqual({ kind: 'company', slug: 'acme', preview: false });
  });

  it('ROUTE-002 unknown, malformed and traversal paths are NOT_FOUND (never a fallback entity)', () => {
    for (const p of ['/cards/acme', '/card', '/card/acme/extra', '/card/..', '/card/%2e%2e', '/card/a%2Fb', '/card/-x', '/card/a b', '/admin', '/company/acme/employees', '/card/%E0%A4%A']) {
      expect(routeFromLocation(loc(p)).kind, p).toBe('not_found');
    }
  });

  it('ROUTE-003 ?preview=true is only a flag; it never changes which entity is requested', () => {
    expect(routeFromLocation(loc('/card/acme', '?preview=true'))).toEqual({ kind: 'card', slug: 'acme', preview: true });
    expect(routeFromLocation(loc('/card/acme', '?preview=1'))).toEqual({ kind: 'card', slug: 'acme', preview: false });
  });

  it('ROUTE-004 legacy hash links resolve and canonical paths round-trip', () => {
    expect(routeFromLocation(loc('/', '', '#/card/acme'))).toEqual({ kind: 'card', slug: 'acme', preview: false });
    expect(routeFromLocation(loc('/', '', '#company/acme?preview=true'))).toEqual({ kind: 'company', slug: 'acme', preview: true });
    // A path always wins over a hash.
    expect(routeFromLocation(loc('/pricing', '', '#/card/acme'))).toEqual({ kind: 'pricing' });
    for (const text of ['', 'app', 'pricing', 'faq', 'card/acme', 'profile/x_y', 'company/acme?preview=true']) {
      expect(parseRouteText(pathOf(parseRouteText(text)).replace(/^\//, ''))).toEqual(parseRouteText(text));
    }
  });

  it('ROUTE-005 share links and QR codes carry the canonical path, never a hash or preview flag', () => {
    expect(publicEntityUrl('card', 'acme-rahul', 'https://cards.example/')).toBe('https://cards.example/card/acme-rahul');
    expect(publicEntityUrl('company', 'acme', 'https://cards.example')).toBe('https://cards.example/company/acme');
  });

  it('ROUTE-006 production hosting serves only public routes as the app; unknown paths get HTTP 404', () => {
    const fb = JSON.parse(readFileSync('firebase.production.json', 'utf8'));
    const rewrites: Array<{ regex?: string; source?: string }> = fb.hosting[0].rewrites;
    expect(rewrites.some((r) => r.source === '**')).toBe(false);
    const served = (path: string) => rewrites.some((r) => r.regex && new RegExp(r.regex).test(path));
    for (const p of ['/app', '/pricing', '/card/acme', '/profile/acme', '/company/acme', '/faq']) expect(served(p), p).toBe(true);
    for (const p of ['/admin', '/card/acme/x', '/card/', '/cards/acme', '/.env', '/card/../x']) expect(served(p), p).toBe(false);
  });

  it('ROUTE-007 the client router accepts the same public paths as hosting', () => {
    const fb = JSON.parse(readFileSync('firebase.production.json', 'utf8'));
    const rewrites: Array<{ regex: string }> = fb.hosting[0].rewrites;
    for (const p of ['/card/acme', '/profile/a_b-c', '/company/Acme1', '/pricing', '/app']) {
      expect(rewrites.some((r) => new RegExp(r.regex).test(p)), p).toBe(true);
      expect(routeFromLocation(loc(p)).kind, p).not.toBe('not_found');
    }
  });
});

describe('HEALTH: fail-closed aggregation', () => {
  const all = (state: PlatformHealthCheck['state']): PlatformHealthCheck[] => PLATFORM_HEALTH_CHECKS.map((id) => ({ id, state, detail: '' }));

  it('HEALTH-001 the directive’s required checks are all part of the contract', () => {
    for (const id of ['AUTH', 'FIRESTORE', 'STORAGE', 'FUNCTIONS', 'ENVIRONMENT', 'INDEXES', 'PAYMENTS', 'WEBHOOK', 'APP_OWNER', 'ENTITLEMENTS', 'PUBLIC_URL', 'NOTIFICATIONS']) {
      expect(PLATFORM_HEALTH_CHECKS).toContain(id);
    }
  });

  it('HEALTH-002 OK only when every check is OK or intentionally DISABLED', () => {
    expect(overallHealth(all('OK'))).toBe('OK');
    const mixed = all('OK').map((c) => (c.id === 'PAYMENTS' || c.id === 'WEBHOOK' ? { ...c, state: 'DISABLED' as const } : c));
    expect(overallHealth(mixed)).toBe('OK');
    for (const s of ['NOT_VERIFIED', 'NOT_CONFIGURED', 'DEGRADED'] as const) {
      expect(overallHealth(all('OK').map((c, i) => (i === 3 ? { ...c, state: s } : c))), s).toBe('DEGRADED');
    }
    expect(overallHealth(all('OK').map((c, i) => (i === 0 ? { ...c, state: 'FAIL' } : c)))).toBe('FAIL');
  });

  it('HEALTH-003 a missing or duplicated check fails closed', () => {
    expect(overallHealth(all('OK').slice(1))).toBe('FAIL');
    expect(overallHealth([])).toBe('FAIL');
    const dup = all('OK');
    dup.push({ ...dup[0] });
    expect(overallHealth(dup)).toBe('FAIL');
  });

  it('HEALTH-004 the ENVIRONMENT check fails whenever the backend target does not match the registry', () => {
    const good = evaluateBackendEnvironment({ DSBC_ENVIRONMENT: 'development', GCLOUD_PROJECT: 'demo-dsbc', DSBC_FIRESTORE_DATABASE: '(default)', DSBC_FUNCTIONS_REGION: 'us-central1', FUNCTIONS_EMULATOR: 'true' });
    expect(environmentOutcome(good).state).toBe('OK');
    const wrongDb = evaluateBackendEnvironment({ DSBC_ENVIRONMENT: 'development', GCLOUD_PROJECT: 'demo-dsbc', DSBC_FIRESTORE_DATABASE: 'other-db', DSBC_FUNCTIONS_REGION: 'us-central1', FUNCTIONS_EMULATOR: 'true' });
    expect(environmentOutcome(wrongDb)).toMatchObject({ state: 'FAIL', detail: expect.stringMatching(/DSBC_FIRESTORE_DATABASE/) });
    expect(environmentOutcome(evaluateBackendEnvironment({})).state).toBe('FAIL');
    expect(environmentOutcome({ ...good, ok: false }).state).toBe('FAIL');
  });
});
