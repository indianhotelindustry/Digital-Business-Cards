// Shared real-UI customer journey steps (Directive 26 Phase 10, reused by
// Directive 27 Phase 6). Every step drives the production build exactly as a
// customer would: registration, Company Profile, Employees & Cards, publishing.
import { dirname } from 'node:path';
import { expect, type Browser, type Page } from '@playwright/test';

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

/**
 * Registers a company. Directive 30: a new account waits for App Owner
 * approval; `activate` performs it (verified email + approveCustomer) and the
 * customer then presses "Check again", as a real customer would.
 */
export async function registerCompany(page: Page, c: Customer, password = PASSWORD, activate?: () => Promise<void>) {
  await page.goto('/');
  await page.locator('button:visible', { hasText: 'Create Company Profile' }).first().click();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Create Company Profile & Start Onboarding' }) });
  await form.getByPlaceholder('e.g. Acme Innovations').fill(c.company);
  await form.getByPlaceholder('name@example.com').fill(c.email);
  await form.getByPlaceholder('••••••••').fill(password);
  await form.getByRole('button', { name: 'Create Company Profile & Start Onboarding' }).click();
  await page.getByRole('button', { name: 'Close onboarding' }).click();
  await page.goto('/app');
  if (activate) {
    await expect(page.getByRole('heading', { name: 'Awaiting approval' })).toBeVisible();
    await activate();
    await page.getByRole('button', { name: 'Check again' }).click();
    // "Check again" opens the workspace but does not re-fetch the entitlement
    // snapshot refused while pending; a fresh load (as on next sign-in) does.
    await expect(page.getByRole('button', { name: 'Profile & Branding' })).toBeVisible();
    await page.reload();
  }
  await expect(page.getByRole('button', { name: 'Profile & Branding' })).toBeVisible();
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Sign In with Credentials' }) });
  await form.getByPlaceholder('name@example.com').fill(email);
  await form.getByPlaceholder('••••••••').fill(password);
  await form.getByRole('button', { name: 'Sign In with Credentials' }).click();
  await expect(form).toHaveCount(0); // signed in, modal closed
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
  if (opts.customSlug !== undefined) await page.getByTestId('custom-slug-input').fill(opts.customSlug);
}

export async function addAndPublishEmployee(page: Page, c: Customer) {
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(page.getByText(/0 \/ 3 employees used/)).toBeVisible(); // server entitlement snapshot loaded
  await chooseCardDesign(page, c.employee.template || 'classic');
  await fillEmployeeDetails(page, c.employee, { photo: true, customSlug: c.employee.slug });
  await page.getByTestId('employee-submit').click();
  // Step 6: the publishing panel opens on its own, seeded with the requested address.
  const panel = page.getByTestId('publishing-panel-card');
  await expect(panel.getByTestId('publishing-slug')).toHaveValue(c.employee.slug);
  await expect(page.getByText(fullName(c)).first()).toBeVisible();
  await panel.getByTestId('publish-button').click();
  await expect(panel.getByTestId('public-url')).toHaveText(new RegExp(`^https?://[^#]+/card/${c.employee.slug}$`));
  await page.getByRole('button', { name: 'Close publishing' }).click();
}
