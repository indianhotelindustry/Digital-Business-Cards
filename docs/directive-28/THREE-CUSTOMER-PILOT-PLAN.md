# Three-customer pilot plan (Phase 12)

No customer was created in any live environment during Directive 28.

## Does the proposed architecture support the pilot?

| Need | Supported by | Proven where (non-live) |
|---|---|---|
| Register (email/password) | Auth in the dedicated project with Email/Password **enabled** (it is disabled in `v-nexus-lite`) | REH-R1..R3 (emulator) |
| Create a company | backend + rules in `dsbc-production` | REH-R1..R3, AUTH-001/002 |
| ≥ 1 employee | backend; seat enforcement by Firestore triggers (needs Eventarc) | REH-SERVER, AUTH-010/012 |
| Employee card | backend publishing + `slugs` | REH-R*, PUBLIC-001..015 |
| Company website + publish | `setPublishingState` + `resolvePublicEntity` | REH-PUBLIC, REH-NAV |
| Public company / card URLs | hosting `/company/<slug>`, `/card/<slug>` on the DSBC origin | REH-PUBLIC, REH-404, ROUTE-001..007 |
| Logos / photos | default bucket of the dedicated project, backend-only uploads | D25 upload tests |
| Complete isolation A ↔ B ↔ C | rules (559 tests), backend tenancy (AUTH-012, three-customer-demo 25 tests), clean-browser checks | REH-SERVER, REH-PUBLIC, demo-journey Browser C/E |
| Data persists across logout/login | Firestore + Auth | REH-PERSIST |
| Unpublish → not found | publishing records | REH-UNPUBLISH |
| App Owner oversight | claim + Demo Readiness + Platform Health | REH-OWNER |
| Payments | **disabled**; every customer starts on a free plan or an App Owner complimentary grant (audited) | AUTH-003/005/009 |

Nothing in the architecture is shared with another application, so a pilot
customer's data, sign-in and uploads cannot meet V-Nexus Lite's, and the reverse.

## Pilot run (after the provisioning steps 1–14 pass)

For each of **Customer A, B, C** (real pilot customers, each on their own
device or a clean browser profile):

1. Register at the DSBC origin and verify the email.
2. Create the company (name, branding upload).
3. Add at least one employee; create that employee's card.
4. Build the company website; publish the website and the card.
5. From a **different, signed-out** browser: open `/company/<slug>` and
   `/card/<slug>`, and scan the QR code.
6. Log out, log back in: data intact.
7. Unpublish the card: the public URL shows not-found; republish.

Isolation matrix, recorded per pair (6 directed pairs): signed in as X, try to
open Y's dashboard, employees and unpublished content by URL. Expected: denied
or not-found, with nothing of Y rendered. A ↛ B, A ↛ C, B ↛ A, B ↛ C, C ↛ A, C ↛ B.

App Owner: Demo Readiness shows **3 of 3**; Platform Health overall OK (or
only intentionally DISABLED / NOT_CONFIGURED checks, recorded).

## Evidence format

`docs/overnight/evidence/live-acceptance.json` (schema in
[../overnight/THREE-CUSTOMER-RESULTS.md](../overnight/THREE-CUSTOMER-RESULTS.md)),
measured by `liveProbe.mjs` → LIVE_ACCEPTANCE, then the five-level gate.
