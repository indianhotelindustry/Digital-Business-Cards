# Public resolution — specification

Scope: how `/card/{slug}`, `/profile/{slug}` and `/company/{slug}` are
resolved, what an anonymous visitor can and cannot obtain, and the tests that
prove it.

## Entry point

`resolvePublicEntity({ route: 'card' | 'profile' | 'company', slug, preview? })`

- It is a Cloud Functions callable, and sign-in is optional. Unknown payload
  fields are rejected (`invalid-argument`).
- A slug that fails format or reserved-route validation returns `NOT_FOUND`
  before any read.
- Outcomes:
  - `OK`, with data.
  - `NOT_FOUND`: no such slug, wrong entity type, released slug, or an
    ownership mismatch.
  - `NOT_PUBLISHED`: draft, unpublished, or hidden.
  - `UNAVAILABLE`: platform-suspended, inactive or suspended tenant, inactive
    entity, or locked seat.

## Resolution rules

A slug resolves only when every condition holds:

1. `slugs/{slug}` exists, has the route's entity type (company for `/company`,
   card for `/card` and `/profile`), and is not released or quarantined.
2. The tenant in the slug index equals the entity's tenant. If a publishing
   record exists, its tenant and slug must match too.
3. The entity exists, is `status: active`, and is not `platformSuspended`. A
   SUSPENDED publishing record means `UNAVAILABLE`.
4. `publishingRecords/{entityId}.publishingState == 'PUBLISHED'`, and the entity
   is not `publicationHidden`. Otherwise the result is `NOT_PUBLISHED`, unless
   the preview rule below applies.
5. The tenant company exists, is active, and is not platform-suspended.
6. Card and profile routes: the employee exists, **belongs to the card's
   company**, is active, has an unlocked seat, and is not suspended.
7. Profile route: the profile is not `publicationHidden`, and the tenant is
   entitled to `individual.full_profile`.
8. Company route: the team lists only active, unlocked employees whose card
   passes rules 1–4. If an employee has several cards, the first published
   one is linked.

### Preview

`preview: true` is honoured only for a signed-in member of the owning tenant,
or for the App Owner (verified claim). For anyone else it is ignored. Suspended
content is never served, preview or not. The URL flag `?preview=true` therefore
grants nothing by itself.

## What a response may contain (allow-lists)

| Projection | Fields |
|---|---|
| Company | `id, name, legalName, tagline, logoUrl, heroImageUrl, positioningStatement, industry, foundedYear, website, email, phone, whatsapp, address, operatingHours, description, mission, vision, coreValues, services, products, metrics, caseStudies, testimonials, socialLinks, branding`, plus `status: 'active'` and `slug` (published website slug or `null`). |
| Employee | `id, companyId, departmentId, firstName, lastName, displayName, designation, profilePhotoUrl, email, phone, whatsapp, bio, linkedin, website, instagram, socialLinks, otherSocialLinks`. Contact fields are removed when the profile's CONTACT section is not PUBLIC. |
| Profile | `headline, about, philosophy, location, heroImageUrl, metrics, expertise, skillCategories, services, experiences, projects, education, credentials, achievements, testimonials, socialLinks, sectionConfigs, fullProfileSections, companyProfileRef, appearance`. Sections that are not enabled and PUBLIC are removed (for example a PRIVATE EXPERIENCE section drops `experiences`). |
| Card | `id, companyId, employeeId, templateId, publicSlug, status`. |
| Department | `id, companyId, name, description, status`. Only departments used by listed team members. |

Never returned: `planId`, subscriptions, payment or invoice data, entitlements,
overrides, usage, `ownerUid`, `kind`, `tenantId`, `seatState`,
`platformSuspended`, `publicationHidden`, audit data, or publisher identities.
PUBLIC-010 checks every key at every depth.

## Forbidden to anonymous visitors (and how it is enforced)

| Content | Enforcement |
|---|---|
| DRAFT, PREVIEW or UNPUBLISHED entities | Rule 4 in the resolver. `publicationHidden` also hides the raw documents under `firestore.rules`. |
| SUSPENDED entities or tenants | Rules 3 and 5 in the resolver. `platformSuspended` and `status` in the rules. |
| Private employee and company data | Allow-listed projections. Raw documents of hidden or locked entities are unreadable under the rules. |
| Subscription, billing, entitlement, audit | Not in any projection. Collections are App Owner / tenant-only under the rules. |
| Publishing metadata | Directive 26 rule tightening (members / App Owner only). |

## Tests

`tests/backend/public-resolution.test.ts` (emulator):

- **PUBLIC-001** Anonymous published company lookup succeeds.
- **PUBLIC-002** Anonymous unpublished company lookup fails.
- **PUBLIC-003** Anonymous suspended company lookup fails.
- **PUBLIC-004** Anonymous published employee card succeeds.
- **PUBLIC-005** Anonymous draft employee card fails.
- **PUBLIC-006** `?preview=true` cannot expose draft content.
- **PUBLIC-007** Unknown slug returns not-found.
- **PUBLIC-008** Company A cannot retrieve Company B's private content.
- **PUBLIC-009** A real customer URL never falls back to demo data.
- **PUBLIC-010** The public resolver cannot expose billing, subscription or
  entitlement data.
- **PUBLIC-011** An employee remains attached to the correct tenant.
- **PUBLIC-012** The company directory exposes only published employees.
- **PUBLIC-013** A suspended tenant loses public visibility.
- **PUBLIC-014** Publication state remains server-authoritative.
- **PUBLIC-015** Cross-tenant slug takeover remains impossible.

Browser confirmation: `tests/e2e/demo-journey.spec.ts`. It covers real
websites and cards for anonymous visitors, and Draft / Not Found for
unpublished, preview, unknown and demo slugs. Mutants M24–M29 and R05 target
these rules.
