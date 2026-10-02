// ============================================================================
// Directive 26 Phase 10 — production-like browser test
// ============================================================================
// Real Chrome, the PRODUCTION build of the app (no demo personas), the real
// Cloud Functions + rules on the Firebase Emulator Suite. Separate browser
// contexts = separate browsers (no shared storage / session):
//   Browser A  company admin of customer A (registers through the UI)
//   Browser B  anonymous visitor
//   Browser C  second customer
//   Browser D  App Owner (Demo Readiness)
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { adminDb, createUser, idToken, ok, PASSWORD as OWNER_PASSWORD, resetEmulators } from '../backend/support/backendEnv';

test.describe.configure({ mode: 'serial' });

const SHOTS = 'docs/directive-26/evidence/browser';
const PASSWORD = 'Pilot-Demo-2026!';
// A real (decodable) 1x1 PNG, so the test proves the logo renders from storage.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

interface Customer {
  key: string;
  company: string;
  email: string;
  websiteSlug: string;
  tagline: string;
  about: string;
  service: string;
  product: string;
  employee: { first: string; last: string; title: string; email: string; slug: string };
}

const A: Customer = {
  key: 'A',
  company: 'Northwind Advisory',
  email: 'admin@northwind-advisory.test',
  websiteSlug: 'northwind-advisory',
  tagline: 'Practical advice for growing firms',
  about: 'Northwind Advisory helps growing firms plan finance and operations.',
  service: 'Growth Planning Workshop',
  product: 'Quarterly Finance Review',
  employee: { first: 'Asha', last: 'Verma', title: 'Senior Consultant', email: 'asha@northwind-advisory.test', slug: 'asha-verma' },
};

const C: Customer = {
  key: 'C',
  company: 'Bluefin Logistics',
  email: 'admin@bluefin-logistics.test',
  websiteSlug: 'bluefin-logistics',
  tagline: 'On-time freight across India',
  about: 'Bluefin Logistics moves freight for manufacturers across India.',
  service: 'Full Truckload Freight',
  product: 'Shipment Tracking Portal',
  employee: { first: 'Ravi', last: 'Menon', title: 'Operations Lead', email: 'ravi@bluefin-logistics.test', slug: 'ravi-menon' },
};

let ctxA: BrowserContext;
let ctxB: BrowserContext;
let ctxC: BrowserContext;
let pageA: Page;
let pageB: Page;
let pageC: Page;

async function newBrowser(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

async function registerCompany(page: Page, c: Customer) {
  await page.goto('/');
  await page.locator('button:visible', { hasText: 'Create Company Profile' }).first().click();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Create Company Profile & Start Onboarding' }) });
  await form.getByPlaceholder('e.g. Acme Innovations').fill(c.company);
  await form.getByPlaceholder('name@example.com').fill(c.email);
  await form.getByPlaceholder('••••••••').fill(PASSWORD);
  await form.getByRole('button', { name: 'Create Company Profile & Start Onboarding' }).click();
  await page.getByRole('button', { name: 'Close onboarding' }).click();
  await page.goto('/#app');
  await expect(page.getByRole('button', { name: 'Profile & Branding' })).toBeVisible();
}

async function buildWebsite(page: Page, c: Customer) {
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
  await expect(panel.getByTestId('public-url')).toContainText(`#company/${c.websiteSlug}`);
  await expect(panel.getByTestId('publishing-state')).toHaveText('Published');
}

async function addAndPublishEmployee(page: Page, c: Customer) {
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(page.getByText(/0 \/ 3 employees used/)).toBeVisible(); // server entitlement snapshot loaded
  await page.getByRole('button', { name: 'Add Employee' }).first().click();
  await page.locator('label:has-text("First Name") + input').fill(c.employee.first);
  await page.locator('label:has-text("Last Name") + input').fill(c.employee.last);
  await page.locator('label:has-text("Job Designation") + input').fill(c.employee.title);
  await page.locator('label:text-is("Email *") + input').fill(c.employee.email);
  await page.getByRole('button', { name: 'Create & Generate Card' }).click();
  await expect(page.getByText(`${c.employee.first} ${c.employee.last}`).first()).toBeVisible();
  await page.locator('[data-testid^="publish-card-"]').first().click();
  const panel = page.getByTestId('publishing-panel-card');
  await panel.getByTestId('publishing-slug').fill(c.employee.slug);
  await panel.getByTestId('publish-button').click();
  await expect(panel.getByTestId('public-url')).toContainText(`#card/${c.employee.slug}`);
  await page.getByRole('button', { name: 'Close publishing' }).click();
}

test.beforeAll(async ({ browser }) => {
  await resetEmulators();
  const owner = await createUser('u_owner', { claims: { platformRole: 'app_owner' } });
  await adminDb.doc('users/u_owner').set({ id: 'u_owner', email: owner.email, displayName: 'Platform Owner', role: 'app_owner', companyId: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await ok('bootstrapControlPlane', { reason: 'Browser test bootstrap' }, owner);
  ({ ctx: ctxA, page: pageA } = await newBrowser(browser));
  ({ ctx: ctxB, page: pageB } = await newBrowser(browser));
  ({ ctx: ctxC, page: pageC } = await newBrowser(browser));
});

test.afterAll(async () => {
  await Promise.all([ctxA, ctxB, ctxC].filter(Boolean).map((c) => c.close()));
});

test('Browser A: company registers, builds and publishes its website', async () => {
  await registerCompany(pageA, A);
  await buildWebsite(pageA, A);
  await shot(pageA, '01-browserA-website-published');
});

test('Browser B: the real company website appears for an anonymous visitor', async () => {
  await pageB.goto(`/#company/${A.websiteSlug}`);
  await expect(pageB.getByRole('heading', { name: A.company }).first()).toBeVisible();
  await expect(pageB.getByText(A.tagline).first()).toBeVisible();
  await expect(pageB.getByText(A.service).first()).toBeVisible();
  await expect(pageB.getByText(A.product).first()).toBeVisible();
  const logo = pageB.locator('img[src*="127.0.0.1:9479"]').first(); // uploaded logo, served by the Storage emulator
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(pageB.getByText(/Acme|Nexus Global/)).toHaveCount(0); // no demo content
  await shot(pageB, '02-browserB-real-company-website');
});

test('Browser A: adds an employee and publishes the card', async () => {
  await addAndPublishEmployee(pageA, A);
  await shot(pageA, '03-browserA-employee-card-published');
});

test('Browser B: the real employee card appears; website → card → website loop works', async () => {
  const name = `${A.employee.first} ${A.employee.last}`;
  await pageB.goto(`/#card/${A.employee.slug}`);
  await expect(pageB.getByText(name).first()).toBeVisible();
  await expect(pageB.getByText(A.employee.title).first()).toBeVisible();
  await expect(pageB.getByText(/Innovating today|Building What|People. Ideas. Progress/)).toHaveCount(0); // no sample copy
  await shot(pageB, '04-browserB-real-employee-card');

  await pageB.goto(`/#company/${A.websiteSlug}`);
  await pageB.getByRole('link', { name: `Open digital business card for ${name}` }).click();
  await expect(pageB).toHaveURL(new RegExp(`#card/${A.employee.slug}`));
  await expect(pageB.getByText(name).first()).toBeVisible();
  await pageB.getByRole('button', { name: `Visit ${A.company} company profile` }).first().click();
  await expect(pageB).toHaveURL(new RegExp(`#company/${A.websiteSlug}`));
  await expect(pageB.getByRole('heading', { name: A.company }).first()).toBeVisible();
});

test('Browser B: enquiry from the website reaches customer A', async () => {
  await pageB.goto(`/#company/${A.websiteSlug}`);
  await pageB.getByPlaceholder('Jane Doe').fill('Meera Shah');
  await pageB.getByPlaceholder('jane@company.com').fill('meera@example.org');
  await pageB.locator('textarea').last().fill('Please share workshop dates.');
  await pageB.getByRole('button', { name: 'Submit Official Enquiry' }).click();
  await expect(pageB.getByText('Enquiry Received!')).toBeVisible();
  const leads = await adminDb.collection('leads').where('name', '==', 'Meera Shah').get();
  const companyA = (await adminDb.collection('users').where('email', '==', A.email).get()).docs[0].get('companyId');
  expect(leads.docs.map((d) => d.get('companyId'))).toEqual([companyA]);
});

test('Browser C: a second customer builds its own site and never sees customer A data', async () => {
  await registerCompany(pageC, C);
  await buildWebsite(pageC, C);
  await addAndPublishEmployee(pageC, C);
  await pageC.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(pageC.getByText(`${C.employee.first} ${C.employee.last}`).first()).toBeVisible();
  await expect(pageC.getByText(`${A.employee.first} ${A.employee.last}`)).toHaveCount(0);
  await shot(pageC, '05-browserC-own-employees-only');

  await pageB.goto(`/#company/${C.websiteSlug}`);
  await expect(pageB.getByRole('heading', { name: C.company }).first()).toBeVisible();
  await expect(pageB.getByText(A.company)).toHaveCount(0);
});

test('unpublished, preview and unknown URLs never show content or demo data', async () => {
  // Customer A unpublishes the card; anonymous and other-customer previews get nothing.
  await pageA.getByRole('button', { name: 'Employees & Cards' }).click();
  await pageA.locator('[data-testid^="publish-card-"]').first().click();
  await pageA.getByTestId('publishing-panel-card').getByTestId('unpublish-button').click();
  await expect(pageA.getByTestId('publishing-panel-card').getByTestId('publishing-state')).toHaveText('Unpublished');
  await pageA.getByRole('button', { name: 'Close publishing' }).click();

  for (const page of [pageB, pageC]) {
    await page.goto(`/#card/${A.employee.slug}?preview=true`);
    await expect(page.getByText('Card Currently in Draft')).toBeVisible();
    await expect(page.getByText(`${A.employee.first} ${A.employee.last}`)).toHaveCount(0);
  }
  // The owning customer can still preview its own draft.
  await pageA.goto(`/#card/${A.employee.slug}?preview=true`);
  await expect(pageA.getByText(`${A.employee.first} ${A.employee.last}`).first()).toBeVisible();

  for (const slug of ['acme-innovations', 'nexus-global', 'acme-real', 'no-such-company']) {
    await pageB.goto(`/#company/${slug}`);
    await expect(pageB.getByText('Company Profile Not Found')).toBeVisible();
    await expect(pageB.getByText(/Acme Innovations|Nexus Global/)).toHaveCount(0);
  }
  await pageB.goto('/#card/rahul-sharma');
  await expect(pageB.getByText('Card Not Found')).toBeVisible();
  await shot(pageB, '06-browserB-no-demo-fallback');

  // Republish for the readiness check.
  await pageA.goto('/#app');
  await pageA.getByRole('button', { name: 'Employees & Cards' }).click();
  await pageA.locator('[data-testid^="publish-card-"]').first().click();
  await pageA.getByTestId('publishing-panel-card').getByTestId('publish-button').click();
  await expect(pageA.getByTestId('publishing-panel-card').getByTestId('publishing-state')).toHaveText('Published');
  await pageA.getByRole('button', { name: 'Close publishing' }).click();
});

test('Browser D: App Owner sees both pilots demo ready', async ({ browser }) => {
  const owner = { uid: 'u_owner', email: 'u_owner@dsbc.test', token: await idToken('u_owner@dsbc.test') };
  for (const c of [A, C]) {
    const companyId = (await adminDb.collection('users').where('email', '==', c.email).get()).docs[0].get('companyId');
    await ok('adminSetCustomerClassification', { customerType: 'company', customerId: companyId, isPilot: true, stage: 'LIVE_WEBSITE', reason: 'Pilot customer' }, owner);
  }
  const { ctx, page } = await newBrowser(browser);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Sign In with Credentials' }) });
  await form.getByPlaceholder('name@example.com').fill(owner.email);
  await form.getByPlaceholder('••••••••').fill(OWNER_PASSWORD);
  await form.getByRole('button', { name: 'Sign In with Credentials' }).click();
  await expect(form).toHaveCount(0); // signed in, modal closed
  const closeWizard = page.getByRole('button', { name: 'Close onboarding' });
  if (await closeWizard.isVisible().catch(() => false)) await closeWizard.click();
  await page.goto('/#app');
  await shot(page, '07a-browserD-app-owner-dashboard');
  await page.locator('button:visible', { hasText: 'Demo Readiness' }).first().click();
  const panel = page.getByTestId('demo-readiness');
  await expect(panel.getByText('2 of 2 customer(s) demo ready', { exact: false })).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId('demo-ready-badge')).toHaveText(['Demo ready', 'Demo ready']);
  await shot(page, '07-browserD-app-owner-demo-readiness');
  await ctx.close();
});
