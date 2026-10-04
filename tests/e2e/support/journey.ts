// Shared real-UI customer journey steps (Directive 26 Phase 10, reused by
// Directive 27 Phase 6). Every step drives the production build exactly as a
// customer would: registration, Company Profile, Employees & Cards, publishing.
// Directive 34: registration and login go through Google (the Auth emulator's
// Google provider, popup path); email/password is login-only for old accounts.
import { dirname } from 'node:path';
import { expect, type Browser, type Page } from '@playwright/test';
import { adminAuth, adminDb } from '../../backend/support/backendEnv';
import { buildRegistrationDocuments } from '../../../shared/domain/registrationModel';

/** Screenshots go next to the JSON report (DSBC_BROWSER_OUT), so each directive keeps its own evidence. */
export const SHOTS = process.env.DSBC_BROWSER_OUT ? dirname(process.env.DSBC_BROWSER_OUT) : 'docs/directive-26/evidence/browser';
export const PASSWORD = 'Pilot-Demo-2026!';
/** A real (decodable) 1x1 PNG, so tests prove the logo renders from storage. */
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export interface Customer {
  key: string;
  company: string;
  email: string;
  websiteSlug: string;
  tagline: string;
  about: string;
  service: string;
  product: string;
  employee: { first: string; last: string; title: string; email: string; slug: string; template?: 'classic' | 'modern' | 'minimal' };
}

export const fullName = (c: Customer) => `${c.employee.first} ${c.employee.last}`;

export async function newBrowser(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

export const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

/** A Google identity in the Auth emulator: the same email always selects the same Google account. */
export interface GoogleIdentity {
  email: string;
  name: string;
}
export type GoogleIntent = 'company_login' | 'individual_login' | 'register_company' | 'create_free_card';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Completes the Auth emulator's Google sign-in widget (firebase-tools 15.32.1,
 * GET /emulator/auth/handler?providerId=google.com&authType=signInViaPopup).
 * Pinned from the rendered widget (Task 8 step 1):
 *   #title                    "Sign-in with Google.com"
 *   li.js-reuse-account       an identity already in the emulator; its email in #reuse-email
 *   button "Add new account"  opens the form: #email-input, #display-name-input,
 *                             submit #sign-in ("Sign in with Google.com")
 * An identity already in the emulator is picked from the list (same Google
 * subject, so the same Firebase user); a new one is added. Waits for the popup to close.
 */
export async function completeGooglePopup(popup: Page, identity: GoogleIdentity) {
  await popup.waitForLoadState('load'); // the widget wires its click handlers at the end of the page
  await expect(popup.locator('#title')).toHaveText('Sign-in with Google.com');
  // Decide reuse vs. new only once the account list and its "Add new account" action are rendered,
  // so an existing identity is never missed (which would create a second Google identity for the email).
  await expect(popup.locator('li.js-new-account')).toBeVisible();
  const closed = popup.waitForEvent('close');
  const existing = popup
    .locator('li.js-reuse-account')
    .filter({ has: popup.locator('#reuse-email', { hasText: new RegExp(`^\\s*${escapeRe(identity.email)}\\s*$`) }) });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.locator('#email-input').fill(identity.email);
    await popup.locator('#display-name-input').fill(identity.name);
    await popup.locator('#sign-in').click();
  }
  await closed;
}

/** Directive 34: clicks the sign-in screen's Google button for `intent` and completes the emulator popup (popup path, no redirect). */
export async function googleSignIn(page: Page, intent: GoogleIntent, identity: GoogleIdentity) {
  await expect(page.getByTestId('sign-in-screen')).toBeVisible();
  const popup = page.waitForEvent('popup');
  await page.getByTestId(`google-${intent}`).click();
  await completeGooglePopup(await popup, identity);
}

/** Marketing page "Sign In" -> Google; ends in the identity's workspace (resolveSession). */
export async function googleLogin(page: Page, identity: GoogleIdentity, intent: 'company_login' | 'individual_login' = 'company_login') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await googleSignIn(page, intent, identity);
  await expect(page.getByTestId('sign-in-screen')).toHaveCount(0);
}

/**
 * Registers a company the Directive 34 way: "Create Company Profile" ->
 * Google (register_company) -> company form (Free plan) -> backend
 * registerCompany. A free company is ACTIVE immediately (no approval step).
 */
export async function registerCompany(page: Page, c: Pick<Customer, 'company' | 'email'>) {
  await page.goto('/');
  await page.locator('button:visible', { hasText: 'Create Company Profile' }).first().click();
  await googleSignIn(page, 'register_company', { email: c.email, name: c.company });
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Create company workspace' }) });
  await form.getByLabel('Company name').fill(c.company);
  await expect(form.getByLabel('Your name')).toHaveValue(c.company); // prefilled from the Google profile
  await form.getByRole('button', { name: 'Create company workspace' }).click();
  await expect(page.getByTestId('sign-in-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Profile & Branding' })).toBeVisible();
}

/**
 * A password account from before Google sign-in (Directive 34 migration
 * fixture). Browsers can no longer create accounts, so the Auth user and its
 * ACTIVE free company are written with the Admin SDK in the shape the backend
 * registration writes. Returns the uid.
 */
export async function seedPasswordCompany(c: { email: string; company: string; displayName?: string }, opts: { password?: string; verified?: boolean } = {}) {
  const displayName = c.displayName ?? c.company;
  const user = await adminAuth.createUser({ email: c.email, password: opts.password ?? PASSWORD, emailVerified: opts.verified ?? true, displayName });
  const docs = buildRegistrationDocuments({ uid: user.uid, email: c.email, displayName, accountType: 'company', companyName: c.company, status: 'active' });
  const batch = adminDb.batch();
  batch.set(adminDb.collection('companies').doc(docs.company!.id), docs.company!);
  batch.set(adminDb.collection('tenants').doc(docs.tenant.id), { ...docs.tenant, commercial: { state: 'free', method: 'free' } });
  batch.set(adminDb.collection('users').doc(user.uid), docs.user);
  await batch.commit();
  return user.uid;
}

/** Legacy email/password sign-in, for password fixtures only: sign-in screen -> "Existing account? Sign in with email". */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await page.getByRole('button', { name: 'Existing account? Sign in with email' }).click();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Sign In with Credentials' }) });
  await form.getByPlaceholder('name@example.com').fill(email);
  await form.getByPlaceholder('••••••••').fill(password);
  await form.getByRole('button', { name: 'Sign In with Credentials' }).click();
  await expect(form).toHaveCount(0); // signed in, modal closed
  await expect(page.getByTestId('sign-in-screen')).toHaveCount(0);
  const closeWizard = page.getByRole('button', { name: 'Close onboarding' });
  if (await closeWizard.isVisible().catch(() => false)) await closeWizard.click();
  await page.goto('/app');
}

export async function buildWebsite(page: Page, c: Customer) {
  await page.getByRole('button', { name: 'Profile & Branding' }).click();
  await page.locator('label:has-text("Company Tagline") + input').fill(c.tagline);
  await page.getByTestId('logo-upload').setInputFiles({ name: `logo-${c.key}.png`, mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Upload logo')).toBeVisible(); // upload finished
  await page.getByRole('button', { name: 'Overview & Story' }).click();
  await page.locator('textarea[placeholder^="Detailed corporate background"]').fill(c.about);
  await page.getByRole('button', { name: /^Services \(\d+\)$/ }).click();
  await page.getByRole('button', { name: 'Add Service' }).click();
  await page.locator('label:has-text("Service Title") + input').first().fill(c.service);
  await page.getByRole('button', { name: /^Products \(\d+\)$/ }).click();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.locator('label:has-text("Product Name") + input').first().fill(c.product);
  await page.getByRole('button', { name: 'Save Company Profile' }).click();
  await expect(page.getByText('Company profile saved')).toBeVisible();

  const panel = page.getByTestId('publishing-panel-company');
  await panel.getByTestId('publishing-slug').fill(c.websiteSlug);
  await panel.getByTestId('publish-button').click();
  // Directive 27: the published URL is the canonical path, not a hash route.
  await expect(panel.getByTestId('public-url')).toHaveText(new RegExp(`^https?://[^#]+/company/${c.websiteSlug}$`));
  await expect(panel.getByTestId('publishing-state')).toHaveText('Published');
}

/** Opens Add Employee and completes Step 1 (design). Continue stays disabled until a design is chosen. */
export async function chooseCardDesign(page: Page, template: 'classic' | 'modern' | 'minimal') {
  await page.getByRole('button', { name: 'Add Employee' }).first().click();
  await expect(page.getByTestId('template-step')).toBeVisible();
  for (const t of ['classic', 'modern', 'minimal']) await expect(page.getByTestId(`template-option-${t}`)).toBeVisible();
  await expect(page.getByTestId('template-continue')).toBeDisabled();
  await page.getByTestId(`template-option-${template}`).click();
  await expect(page.getByTestId(`template-option-${template}`)).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('template-continue').click();
  await expect(page.getByTestId('selected-template')).toHaveText(template);
}

/** Step 2: details, photo upload and the optional custom card address. */
export async function fillEmployeeDetails(page: Page, e: Customer['employee'], opts: { photo?: boolean; customSlug?: string } = {}) {
  await page.locator('label:has-text("First Name") + input').fill(e.first);
  await page.locator('label:has-text("Last Name") + input').fill(e.last);
  await page.locator('label:has-text("Job Designation") + input').fill(e.title);
  await page.locator('label:text-is("Email *") + input').fill(e.email);
  if (opts.photo) {
    await page.getByTestId('photo-file-input').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('photo-preview')).toBeVisible();
  }
  // Directive 32: the Card Link ID sits under the name and is checked inline.
  if (opts.customSlug !== undefined) await page.getByTestId('card-link-id-input').fill(opts.customSlug);
}

export async function addAndPublishEmployee(page: Page, c: Customer) {
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(page.getByText(/0 \/ 3 employees used/)).toBeVisible(); // server entitlement snapshot loaded
  await chooseCardDesign(page, c.employee.template || 'classic');
  await fillEmployeeDetails(page, c.employee, { photo: true, customSlug: c.employee.slug });
  await expect(page.getByTestId('card-link-id-status')).toHaveAttribute('data-state', 'available');
  await page.getByTestId('employee-submit').click();
  // Step 6: the publishing panel opens on its own, seeded with the requested address.
  const panel = page.getByTestId('publishing-panel-card');
  await expect(panel.getByTestId('publishing-slug')).toHaveValue(c.employee.slug);
  await expect(page.getByText(fullName(c)).first()).toBeVisible();
  await panel.getByTestId('publish-button').click();
  await expect(panel.getByTestId('public-url')).toHaveText(new RegExp(`^https?://[^#]+/card/${c.employee.slug}$`));
  await page.getByRole('button', { name: 'Close publishing' }).click();
}
