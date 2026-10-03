# App Owner authority plan (Phase 7)

No Auth user was listed and no claim was changed. The shared `v-nexus-lite`
pool was not enumerated (the overnight attempt was denied and not retried).

## The mechanism (D24–D25, unchanged)

| Element | Rule | Where |
|---|---|---|
| Claim | custom claim `platformRole: "app_owner"` on a Firebase Auth user | `scripts/admin/setAppOwner.ts` |
| Who can set it | only Admin SDK credentials for the production project (Application Default Credentials of an operator with `firebaseauth.admin` or Owner on **that** project); never registration, an email string or the browser | `setAppOwner.ts`, rules, backend |
| Preconditions | account exists, **email verified**, not disabled | `setAppOwner` refuses otherwise |
| Backend check | `token.platformRole === 'app_owner' && token.email_verified === true` | `functions/src/auth/identity.ts` |
| Client display | the same check on the ID token; UI only | `src/lib/authority.ts` |
| Verification | `setAppOwner.ts … --email <owner> --verify` exits 0 only if claim + verified + enabled | read-only |
| Audit | `securityAuditLogs`: `APP_OWNER_GRANTED` / `APP_OWNER_REVOKED` with actor, target, project; browsers cannot write audit logs (AUTH-018) | `setAppOwner.ts` |
| Revocation | `--uid <uid> --revoke` removes the claim and revokes refresh tokens | |
| Census | Platform Health APP_OWNER counts every claim holder; holders without a verified email → DEGRADED | `functions/src/platform/health.ts` |

In a dedicated project the census sees only DSBC accounts. In `v-nexus-lite`
it would have enumerated every app's users, which is one more reason for Option A.

## Gap found: no email-verification flow in DSBC

DSBC signs users up with `createUserWithEmailAndPassword`, but nothing in
`src/` calls `sendEmailVerification`. An owner who registers through the DSBC
UI therefore has `emailVerified = false` forever, and `setAppOwner` (correctly)
refuses to grant the claim.

| Way to get a verified owner account | Assessment |
|---|---|
| **Add a "verify your email" step to DSBC** (`sendEmailVerification` after sign-up + resend button; Firebase sends the mail) | **Recommended**. A small, testable change for the next directive. It also lets customers prove their email. |
| Owner signs in once with Google (verified by Google) in a DSBC build that offers Google sign-in | needs a Google provider in the dedicated project and a UI change |
| Operator sets `emailVerified: true` with the Admin SDK after confirming the mailbox out of band | possible but weaker: a human attestation replaces proof. Only if recorded in the audit log with the evidence. |

## Steps to establish the real App Owner (dedicated project)

| # | Step | Type |
|---|---|---|
| 1 | Owner names the **email address** that will be the DSBC App Owner (not invented; the legacy rules' allow-list is evidence of a candidate, not a designation) | **HUMAN** |
| 2 | Ship the email-verification step (recommended) | AUTOMATED (code + tests, next directive) |
| 3 | Owner registers at the DSBC production origin and verifies the email | **HUMAN** |
| 4 | Operator with Admin access to the **new** project: `npx tsx scripts/admin/setAppOwner.ts --project <p> --confirm-project <p> --database dsbc-production --email <owner>` | **HUMAN** (credentials) |
| 5 | `… --email <owner> --verify` → exit 0; owner signs out and in | AUTOMATED check + HUMAN sign-in |
| 6 | Owner opens Platform Health: APP_OWNER = OK with exactly one claim holder | HUMAN observation, recorded |

Ordering (RUNBOOK): grant the claim **right after** the rules deploy. Before
that it has no effect.
