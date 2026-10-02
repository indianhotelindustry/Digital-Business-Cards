# Production configuration (Directive 27 Phase 1)

## One registry, three places that must agree

[config/environments.json](../../config/environments.json) is the **only** list of
deployment targets. Nothing in it is secret: the Firebase web configuration is
public by design and protected by Auth, security rules and the backend.

| Consumer | How it selects a target | Fails closed when |
|---|---|---|
| Client bundle | `VITE_DSBC_ENV` from the committed `.env.<mode>` (build time) → [src/lib/environmentResolver.ts](../../src/lib/environmentResolver.ts) | unset / unknown / undesignated target; production with emulators, `(default)` database, demo data or a `demo-*` project; development without emulators. The build stops; a misconfigured bundle renders "This deployment is misconfigured" and never initialises Firebase. |
| Backend | `DSBC_ENVIRONMENT` and friends from `functions/.env.<projectId>` → [functions/src/shared/environment.ts](../../functions/src/shared/environment.ts) | the runtime project, database, region, public origin or payment switch differ from the registry. `index.ts` throws at load, so `firebase deploy` discovery and every cold start fail. |
| Deploy | [firebase.production.json](../../firebase.production.json), [.firebaserc](../../.firebaserc) | checked by the preflight; `.firebaserc` defaults to `demo-dsbc`, so a bare `firebase deploy` cannot reach production. |

The environment is **never** inferred from the hostname, the URL, localStorage
or anything else at runtime (ENV-009). The resolved object is frozen (ENV-008).

| Mode | `.env` file | Target | Used by |
|---|---|---|---|
| `vite build` | `.env.production` | production | release bundle |
| `vite build --mode staging` | `.env.staging` | staging | fails until a staging project is designated |
| `vite` (dev server) | `.env.development` | development (emulators) | local development |
| `vite build --mode e2e` | `.env.e2e` | development (emulators), production-mode bundle | browser tests |
| vitest | `.env.test` | development (emulators) | tests |

> **Behaviour change.** `npm run dev` used to talk to the live project. It now
> requires the local emulators (`firebase emulators:start --project demo-dsbc`),
> so development can never touch customer data.

## Current targets

| | Development | Staging | Production |
|---|---|---|---|
| Firebase project | `demo-dsbc` (emulators) | **not designated** | `v-nexus-lite` |
| Firestore database | `(default)` | n/a | `ai-studio-37d17c3e-5c08-4bde-9163-8b8b6e0b2bb5` (Enterprise edition, `us-west1`) |
| Storage bucket | `demo-dsbc.appspot.com` | n/a | `v-nexus-lite.firebasestorage.app` |
| Functions region | `us-central1` | n/a | `us-west1` (same region as the database, required for Firestore triggers) |
| Hosting site | `demo-dsbc` | n/a | **not designated** |
| Public origin | none | n/a | **not designated** |
| Demo data / personas / dev tools | allowed | n/a | never |
| Payments | disabled | n/a | disabled |

## Designations only the App Owner can make

1. **Hosting site.** Create or choose a site, set `hosting.site` in the registry, then run
   `firebase target:apply hosting dsbc-web <site> --project v-nexus-lite`.
2. **Public origin.** For example `https://cards.example.com`. Set `publicOrigin` in the
   registry **and** `DSBC_PUBLIC_ORIGIN` in `functions/.env.v-nexus-lite` (the
   backend refuses to load if they differ). Share links and QR codes use it.
3. **Staging.** A separate Firebase project with no customer data. Fill in the
   `staging` entry and add `functions/.env.<stagingProject>`.
4. **Storage bucket ownership.** `v-nexus-lite` also hosts other AI Studio
   apps. Deploying `storage.rules` replaces the rules of the **whole bucket**.
   Confirm no other app uses `v-nexus-lite.firebasestorage.app`, or provision a
   dedicated DSBC bucket and register it.

After any change: `npx vite build && npx tsx scripts/directive27/preflight.ts`.

## Secrets

- Browser: none. The production bundle is scanned by
  [scripts/directive27/secretsAudit.mjs](../../scripts/directive27/secretsAudit.mjs)
  (source, bundle, git history).
- Backend: `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` live only in
  Secret Manager. They must **exist** before `firebase deploy` (the payment
  functions declare them), even while `PAYMENTS_ENABLED=false`.
- Git history contains placeholder Razorpay key ids from the original export
  (a fake live and a fake test key id; see `secrets-audit.json` →
  `gitHistory`). They are not real credentials and were removed from the
  source in this directive. They are reported as INVESTIGATE, not FAIL.
  Documentation never quotes key-shaped strings: the source scan treats every
  tracked file, docs included, as source.

## Indexes

Every backend query is an equality filter, so no composite index is needed
(`firestore.indexes.json` is empty). Platform Health's INDEXES check
**executes** each backend query shape against the live database and fails if
one needs an index.
