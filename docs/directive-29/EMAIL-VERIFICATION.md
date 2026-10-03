# Email verification and the App Owner boundary (Directive 29, code-only task)

Closes gap C4 from [../directive-28/AUTHORITY-PLAN.md](../directive-28/AUTHORITY-PLAN.md):
DSBC signed users up with email/password but never sent a verification
email, so no account could ever meet the App Owner's `email_verified`
requirement.

No live resource was touched. Everything below ran locally, on the Firebase
Emulator Suite (`demo-dsbc`), or in real Chrome against a production-mode
bundle wired to the emulators.

## Lifecycle

```
REGISTER (registerAccount)
  └─ Auth account + profile batch (unchanged, fails closed)
  └─ sendEmailVerification ─────────────► account emailVerified = false
                                           no App Owner authority (client, backend, rules)
user opens the emailed link ────────────► Firebase Auth: emailVerified = true
"I've verified my email"
  └─ user.reload() + getIdTokenResult(true)   (a token minted earlier still says false)
                                           still no App Owner authority (no claim)
Admin SDK: scripts/admin/setAppOwner.ts  ► claim platformRole = app_owner (+ audit APP_OWNER_GRANTED)
fresh token (refresh or sign in again)  ► App Owner authority
```

Verification never sets the claim. The only code that sets it is the Admin-SDK
script, which also refuses unverified or disabled accounts.

## What changed

| File | Change |
|---|---|
| `src/services/emailVerification.ts` (new) | `sendVerificationEmail` (reloads first; skips already-verified accounts), `refreshVerificationState` (reload + **forced** token refresh; the result comes from the token's `email_verified`), `describeVerificationError`, `RESEND_COOLDOWN_MS` |
| `src/services/authService.ts` | `registerAccount` sends the verification email after the profile commits. It returns `{ profile, verificationEmailSent, verificationError }`. A send failure does not roll back a complete account. |
| `src/context/AuthContext.tsx` | exposes `emailVerified`, `refreshEmailVerification()`, `resendVerificationEmail()`; App Owner authority is recomputed from the fresh token through the unchanged `hasVerifiedOwnerClaim` |
| `src/components/auth/EmailVerificationBanner.tsx` (new) | shown to signed-in, unverified Firebase accounts: "I've verified my email", "Resend email" (60 s cooldown; longer after a rate-limit error), "Sign in again" on an expired or disabled session, plain-language errors, a success state |
| `src/App.tsx` | mounts the banner under the workspace header |
| `AuthModal.tsx`, `CustomerRegistrationModal.tsx` | registration states that a verification link will be sent and why it matters |

**Unchanged:** `firestore.rules`, `storage.rules`, `functions/` (backend),
`src/lib/authority.ts`, the registry and every environment file.

## Behaviour decisions

- **Customers are not blocked while unverified.** The directive gates App
  Owner authority on verification, which already holds in rules, backend and
  client. Blocking customer workspaces until they verify would be a product
  decision; it would be a small change on top of this flow.
- No continue-URL in the email: Firebase's default action page confirms the
  address, and the user returns and presses "I've verified my email". This
  avoids an `auth/unauthorized-continue-uri` dependency on the not-yet-chosen
  production domain.
- No verification state in `localStorage` or any browser storage.

## Tests

| Suite | Tests | What they prove |
|---|---|---|
| `tests/unit/emailVerification.test.ts` | VERIFY-U01..U03 (19) | send/skip logic; refresh = reload then **forced** token; the token's claim wins over a stale cached one; error mapping never shows raw `auth/` codes |
| `tests/backend/email-verification.test.ts` (emulator) | VERIFY-001..011 | real `registerAccount` sends exactly one email; an unverified account is denied by the callable and the rules, and `setAppOwner` refuses it; a claim forced onto an unverified account is still denied; invalid link rejected; resend works; the link verifies, but a pre-verification token stays unverified until refreshed; resend to a verified account sends nothing; **verified without the claim is still denied**; only the grant confers authority, and only on a token minted after it; sign-out/in keeps it; disabled or deleted accounts get "sign in again" |
| `tests/e2e/email-verification.spec.ts` (real Chrome) | EV-1..3 | banner, resend + cooldown, "not verified yet"; the emulated mail link verifies; the banner clears and stays cleared after a reload; no App Owner UI until the real `setAppOwner.ts` CLI grants it and the user signs in again |

Mutants (D27 harness): V01 cached token trusted, V02 resend to a verified
account, V03 registration sends no email, V04 client ignores
`email_verified`, V05 backend ignores `email_verified`, V06 rules ignore
`email_verified`: **6/6 killed**
([evidence/mutation-verification.json](evidence/mutation-verification.json)).

Screenshots: [unverified](evidence/browser/d29-unverified-banner.png),
[verified](evidence/browser/d29-verified.png),
[owner after grant](evidence/browser/d29-owner-after-grant.png).
