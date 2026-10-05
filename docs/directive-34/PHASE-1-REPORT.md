# Directive 34 — Phase 1 (Google sign-in foundation): certification report

**Status: implemented and verified on branch `security-foundation/directive-27`. Nothing is deployed. Awaiting the founder's explicit deploy approval.**

Phase 1 was implemented in 13 commits (`63aefc1..46421e2`) and certified against the local
Firebase Emulator Suite (project `demo-dsbc`) only. No live Firebase project was written to at
any point, and the production read-only checks below confirm production is still on the
pre-Phase-1 release.

---

## 1. Commit and working-tree state

| | |
|---|---|
| Branch | `security-foundation/directive-27` (not `main`) |
| Phase 1 commits | **13**, `63aefc1..46421e2`, on top of the plan commit `63aefc1` |
| Implementation complete at | `46421e2` *fix(d34): mobile marketing menu gets Sign In and a labelled toggle; tighten Google sign-in journeys* |
| Code changes after `46421e2` | **one**, from the final review: `src/components/auth/SignInScreen.tsx` gains a "sign in with email" route out of the `no_account` / `not_company_admin` screens (§2, and the reasoning in §10 risk 6). The suite totals in §5 were re-measured after it. |

Working tree at certification — tracked files are clean except for documentation; the following
are **untracked** and are not part of Phase 1:

| Untracked path | What it is |
|---|---|
| `tests/unit/accountService.test.ts` | A Directive 30 regression test (3 tests, passing) that was never committed. It is **not** D34 work. It inflates the unit totals measured on this working tree — see §5. |
| `.firebase/hosting.ZGlzdA.cache` | Firebase CLI local upload cache |
| `.vscode/settings.json` | Local editor settings |
| `docs/directive-27/evidence/bootstrap/*.json` | Two Directive 27 bootstrap evidence files |

Modified and committed by this report: `docs/directive-34/PLAN.md` (the Phase 1 status line, and
two references to a `registerAccount` callable that Task 3 split into `registerIndividual` /
`registerCompany`), this file, and the browser evidence listed in §5.

---

## 2. Files changed in Phase 1

77 files, +4380 / −924 across `63aefc1^..46421e2` (the 13 implementation commits plus the plan
commit `63aefc1`). By area:

**Backend (Cloud Functions) — deployable**
- `functions/src/auth/session.ts` (new, 115 lines) — `resolveSession`, `registerIndividual`, `registerCompany`
- `functions/src/index.ts` — exports the three new callables
- `functions/src/auth/identity.ts` — `Caller.signInProvider` from the verified token's `firebase.sign_in_provider`
- `functions/src/customers/activation.ts` — `getMyAccountState` returns `no_account` (was `pending_approval`) for a signed-in identity with no DSBC profile
- `functions/src/platform/migration.ts` — carries the new `Caller` field

**Security rules — deployable**
- `firestore.rules` (+10/−84) — browser-side creation of `users` and `tenants` is now `allow create: if false`; `companies` only by the App Owner (until Phase 2). The three registration validator functions (`isValidRegistrationProfile`, `isValidTenantRecord`, `isValidSelfRegisteredCompany`) and `isRegistrationInProgress` are deleted. No read, update or delete rule changes.

**Shared domain**
- `shared/domain/registrationModel.ts` (new, 160 lines), `shared/domain/sessionRouting.ts` (new, 44 lines)

**Client (hosting) — deployable**
- `src/services/googleAuthService.ts` (new) — the one Google auth service (popup, redirect fallback, linking, error copy)
- `src/services/sessionService.ts` (new) — `resolveSession` / `registerIndividual` / `registerCompany`
- `src/components/auth/SignInScreen.tsx` (new), `signInErrorCopy.ts` (new), `LinkGoogleBanner.tsx` (new). **Review fix:** the `no_account` and `not_company_admin` phases now also offer "Existing account? Sign in with email" (the same label the `choose` phase and `googleAuthService`'s account-exists copy already use), routed through the existing `onOpenLegacyLogin` prop. Without it, an existing DSBC user whose Google address differs from their account email was offered only "Create Free Card" / "Register as Company", either of which would have created a **second** active account for the same person. See §10 risk 6.
- `src/components/auth/CustomerRegistrationModal.tsx` **deleted** (−290); `AuthModal.tsx` reduced to sign-in only (+44/−181)
- `src/App.tsx`, `src/context/AuthContext.tsx`, `src/services/authService.ts`, `src/services/registrationModel.ts`, `src/lib/backend.ts`, `src/lib/accountGate.ts`, `src/components/public/PublicMarketingPage.tsx`, `src/components/views/EmployeePortalView.tsx`, `src/components/views/IndividualHomeView.tsx`

**Tests and evidence (not deployed)**
- `tests/backend/d34-session.test.ts` (new, 19 tests), `tests/rules/d34-registration-closed.test.ts` (new, 4 tests), `tests/e2e/d34-google-sign-in.spec.ts` (new, 7 specs), `tests/unit/googleAuthService.test.ts`, `tests/unit/sessionRouting.test.ts`, `tests/unit/signInErrorCopy.test.ts` (new)
- Edited to match the closed rules: `tests/backend/email-verification.test.ts`, `tests/backend/support/backendEnv.ts`, `tests/rules/activation-gate.test.ts`, `tests/rules/phase2-identity.test.ts`, `tests/rules/phase3-bootstrap.test.ts`, `tests/unit/registrationModel.test.ts`, `tests/e2e/{card-creation,demo-journey,production-rehearsal}.spec.ts`, `tests/e2e/support/journey.ts`
- `docs/directive-34/PLAN.md`, `docs/directive-34/evidence/browser/` (33 screenshots + `results.json`), `docs/plans/2026-10-04-d34-phase1-google-sign-in.md`

---

## 3. Firebase Auth changes: none

Phase 1 changes **no** Firebase Auth project configuration.

| Setting | Before and after |
|---|---|
| `google.com` provider | enabled (already enabled before Phase 1) |
| Email/password provider | **enabled — deliberately left on** so existing password users keep working |
| One account per email (`allowDuplicateEmails`) | `false` |
| Authorized domains | `localhost`, `task360-ift.firebaseapp.com`, `task360-ift.web.app` |

Disabling email/password is **Phase 3** and needs its own founder approval.

---

## 4. Identity linking: the same Firebase UID is kept

The risk this phase had to retire is an existing password user ending up with a second Firebase
UID (and so a second, empty workspace). Evidence, all against real Auth-emulator identities:

| Test | What it proves |
|---|---|
| `D34-AUTH-002/030` (backend, `tests/backend/d34-session.test.ts`) | Link Google onto a password account → `linked.user.uid === password uid`; signing in afterwards with that Google credential returns the **same** UID; `providerData` is `['google.com','password']`; exactly **one** Auth user holds that email. |
| `D34-AUTH-030` (backend) | A Google credential already owned by a different Firebase user is **never** merged: `auth/credential-already-in-use`, and both users keep their original single provider. |
| `D34-AUTH-002` (backend) | The owner may link a Google identity whose email differs from the account email (no same-email or Gmail-only matching); the DSBC account's email is unchanged by linking. |
| `D34-AUTH-019/020` (backend, `resolveSession`) | The two existing production-shaped password accounts (App Owner, company owner) still resolve to their own workspaces. |
| `D34-E2E-7` (browser, real Chrome) | End to end: a password account signs in by email, clicks **Link Google**, signs out, signs in with Google, and lands in the **same** workspace. Screenshots `d34-e2e-7-link-google-banner.png`, `d34-e2e-7-google-same-workspace.png`. |

Caveat carried forward from Task 7: the emulator uses synthetic Google ID tokens, so the real
`auth/credential-already-in-use` behaviour against Google's own IdP is observed for the first
time in the production verification in §9.

---

## 5. Tests — exact totals

Every figure below comes from the named command's own output, and every one is backed by a log
file or committed JSON named in the last column — nothing here is inferred or carried over from
memory. Project for every emulator suite is `demo-dsbc`; nothing can reach a real project. All of
it ran against the single tree `46421e2` (no code changed between the two dates). Log paths are
relative to `.superpowers/sdd/2026-10-04-d34-phase1-google-sign-in/`.

| Suite | Command | Result | Measured |
|---|---|---|---|
| Typecheck (app) | `npm run typecheck` | **clean**, no errors, exit 0 | 10-05, `logs/tc-root-final.log` |
| Typecheck (functions) | `npm --prefix functions run typecheck` | **clean**, no errors, exit 0 | 10-05, `logs/tc-fn-final.log` |
| Unit (this working tree) | `npm run test:unit` | **162/162 passed, 18 files**, exit 0 — includes the 3 untracked D30 tests | 10-05, `logs/unit-final.log` |
| Unit (committed tree only) | `npx vitest run --exclude "**/accountService.test.ts"` | **159/159 passed, 17 files**, exit 0 | 10-05, `logs/unit-committed-tree.log` |
| Rules | `npm run test:rules` | **588/588 passed, 8 files**, 45.3 s, script exit **0** | 10-04, `logs/rules.log` |
| Integration | `npm run test:integration` | **24/24 passed, 2 files**, 27.2 s, script exit **0** | 10-04, `logs/integ.log` |
| Backend authority | `npm run test:backend` | **194/194 passed, 10 files**, 144.1 s, script exit **0** | 10-05 (see §11) |
| Browser (real Chrome, full suite) | `node scripts/directive26/runBrowserTests.mjs` | **38/38 specs passed**, 0 unexpected, 0 flaky, 2.7 min, script exit **0** | 10-05, `logs/browser-final.log` + `results-final.json` |
| Production build | `npx vite build` | **exit 0** — 1881 modules, built in 5.46 s (`dist/index.html` 1.06 kB, CSS 107.47 kB, `index-*.js` 238.66 kB, `App-*.js` 1710.23 kB; the >500 kB chunk warning is pre-existing) | 10-05 |

"10-04" figures are the logs in `logs/`, all timestamped after the last code commit (22:13). They
were not re-run on 10-05 because the tree is byte-identical and re-running them would buy nothing.
The 10-05 backend, browser and build runs were performed for this report; their console logs live
in the session scratchpad (not committed), and the browser run's machine-readable result is
committed as `results-task9-remaining.json`.

Note on the unit total: 3 of the 162 tests come from the untracked Directive 30 file
`tests/unit/accountService.test.ts` (§1). A clean checkout of `46421e2` therefore measures
**159/159 in 17 files**. Both numbers are given so neither is a surprise later.

### Browser suite detail (real Chrome, production-mode bundle, emulator-backed)

The e2e suite is 38 specs in 5 files. **All 38 passed in a single full-suite run** after the
`SignInScreen` fix below, so there is no split-run or timing caveat to carry:

```bash
DSBC_BROWSER_OUT=docs/directive-34/evidence/browser/results-final.json \
  node scripts/directive26/runBrowserTests.mjs
```

| Spec file | Specs |
|---|---|
| `card-creation.spec.ts` | 8 |
| `d34-google-sign-in.spec.ts` | 7 |
| `demo-journey.spec.ts` | 9 |
| `email-verification.spec.ts` | 3 |
| `production-rehearsal.spec.ts` | 11 |
| **Total** | **38 expected, 38 passed, 0 unexpected, 0 flaky**, 2.7 min, script exit **0** |

Evidence: `docs/directive-34/evidence/browser/results-final.json`, console log
`logs/browser-final.log`. `DSBC_BROWSER_OUT` was pointed at a new file so Playwright's JSON
reporter could not overwrite earlier committed evidence; `results.json` (the Task 8 18-spec run)
and `results-task9-remaining.json` (the Task 9 20-spec run) are both unchanged and remain in the
repo as the history of how this suite was certified.

This full run supersedes the earlier two partial runs. It also closes two caveats those runs
carried: the 18 + 20 split, and the fact that the 18-spec `results.json` finished 26 seconds
*before* the commit it was attributed to. This run began well after its tree was final.

**A coverage change behind the "38/38, 0 flaky".** Phase 1 made free registrations active
immediately, so Task 8 removed the `activate()` approval callbacks from the `card-creation`,
`production-rehearsal` and `email-verification` journeys (commit `a53096d`; verified: `activate(`
no longer appears anywhere under `tests/e2e/`). The Directive 30 App-Owner **approval** journey
therefore no longer has browser-level, end-to-end coverage. The behaviour itself is still pinned
at two lower levels — `tests/backend/activation.test.ts` (29 cases) and `tests/unit/accountGate.test.ts`
— so nothing is untested, but it is no longer exercised through a real browser. This matters
beyond Phase 1: **Phase 2 and the SHSPL offline-payment confirmation depend on that approval
path**, so Phase 2 should restore a browser-level approval journey rather than inherit this gap.
The green totals above are true; this is what they no longer cover.

The full run regenerated **21** of the journeys' own screenshots in
`docs/directive-34/evidence/browser/`; they are committed, so the screenshot evidence matches the
certified tree. Among them, `d34-e2e-4-not-authorized.png` is the visual confirmation of the
`SignInScreen` review fix: the "Existing account? Sign in with email" route now appears on that
screen between "Register as Company" and "Use a different Google account".

---

## 6. Production read-only verification (controller, 2026-10-04, before any deploy)

Allow-listed fields only; no hash configuration or secrets were printed. Source:
`.superpowers/sdd/2026-10-04-d34-phase1-google-sign-in/prod-readonly.md`.

| Check | Result |
|---|---|
| Auth providers (`task360-ift`) | email/password **enabled**; `google.com` **enabled** (unchanged) |
| One account per email | `allowDuplicateEmails: false` |
| Improved email privacy | on |
| Authorized domains | `localhost`, `task360-ift.firebaseapp.com`, `task360-ift.web.app` |
| App Owner `qwDfeo…` | providers `[password]`; email verified; not disabled; `platformRole` claim present; `users` role `app_owner`, status `active` |
| In Future Technologies owner `Xj7QfQ…` | providers `[password]`; email verified; not disabled; `users` role `company_admin`, status `active`, companyId `co_Xj7QfQ…` |
| `dsbc-production` document counts | users 2, companies 2, tenants 2, employees 1, cards 1, slugs 1, publishingRecords 1 — **unchanged** |
| Deployed functions | 45 in `asia-south1`; `resolveSession`, `registerIndividual`, `registerCompany` **not deployed** |
| Live hosting | build-info commit `28fb0c7` (Directive 32) — Phase 1 UI **not deployed** |
| Moolchand's public card | `resolvePublicEntity` → `OK` |

Neither production identity has a Google provider yet. That is expected: linking requires the
Phase 1 deploy plus an interactive sign-in by each person.

---

## 7. What a deploy would change in production

| Target | Change | Risk |
|---|---|---|
| **Functions** | 3 new callables: `resolveSession`, `registerIndividual`, `registerCompany` (purely additive — nothing calls them until the new UI is live). 1 behaviour change: `getMyAccountState` returns `no_account` instead of `pending_approval` for a signed-in identity with **no** `users/{uid}` document. Both production users have a profile, so their status is unaffected. `loadCaller` gains `Caller.signInProvider` (additive, read from the already-verified token). | Low |
| **Firestore rules** | Browser-side `create` on `users` and `tenants` becomes impossible; `companies` create is App-Owner-only. Registration moves entirely to the backend. No read path and no update/delete path changes. | Low. **This is the only change that can lock someone out, and only out of self-registration — which Phase 1 replaces in the same deploy.** Rules and the new UI must go out together. |
| **Hosting** | New sign-in screen with four Google entry points; the old `CustomerRegistrationModal` is gone; `AuthModal` is sign-in only; Link Google banner for signed-in password users; mobile marketing menu gains a labelled Sign In. Existing password sign-in stays reachable via "Existing account? Sign in with email". | Low–medium: it is the visible change. Rolls back as one hosting release. |
| **Auth config** | **No change.** See §3. | None |
| **Data** | **No migration, no backfill, no writes.** Existing `users`, `companies`, `tenants` documents are untouched by the deploy itself. | None |

---

## 8. Deploy order and rollback

Every command below is the form used by this repo's own production runbook,
`docs/directive-27/RUNBOOK.md` (its §1 gates, and its firestore, functions and hosting deploy
steps). Do not improvise shorter forms — see the warning after the steps.

**Scope:** this is the *incremental* subset of that runbook. The runbook is written for
Directive 27's first-time production bring-up, and its other steps — granting the App Owner
claim, `bootstrapProduction.ts`, storage rules, the customer migration — are **already done** and
must **not** be re-run for Phase 1. Phase 1 touches functions, Firestore rules and hosting, and
nothing else.

### Pre-deploy gates (all three must pass first)

From a clean tree at the certified commit:

```bash
git status                                            # see the note below before acting on this
npx vite build                                        # production mode; produces dist/ for hosting
npx tsx scripts/directive27/preflight.ts              # must report 0 FAIL and 0 BLOCKED
node scripts/directive27/secretsAudit.mjs --bundle dist
```

**On `git status`:** "clean" means *no uncommitted tracked changes*. Four **untracked** paths are
expected and listed in §1 — `.firebase/`, `.vscode/`, `docs/directive-27/evidence/bootstrap/` and
`tests/unit/accountService.test.ts`. **Do not run `git clean -fd` to make the output look clean:**
`docs/directive-27/evidence/bootstrap/` holds the only copies of two real production bootstrap
evidence reports, and deleting them is irreversible. Confirm `git status --porcelain` shows no
`M`/`A`/`D` lines; `??` lines matching §1's list are fine.

`npx vite build` is a prerequisite, not a formality: `firebase.production.json` serves hosting
from `dist/`, so the hosting step publishes whatever that build produced. The build itself was
already verified green for this tree (§5); re-run it at deploy time so `dist/` is current.

### Order (each step verified before the next)

1. **Functions**
   ```bash
   npx firebase deploy --config firebase.production.json --project production --only functions
   ```
   Additive. Verify: `resolveSession`, `registerIndividual`, `registerCompany` appear in
   `asia-south1`; the existing 45 callables still answer.
   *Not strictly invisible:* from this moment `getMyAccountState` returns `no_account` instead of
   `pending_approval` for a signed-in identity with **no** `users/{uid}` document. Both production
   accounts have profiles, so neither is affected; the change is only visible to a profile-less
   signed-in identity, of which production has none. Impact negligible, but it is a live
   behaviour change and should not be described as none.
2. **Firestore rules and indexes**
   ```bash
   npx firebase deploy --config firebase.production.json --project production --only firestore
   ```
   This is the step that closes browser-side registration. `firestore.indexes.json` is unchanged
   by Phase 1 (verified: not in the `28fb0c7..eff8dc5` diff), so this is effectively a
   rules-only change; `--only firestore` is the runbook's proven form and covers both.
   Verify: in the console, the rules of database **`dsbc-production`** match `firestore.rules`;
   existing users can still read their own `users/{uid}`; Moolchand's public card still resolves.
3. **Hosting**
   ```bash
   npx firebase deploy --config firebase.production.json --project production --only hosting
   ```
   Verify: build-info shows the new commit; the sign-in screen loads; `/pricing` loads and
   `/no-such-page` answers 404 (the rewrites live in `firebase.production.json`); then §9.

### Why `--config firebase.production.json --project production` is mandatory

Not a style preference. The base `firebase.json` is the **emulator** configuration:

- it has **no `hosting` block at all**, so `--only hosting` against it would have nothing to
  deploy;
- its `firestore` entry has **no `database` key**, so rules would be written to the `(default)`
  database — **not `dsbc-production`**. Because step 2 is the step that closes browser-side
  registration, using the base config would report success while production rules stayed
  untouched. That is the single most dangerous way to get this deploy wrong;
- `firebase.production.json` is the file that carries `database: dsbc-production`, the `dsbc-web`
  hosting target, the URL rewrites and the security headers.

`--project production` is the `.firebaserc` alias for `task360-ift`. The **default** alias in
`.firebaserc` is `demo-dsbc`, the emulator project, so omitting `--project` does not target
production.

**And why `npx`.** `firebase-tools` is a **root devDependency** (`^15.32.1`); bare `firebase` is
**not on `PATH`** in this environment (verified: `command -v firebase` finds nothing, while
`node_modules/.bin/firebase.exe` exists). Every command here is therefore prefixed with `npx`, in
line with the repo's convention elsewhere (`npx vite build`, `npx tsx`). If you have
firebase-tools installed globally you may drop the `npx`, but do not assume it — and note that
`npx` run **outside** this checkout would silently fetch an unpinned firebase-tools from the
registry rather than the version this repo was verified against.

### Why this order, and the window it leaves

Functions first is unambiguous: additive, and nothing calls the new callables until the new UI is
live. Rules before hosting is the security-conservative choice — it never leaves a window in which
browser-side account creation is still permitted. The cost, stated plainly:

Between step 2 and step 3 the **old** live UI is still being served, and its registration path
will fail against the new rules. Two consequences:

- A brand-new visitor attempting self-registration in that window gets a failure. Production has
  2 accounts and no self-registration traffic, and closing that path is the point of the phase.
- **The failure is not clean.** The old flow creates the Firebase **Auth** user *before* writing
  the Firestore profile batch, so a registration that fails on the batch leaves an **orphaned
  password Auth user with no `users/{uid}` document**. That identity cannot repair itself after
  step 3 either: Phase 1 registration requires a Google sign-in (`D34-AUTH-031`), so a
  password-only orphan has no self-service route. It needs the App Owner to delete the Auth user.
  Check for one after the deploy if any registration attempt is suspected during the window.

The window is the length of one hosting deploy. **That duration is an estimate, not a
measurement** — treat "a minute or two" as unverified and keep step 3 queued and ready before
starting step 2.

The alternative — hosting before rules — leaves no breakage window at all (the new UI registers
through the callables from step 1, and the old permissive rules simply go unused), at the cost of
a few extra minutes in which browser-side account creation is still possible. If the founder
prefers availability over that window, swapping steps 2 and 3 is safe **provided step 1
succeeded**. Either way, rules and hosting must land in the same sitting; do not stop between them.

### Rollback

| Step | Rollback | Cost |
|---|---|---|
| Hosting | `npx firebase hosting:rollback --project production`, or console → Hosting → release history, selecting the release whose build-info commit is `28fb0c7`. | Seconds, no rebuild |
| Rules | **Primary: the Firebase console.** Firestore → Rules → ruleset history for database `dsbc-production` → select the ruleset in force before the Phase 1 deploy → publish. No CLI, no checkout, no build. **Fallback (CLI):** see below — needs `npm ci` in a worktree first, so it is minutes, not seconds. Restores browser-side registration, so do it only together with a hosting rollback. | Console: seconds. CLI fallback: minutes |
| Functions | Nothing to undo: the three callables are additive and unreferenced once hosting is rolled back. To revert `getMyAccountState`'s `no_account` response, redeploy `functions` **from the main checkout** at the previous commit (see below) — not from a throwaway worktree. Production functions are in **`asia-south1`** (§6). | Minutes |

**Take the console route for rules if you can.** It is the only genuinely-seconds option, and in an
incident it avoids every dependency problem below.

```bash
# Rules rollback — CLI fallback. Leaves the working tree's firestore.rules untouched.
git worktree add ../dsbc-rules-rollback 28fb0c7   # firebase.production.json is present at this commit
cd ../dsbc-rules-rollback
npm ci                                            # REQUIRED: a fresh worktree has no node_modules,
                                                  # so `npx firebase` would otherwise fetch an
                                                  # unpinned firebase-tools from the registry
npx firebase deploy --config firebase.production.json --project production --only firestore
cd - && git worktree remove ../dsbc-rules-rollback
```

Why this is safe despite the functions `predeploy` hook: `firebase.production.json` declares
`predeploy: npm --prefix functions run build` on its **functions** target only, and
`--only firestore` does not run another target's predeploy. So the rules rollback never invokes
`functions/build.mjs`.

```bash
# Functions rollback — from the MAIN checkout, which already has node_modules
git stash                                         # if the working tree has changes worth keeping
git checkout 28fb0c7
npx firebase deploy --config firebase.production.json --project production --only functions
git checkout security-foundation/directive-27     # and `git stash pop` if you stashed
```

**Do not run the functions rollback from a throwaway worktree.** Its `predeploy` runs
`npm --prefix functions run build` → `node functions/build.mjs`, which imports **esbuild**.
`esbuild` is a **root** devDependency (`^0.25.0`) and is absent from `functions/package.json`, so
in a worktree with no installed `node_modules` the predeploy fails and nothing deploys.

**Precondition — stated, not assumed.** This rollback is only correct if the **live** ruleset
currently matches `firestore.rules` as of `28fb0c7`. What is verified and what is not:

- **Verified (git):** `firestore.rules` is byte-identical at `28fb0c7` (the live hosting commit)
  and at `63aefc1^` = `7cd3163` (the Phase 1 base). The four commits between them change no rules
  file. So either revision is the same rollback source, and rolling back to `28fb0c7` restores
  exactly the pre-Phase-1 rules.
- **Not verified:** that the live ruleset in `dsbc-production` actually matches that file. Nobody
  has read live rules at this commit; §6's read-only preflight did not capture them.
- **Do not use the one snapshot in the repo for this.**
  `docs/directive-27/evidence/live-snapshot/live-firestore.rules` is the **pre-Directive-27**
  capture (2026-10-02) and differs substantially from `28fb0c7` (25,854 vs 32,640 bytes, ~1,191
  diff lines). The runbook's "redeploy the snapshot rules" undo was written for D27's own
  rollback, not this one.

**Therefore:** before step 2, capture the current live ruleset read-only and confirm it matches
`28fb0c7:firestore.rules`. If it does not, establish the true rollback source first — rolling back
to a revision that was never live would itself be a change.

No data rollback exists or is needed: the deploy writes no data.

---

## 9. Production Google verification — required before Phase 1 is production-ready

Run **only** after the founder approves the deploy, and only after step 3 above.

**Step 0 — observe what the real Google IdP does, *before* any linking.** This is the only
scenario with no automated coverage anywhere: the emulator mints synthetic Google tokens, so
Firebase's real same-email behaviour has never been exercised. It writes no data. Record verbatim
what Firebase returns.

> **⚠️ Step 0 is safe for one of the two people and harmful for the other. Read this first.**
>
> Signing in with Google **creates a Firebase Auth user** for that Google identity if none exists
> — this is measured, not assumed: `D34-E2E-4` resolves a UID for an unknown Google identity that
> has no `users/{uid}` document. So:
>
> - **If the person's Google address is the same as their DSBC account email** — expected for the
>   App Owner — `allowDuplicateEmails: false` prevents a second account for that address. Firebase
>   either auto-links Google onto the existing UID (its documented behaviour when the existing
>   email is verified, and both production emails are) or refuses with
>   `auth/account-exists-with-different-credential`. Both outcomes are safe and both are worth
>   recording. **Run step 0 for this person.**
> - **If the person's Google address differs from their DSBC account email** — the likely case for
>   the In Future Technologies owner, whose password account is on their company domain — there is
>   no email collision, so Firebase creates a **new, separate** Auth user holding that Google
>   credential. `Link Google` on their real account then fails permanently with
>   `auth/credential-already-in-use` (pinned at `tests/backend/d34-session.test.ts:163`), and the
>   App Owner must delete that orphaned Auth user before linking can succeed. **Skip step 0 for
>   this person and go straight to step 2.**
>
> Note also that **`Improved email privacy` is on** for this project (§6). One documented effect is
> that Firebase stops surfacing `auth/account-exists-with-different-credential`. If so, the
> account-exists copy may be unreachable in production by configuration, and step 0 would show a
> silent auto-link instead. Either result is fine — record which one happens, because that is the
> fact this step exists to establish.

1. **App Owner**: sign in with the existing password → click **Link Google** → sign out → sign in with Google → lands in the **App Owner** workspace.
2. **In Future Technologies owner**: the same, with the Google account that person controls → lands in the **company** workspace. **Link first; do not sign in with Google beforehand** (see the step 0 warning). If they have already signed in with that Google account at any point, check for and delete the orphaned Auth user before linking.
3. Read-only `accounts:lookup` for both UIDs shows **`password` + `google.com` on the SAME UIDs** (`qwDfeo…` and `Xj7QfQ…` — no new UID).
4. `users/{uid}` role / companyId / status unchanged for both; `companies/co_Xj7Q…` unchanged; **no new** `users` / `companies` / `tenants` documents — compare the counts in §6 before and after (expected: users 2, companies 2, tenants 2).
5. Moolchand's public card still resolves (`resolvePublicEntity` → `OK`).

Email/password stays enabled throughout. **"Create Free Card" and "Register as Company" are not
to be exercised with real accounts** unless the founder intends to create those accounts — doing
so writes real `users`/`tenants`/`companies` documents and would change the counts in step 4.

Phase 1 is production-ready only when step 0 is recorded and all five checks pass.

---

## 10. Remaining risks

1. **The rules/hosting coupling.** Closing browser registration and shipping the new sign-in screen are one logical change split across two deploy targets, so there is no ordering that is free of trade-offs — §8 states the window each order leaves. The real risk is *stopping* between them: if the hosting deploy fails after the rules deploy, self-registration is closed with no replacement UI. Mitigation: deploy rules and hosting in one sitting, and before starting, have the rules rollback **already open** — the Firebase console's ruleset history for `dsbc-production`, which is the only seconds-fast route. The CLI fallback in §8 needs a worktree and an `npm ci` first, so it is minutes, not a one-liner; do not plan an incident around it.
2. **Real Google IdP same-email behaviour is unobserved, and §9's steps 1–5 do not observe it.** The emulator mints synthetic Google ID tokens, so Firebase's real response to "this Google address already belongs to a DSBC password account" has never been exercised. Steps 1–2 deliberately **link first, then** sign in with Google — an order that can never produce `auth/account-exists-with-different-credential`. So passing all five checks would leave this still unobserved. That is why **§9 now has a step 0** that signs in with Google *before* linking and records what Firebase actually returns. Two caveats, both in §9: step 0 is safe only where the Google address matches the DSBC account email (otherwise it creates an orphaned Auth user and blocks linking), and because `Improved email privacy` is on, the account-exists error may be unreachable in production by configuration — in which case the mapped copy for it is dead code in practice, which step 0 will reveal. (Carried forward from Task 7, now corrected.)
3. **The redirect fallback has no automated test.** Popup-blocked browsers fall back to `signInWithRedirect`; the emulator cannot drive a real redirect, so that path is covered by unit tests over mocked `firebase/auth` plus the error copy, not by a browser test. (Carried forward from Task 6.)
4. **`npm run test:backend` can silently drop a test file.** An intermittent vitest forks-pool fault made the first run of this certification skip `platform-health.test.ts` while still printing "190/190 passed" (it exited 1, correctly). It did not reproduce in three later runs, and the suite is 194/194 exit 0. The operating rule — accept a backend run only at `10 passed (10)` / `194 passed (194)` / exit 0 — and the full investigation are in §11. A test-runner defect, not a product defect.
5. **A triage list of minor findings is open.** Tasks 1–8 recorded **15** `minor (deferred)` ledger entries (each listing one or more findings), ranging from cosmetic (a stale file header, missing test ids) through to small UX gaps (the Link Google banner shows for every non-Google signed-in user including the App Owner and is not dismissible; a profile-less owner-claim holder could sit on an "Opening your workspace…" spinner; an orphaned owned company without a `users` doc can produce a re-register loop; the marketing hero still shows a sample card). They are listed in full, per task, in `.superpowers/sdd/2026-10-04-d34-phase1-google-sign-in/progress.md`. None blocks Phase 1; the scheduled whole-branch review triages them.
6. **Signing in with Google creates a Firebase Auth user before any registration — so the order in §9 matters.** This is measured, not assumed: `D34-E2E-4` resolves a UID for an unknown Google identity that has no `users/{uid}` document. Consequences: (a) a person whose Google address differs from their DSBC account email who signs in with Google **before** linking creates a separate Auth user holding that credential, after which `Link Google` on their real account fails permanently with `auth/credential-already-in-use` (`tests/backend/d34-session.test.ts:163`) until the App Owner deletes the orphan; (b) before the review fix in §2, that person's only on-screen options were "Create Free Card" and "Register as Company", either of which would have created a **second fully active DSBC account** — a duplicate workspace with its own company and tenant documents — for someone who already had one. The fix gives them a route back to their real account; it does **not** retroactively unblock anyone who has already signed in with that Google address, which still needs the orphan deleted. The backend cannot fix this, and should not: matching identities by email is exactly what Phase 1 forbids. §9's step 0 guard and step 2 note exist for this reason.
7. **The deployable delta versus live is Phase 1 alone — and that is what makes the rollback source valid.** The live hosting commit `28fb0c7` is an **ancestor** of this report's commit (verified with `git merge-base --is-ancestor`), so everything up to it is already in production and the branch's distance from `main` is not a measure of deploy risk. Measured against live: `28fb0c7..eff8dc5` is **19 commits** — 4 pre-plan commits, the plan commit, the 13 Phase 1 commits, and this report. Of the files they touch, **24 are on the deployable surface** (`firestore.rules`, `functions/src/**`, `src/**`, `shared/**`), and every one of those 24 is a D34 Phase 1 file. The 4 pre-plan commits touch only documentation plus one dev-only script (`scripts/directive31-smoke.mjs`, never deployed) — no rules, no `functions/src`, no `src`, no `shared`, no `firebase*.json`. **So deploying from this branch ships Phase 1 and nothing else**, and §9's verification covers the delta rather than a fraction of it. The same measurement is what makes the §8 rules rollback sound: because those 4 commits change no rules file, `firestore.rules` is byte-identical at `28fb0c7` and at the Phase 1 base `63aefc1^`, so rolling back to `28fb0c7` restores exactly the pre-Phase-1 rules. The residual risk is not the delta's size but the unverified live-rules provenance recorded in §8.

---

## 11. Known defect: `npm run test:backend` can silently drop a test file

This is a test-runner defect. It is **not** a product defect, and no Phase 1 code is implicated.
It is recorded here because it changes how a backend run must be read before a deploy.

### What happened

The backend suite was first run for this certification on 2026-10-04 at 22:18 against this same
tree (log: `.superpowers/sdd/2026-10-04-d34-phase1-google-sign-in/logs/backend.log`). It reported:

```
[vitest-pool]: Timeout terminating forks worker for test files .../tests/backend/email-verification.test.ts.
[vitest-pool]: Failed to terminate forks worker ... Error: [vitest-pool-runner]: Timeout waiting for worker to respond
Unhandled Error: [vitest-pool]: Timeout starting forks runner.
 Test Files  9 passed (9)
      Tests  190 passed (190)
     Errors  1 error
   Duration  40440.26s
! Script exited unsuccessfully (code 1)
```

40440 s is 11.2 hours: the run finished its tests, then sat on worker teardown overnight and only
exited the next morning.

### The finding that matters

**That run was incomplete, not merely untidy at exit.** This part is measured:
`tests/backend/` contains **ten** `*.test.ts` files, that run reported **nine**, and a clean run
of the same suite reports **194** tests against that run's **190**. One file did not run.

**Which** file is a strong inference, not a measurement. The old log contains only vitest's final
summary — the per-file reporter lines were overwritten in place by the progress renderer and never
reached the file — so it does not name what ran. The attribution to
`tests/backend/platform-health.test.ts` rests on two independent facts:

- it is the **only** file in `tests/backend/` with exactly **4** tests (counted in all ten files),
  and 194 − 190 = 4;
- it is last in the run order: vitest's default sequencer orders slowest-first from its cache
  (`node_modules/.vite/vitest/…/results.json`), and at ~0.7 s it is the fastest file, with
  `email-verification` second-fastest and so ninth.

Both point the same way, and the arithmetic admits no other single file, so the attribution is
sound — but it is reconstruction after the fact, not something the log states. The ordering claim
in particular is read from the sequencer's documented behaviour plus the cached durations, not
observed in that run.

On that reading, `Timeout starting forks runner` is the *last file's runner never starting*,
because the pool could not reclaim the worker that had just finished `email-verification.test.ts`.

**The exit code 1 was correct and load-bearing.** "190/190 passed" alongside it was not a green
suite with a cosmetic teardown wart; it was a run that quietly skipped a test file. Accepting it
as a pass would have certified Phase 1 on an unrun file.

### Reproduction attempts (all at the identical tree `46421e2`, 2026-10-05)

| # | Command | Result |
|---|---|---|
| 1 | `node scripts/directive25/runBackendTests.mjs tests/backend/email-verification.test.ts` | 1 file, 11 tests, 9.13 s, **exit 0** — no hang |
| 2 | `node scripts/directive25/runBackendTests.mjs tests/backend/email-verification.test.ts tests/backend/platform-health.test.ts` | 2 files, **15** tests (11+4), 7.40 s, **exit 0** — no hang |
| 3 | `npm run test:backend` (full suite) | **10 files, 194 tests, 144.14 s, exit 0** — no hang |

**The fault did not reproduce in three attempts, including a full-suite run.** It is intermittent.

### The handle, and how far the evidence goes

The file the pool named does leak a client Firebase app, and it is the only backend test that does:

- `tests/backend/email-verification.test.ts` line 18 statically imports `auth, db` from
  `src/lib/firebase`. That module calls `initializeApp` + `getAuth` + `initializeFirestore` +
  `getStorage` + `getFunctions` and connects all four to the emulators.
- Its `ownerOnlyRead()` helper then performs a real Firestore read
  (`getDocs(query(collection(db, 'securityAuditLogs'), limit(1)))`), which opens the Firestore
  client's transport — not just the object.
- The file never calls `terminate(db)` or `deleteApp(app)`. There is no `afterAll`.
- By contrast the harness's own client-SDK helper, `browserSession()` in
  `tests/backend/support/backendEnv.ts`, closes every client app it creates:
  `await terminate(db); await deleteApp(app);`.
- The only other backend test that loads `src/lib/firebase`
  (`authority-client-webhooks-publishing.test.ts`, dynamically in `beforeAll`) never touches
  `fb.db`, so it never opens a Firestore transport.

An un-terminated Firestore client holds live handles in the forks worker, and a worker that will
not go quiet is precisely what `Timeout waiting for worker to respond` reports. That asymmetry
explains why the pool named this file and no other.

**What is not established:** because the fault would not reproduce, it cannot be shown that this
leak *causes* the hang rather than being a standing condition that a vitest-internal timing fault
occasionally trips over — nor that adding the teardown would prevent a recurrence.

### Judgment: documented, not changed

No fix was implemented, deliberately:

- Nothing is failing. The suite is 194/194 across all 10 files and exits 0.
- A `vitest.backend.config.ts` change (`pool`, `teardownTimeout`, …) would be a blind config
  change against an unreproduced fault, aimed at silencing an exit code that turned out to be
  telling the truth.
- Adding an `afterAll` teardown to the one leaking file is the candidate minimal fix and is
  defensible hygiene, but it is not objectively required by any failing run and cannot be shown
  to fix anything. Working test infrastructure was left alone.

### Operational rule this imposes (the actionable part)

> **A backend run counts as green only if it reports `Test Files 10 passed (10)` *and*
> `Tests 194 passed (194)` *and* exits 0.** A run reporting 9 files is an incomplete run no matter
> how many assertions passed inside it, and must be re-run.

Two follow-ups are recommended for a deliberate test-hygiene change (not done here, to avoid
churning test infrastructure during a certification):

1. Give `tests/backend/email-verification.test.ts` an `afterAll` that signs out and `terminate()`s
   the client Firestore app, matching what `browserSession()` already does.
2. Have `scripts/directive25/runBackendTests.mjs` assert the expected test-file count, so an
   incomplete run can never read as green again.

---

## 12. Deliberately not done

- **No deploy.** No `firebase deploy` of functions, rules or hosting was run.
- **No production data change.** No writes to any live project; §6 is read-only and was performed by the controller, not by the implementer.
- **No Auth configuration change.** Email/password stays enabled (disabling it is Phase 3).
- **No Phase 2 work.** Invitations, `adminOnboardCompany` and `confirmOfflinePayment` are not started.
- **No Google linking for the two production identities.** That is an interactive step for the two people concerned, after the deploy (§9).
- **The deferred minor findings were not fixed** (risk 5) — they belong to the whole-branch review.
- **No test-infrastructure changes beyond what §11 records.**
