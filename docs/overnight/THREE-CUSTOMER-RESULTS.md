# Three-customer live rehearsal (Phase 9)

**Live result: NOT EXECUTED.** Customers A, B and C were **not** created on any
live deployment, because none exists ([BLOCKERS.md](BLOCKERS.md)). No live
customer, employee, card, website or slug was created, and no live data was
touched.

| | Customer A | Customer B | Customer C |
|---|---|---|---|
| Company account (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| ≥ 1 employee (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Employee card (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Company website (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Published + public verification (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Isolation from the other two (live) | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |

## Existing data on the live DSBC database (read-only discovery)

| | Count |
|---|---|
| companies | 2, both legacy in-app demo data (`DEMO_CANDIDATE`) |
| users | 2 (one legacy `role: app_owner` profile, excluded from customers) |
| employees / departments / cards | 2 / 2 / 2 |
| subscriptions / publishing records / slugs | 0 / 0 / 0 |
| real customers | **0** |

Neither demo company has a verified sign-in. One has an admin profile whose
Auth account no longer exists. Both carry a browser-written paid `planId`
(`enterprise`, `growth`), which is **not** evidence of payment. Nothing was
changed. Discovery hash: `49d3a426f733b7fbb9435b180906b8534fd2a81d4f1acfed07e9208d067c4121`.

## Non-live evidence (emulator, real Chrome, production-mode bundle)

Re-run overnight on 2026-10-03 at code commit `37c5c7b`, 20/20 passed. This shows the three-customer
flow works in code. It does **not** count as live acceptance.

| Test | Result |
|---|---|
| REH-R1 / REH-R2 / REH-R3: register → company → employee → card + website published | passed ×3 |
| REH-SERVER: each employee and card belongs to exactly its own company | passed |
| REH-PUBLIC: every website, card and profile renders in a clean browser with only its own data | passed |
| REH-NAV: website → card → website uses canonical paths | passed |
| REH-PERSIST: data survives a reload and a brand-new browser | passed |
| REH-UNPUBLISH: unpublished content disappears; `?preview=true` is no bypass | passed |
| REH-404: unknown slugs and paths show not-found, never demo content | passed |
| REH-LEGACY: old hash links are rewritten to the canonical path | passed |
| REH-OWNER: App Owner sees all three customers and measured platform health | passed |
| D26 demo-journey Browsers A–E (A/B/C three-way isolation, anonymous visitor, App Owner) | 9/9 passed |
| Backend `three-customer-demo.test.ts` (emulator) | 25/25 passed |

## Recording a live run (for the gate)

The gate (`certify.mjs` via `liveProbe.mjs`) accepts live acceptance only from
`docs/overnight/evidence/live-acceptance.json`. The file must match the HEAD
commit and the designated public origin, and include all three customers and
the isolation result:

```json
{
  "commit": "<HEAD sha>",
  "origin": "<registry publicOrigin>",
  "customers": [
    { "id": "A", "passed": true, "company": "...", "employees": 1, "cardUrl": "...", "websiteUrl": "...", "unpublish404": true, "persistence": true },
    { "id": "B", "passed": true },
    { "id": "C", "passed": true }
  ],
  "isolation": { "passed": true, "matrix": "A↛B,C · B↛A,C · C↛A,B" }
}
```

Live Acceptance also requires live Platform Health (`live-health.json`, called
by the signed-in App Owner on the deployed backend) to be OK.
