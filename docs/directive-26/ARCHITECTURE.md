# Directive 26 — Architecture changes

Scope: what Directive 26 added on top of the Directive 24–25 security
architecture, and what it deliberately did not change. Nothing here is
deployed; all evidence comes from the Firebase Emulator Suite and real Chrome
against the production build.

## 1. Invariants kept

- Firestore rules were only **tightened** (see §5). The Directive 24 suite still
  passes 433/433 and every Directive 25 authority test (AUTH-001..025) passes.
- All commercial, publishing and quota authority stays in Cloud Functions with
  the audit ledger. No new path lets a browser change publication, plans,
  subscriptions or another tenant's data.
- The App Owner gained a **read-only** readiness view. It has no new editing
  powers (Phase 9).

## 2. Public resolution (Phases 1 and 2)

```
Visitor (no sign-in)                Backend (Admin SDK)                       Firestore
#card/{slug}    ─┐                  resolvePublicEntity({route, slug,         slugs/{slug}
#profile/{slug} ─┼─ publicResolver ─►  preview?})                       ────► publishingRecords/{id}
#company/{slug} ─┘   (browser)        • slug ↔ record ↔ entity ↔ tenant agree  cards / companies / employees
                                      • PUBLISHED, not hidden, not suspended   digitalIdentityProfiles
                                      • tenant active, seat unlocked           departments
                                      • allow-listed projection only
                    ◄── OK | NOT_FOUND | NOT_PUBLISHED | UNAVAILABLE ──
```

- `functions/src/public/resolver.ts` (callable, sign-in optional) is the only way
  a public route reads content. Browser list queries over `cards` / `companies`
  cannot be proven by the rules, which is why anonymous visitors previously
  received demo data.
- `src/services/publicResolver.ts` is the browser client. `PublicCardPage`,
  `PublicCompanyPage` and `PublicProfilePage` use it exclusively. Their outcomes
  are the real content, Not Found, Draft/Unpublished, Unavailable, or a load
  error. There is no demo fallback.
- Details: [PUBLIC-RESOLUTION.md](PUBLIC-RESOLUTION.md).

## 3. Demo-data policy (Phase 2)

| Where | Before | Directive 26 |
|---|---|---|
| Public routes | Signed-out visitors always got `demoStore` data. Real slugs resolved to "not found" or to demo companies. | Backend resolver only. |
| Signed-in services | Any Firestore error, or a missing document, was replaced by `demoStore` data. Writes "succeeded" into localStorage. | `demoStore` is a guarded proxy. Every call throws unless demo features are on (vite dev) **and** there is no Firebase session. Missing documents return `null`. |
| Website copy | Real companies were given invented mission, values, metrics ("50+ projects", "99% satisfaction"), a certification and a stock service. Any slug containing "acme" or "nexus" got the demo company's content. | Sample content is limited to the two built-in demo tenants, matched by id. Real websites show only what the customer entered, and sections without content are hidden. |
| Card template | The Acme tagline and stock slogans appeared on every card. | The company's own tagline only. |
| Firestore writes | Empty optional fields (`undefined`) made writes throw, which led to the silent demo fallback. | `ignoreUndefinedProperties: true`. |

## 4. Customer journeys (Phases 3–5)

- **Publishing UI.** `src/components/publishing/PublishingPanel.tsx` shows status,
  public address, Publish / Unpublish, preview, the live URL and a QR code. It
  uses only the backend `setPublishingState`. It is used for the company
  website (Company Profile) and for employee cards (Employees & Cards →
  Publish). Before this, nothing in the signed-in UI published anything.
- **Branding.** The logo is uploaded through `uploadAsset` (validated and
  quota-checked). In the emulator, the download URL points at the Storage
  emulator.
- **Employee creation** writes the employee before its card, so the card rule
  can verify tenant ownership. Slug candidates are checked against the
  backend slug index; the old `cards.publicSlug` query was unprovable under the
  rules.
- **The onboarding wizard** starts from the real company record and saves what
  the customer enters before publishing. It opens after registration only, not
  after every sign-in.
- **Enquiries.** `functions/src/public/leads.ts` `submitPublicLead` writes the
  visitor's enquiry into the right company's CRM. The tenant is derived from a
  publicly resolvable slug and cannot be chosen by the visitor. It applies
  field validation, a honeypot and an hourly cap of 30 per company.
- **The website ↔ team ↔ card loop** uses only resolver data. The directory lists
  members with a published card. A card links to its company website only when
  that website is published.

## 5. Firestore rule changes (tightening only)

| Collection | Directive 25 | Directive 26 |
|---|---|---|
| `publishingRecords` | Readable by anyone once PUBLISHED; it holds the tenant id and the publisher's uid. | Tenant members and the App Owner only. |
| `slugs` | Public. | Signed-in users only (for slug-availability checks). |

## 6. Demo readiness (Phases 8 and 9)

- `functions/src/customers/readiness.ts` `adminGetDemoReadiness` is App Owner only
  and read-only. It checks account, company, branding, website, employee,
  employee card, published, public URL and QR, using the same anonymous
  resolver as the public routes. Each failing check names the existing audited
  control that fixes it.
- `src/components/saas/SaaSDemoReadinessTab.tsx` is the App Owner tab "Demo
  Readiness". Details: [DEMO-READINESS.md](DEMO-READINESS.md).

## 7. New backend surface

| Function | Caller | Purpose |
|---|---|---|
| `resolvePublicEntity` | anyone | Public resolution (preview only for the owning tenant or the App Owner). |
| `submitPublicLead` | anyone | Website enquiry into the company CRM. |
| `adminGetDemoReadiness` | App Owner | Read-only readiness report. |

## 8. Tooling

| Command | What |
|---|---|
| `node scripts/directive26/baseline.mjs` | Phase 0 baseline: typecheck, builds, all suites with JSON evidence. |
| `npm run test:backend` | Emulator suites, 130 tests: Directive 25 authority (85), public resolution (20), three-customer pilot (25). |
| `npm run test:browser` | Real Chrome, production build, emulators, 9 scenarios. |
| `DSBC_MUTATION_OUT=docs/directive-26/evidence/mutation-testing.json node scripts/directive25/mutationTest.mjs` | 36 authorization mutants. |
| `node scripts/directive26/certify.mjs` | Phase 12 certification: `docs/directive-26/certification.json`. |
