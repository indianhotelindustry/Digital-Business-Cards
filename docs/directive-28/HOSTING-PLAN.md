# Hosting and domain plan (Phase 9)

`https://v-nexus-lite.web.app` is **V-Nexus Lite's** site and is never DSBC's
public URL. `vidwan-kids.web.app` belongs to Vidwan Kids. Neither is touched.
No DNS was changed.

## Public URL

| Item | Plan | Who |
|---|---|---|
| Hosting site | the dedicated project's **default site** (`<project>`), bound to target `dsbc-web` (`firebase target:apply hosting dsbc-web <project> --project <project> --config firebase.production.json`) | automated after the project exists |
| Interim public origin | `https://<project>.web.app` (Firebase-managed TLS) | automated |
| Final public origin | a custom domain the owner controls, e.g. `cards.<owner's domain>` | **HUMAN: choose the domain** |
| DNS | Firebase Console → Hosting → *Add custom domain* gives the TXT (ownership) and A records; the owner adds them at their DNS provider | **HUMAN** |
| TLS | Firebase Hosting provisions the certificate automatically once DNS verifies (can take hours) | automatic |
| Registry | `publicOrigin` = the final origin, **and** `DSBC_PUBLIC_ORIGIN` in `functions/.env.<project>` (the backend refuses to load if they differ) | automated after the domain is chosen |
| Auth authorized domains | `<project>.web.app`, `<project>.firebaseapp.com`, the custom domain; **no** AI Studio domains | automated (Console or Identity Toolkit config) |

Choose the custom domain **before** the pilot. QR codes are printed and shared;
changing the origin later breaks every QR code already in circulation. If no
origin is registered, `canonicalOrigin()` falls back to whatever host served
the page (`src/lib/environment.ts`), so codes would carry the interim domain.

## Canonical URLs (all served by the same hosting site)

| Entity | URL | Source |
|---|---|---|
| Company website | `https://<origin>/company/<slug>` | `publicEntityUrl('company', slug, origin)` |
| Employee card | `https://<origin>/card/<slug>` | `publicEntityUrl('card', slug, origin)` |
| Profile | `https://<origin>/profile/<slug>` | `publicEntityUrl('profile', slug, origin)` |
| QR code | encodes exactly the card/company URL above | `PublishingPanel`, `PublicCompanyPage` |
| Marketing / app | `/`, `/pricing`, `/features`, `/app`, `/dashboard`, … | `firebase.production.json` rewrites |
| Anything else | HTTP **404** with the in-app not-found page | no catch-all rewrite (ROUTE / REH-404, mutant P04) |
| Build identity | `/build-info.json` (commit + target) | `liveProbe.mjs` HOSTING_DEPLOYED |

Slugs: `^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$`. Reserved slugs come from
`shared/domain/slugRules.ts` (bootstrapped into `platformConfig/deployment`).
Unpublished content returns not-found; `?preview=true` is no bypass (REH-UNPUBLISH).

## Security headers (already in `firebase.production.json`)

`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geo off),
`Strict-Transport-Security` (1 year), immutable caching for `/assets/**`,
`no-cache` for HTML.
