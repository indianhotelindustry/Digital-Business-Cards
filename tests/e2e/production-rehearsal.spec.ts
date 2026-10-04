// Directive 27 Phase 6 — production-like three-customer rehearsal (the
// directive's first-class acceptance criterion), in real Chrome against the
// production-mode bundle wired to the Firebase Emulator Suite.
//
//   Customer R1, R2, R3 — each in its OWN browser: registers, creates the
//     company, adds an employee, publishes the employee card and the company
//     website (all through the real UI).
//   Clean browsers — a brand-new context (no cookies, no storage, never signed
//     in) for every public URL check, as a visitor on another device would be.
//   App Owner — sees all three customers correctly.
//
// Public URLs are the canonical paths /card/{slug}, /profile/{slug},
// /company/{slug} resolved by the server-authoritative resolver.
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { addAndPublishEmployee, buildWebsite, fullName, googleLogin, newBrowser, registerCompany, shot, signIn, type Customer } from './support/journey';
import { adminDb, createUser, idToken, ok, PASSWORD as OWNER_PASSWORD, resetEmulators, type TestUser } from '../backend/support/backendEnv';

test.describe.configure({ mode: 'serial' });

const data = JSON.parse(readFileSync(new URL('./rehearsal-customers.json', import.meta.url), 'utf8')) as { customers: Customer[] };
const CUSTOMERS = data.customers;
const [R1, R2, R3] = CUSTOMERS;
const others = (c: Customer) => CUSTOMERS.filter((o) => o !== c);
/** Text from the legacy in-app demo dataset that must never appear. */
const DEMO_TEXT = /Acme Innovations|Nexus Global|Rahul Sharma|Priya Patel|Innovating today|Building What|People\. Ideas\. Progress/;

const sessions: Record<string, { ctx: BrowserContext; page: Page }> = {};
let owner: TestUser;

/** A clean visitor: fresh context, no storage, never signed in. */
async function clean<T>(browser: Browser, path: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(path);
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

const companyIdOf = async (c: Customer) => (await adminDb.collection('users').where('email', '==', c.email).get()).docs[0].get('companyId') as string;

test.beforeAll(async () => {
  await resetEmulators();
  owner = await createUser('u_owner', { claims: { platformRole: 'app_owner' } });
  await adminDb.doc('users/u_owner').set({ id: 'u_owner', email: owner.email, displayName: 'Platform Owner', role: 'app_owner', companyId: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await ok('bootstrapControlPlane', { reason: 'D27 rehearsal bootstrap' }, owner);
});

test.afterAll(async () => {
  await Promise.all(Object.values(sessions).map((s) => s.ctx.close()));
});

for (const c of CUSTOMERS) {
  test(`REH-${c.key}: customer registers, creates the company, adds an employee, publishes card and website`, async ({ browser }) => {
    sessions[c.key] = await newBrowser(browser);
    const { page } = sessions[c.key];
    // Directive 34: Google registration; a free company is active immediately (no approval step).
    await registerCompany(page, c);
    await buildWebsite(page, c);
    await addAndPublishEmployee(page, c);
    // Quota is measured by the server: one of three free seats used.
    await page.getByRole('button', { name: 'Employees & Cards' }).click();
    await expect(page.getByText(/1 \/ 3 employees used/)).toBeVisible();
    // Only this customer's employees exist in its dashboard.
    for (const o of others(c)) await expect(page.getByText(fullName(o))).toHaveCount(0);
    await shot(page, `d27-${c.key}-dashboard`);
  });
}

test('REH-SERVER: each employee and card belongs to exactly its own company', async () => {
  for (const c of CUSTOMERS) {
    const companyId = await companyIdOf(c);
    const employees = await adminDb.collection('employees').where('companyId', '==', companyId).get();
    expect(employees.docs.map((d) => d.get('displayName') || `${d.get('firstName')} ${d.get('lastName')}`)).toEqual([fullName(c)]);
    const cards = await adminDb.collection('cards').where('companyId', '==', companyId).get();
    expect(cards.size).toBe(1);
    const records = await adminDb.collection('publishingRecords').where('tenantId', '==', companyId).get();
    expect(records.docs.map((d) => d.get('publishingState')).sort()).toEqual(['PUBLISHED', 'PUBLISHED']);
  }
  // The slugs are distinct and owned by their own tenants.
  const slugs = await adminDb.collection('slugs').get();
  expect(slugs.size).toBeGreaterThanOrEqual(6);
});

test('REH-PUBLIC: every website, card and profile renders in a clean browser with only its own data', async ({ browser }) => {
  for (const c of CUSTOMERS) {
    await clean(browser, `/company/${c.websiteSlug}`, async (page) => {
      await expect(page.getByRole('heading', { name: c.company }).first()).toBeVisible();
      await expect(page.getByText(c.tagline).first()).toBeVisible();
      await expect(page.getByText(c.service).first()).toBeVisible();
      await expect(page.getByText(fullName(c)).first()).toBeVisible(); // the website lists its employee
      for (const o of others(c)) {
        await expect(page.getByText(o.company)).toHaveCount(0);
        await expect(page.getByText(fullName(o))).toHaveCount(0);
      }
      await expect(page.getByText(DEMO_TEXT)).toHaveCount(0);
      await shot(page, `d27-clean-company-${c.key}`);
    });
    await clean(browser, `/card/${c.employee.slug}`, async (page) => {
      await expect(page.getByText(fullName(c)).first()).toBeVisible();
      await expect(page.getByText(c.employee.title).first()).toBeVisible();
      for (const o of others(c)) await expect(page.getByText(o.company)).toHaveCount(0);
      await expect(page.getByText(DEMO_TEXT)).toHaveCount(0);
    });
    await clean(browser, `/profile/${c.employee.slug}`, async (page) => {
      await expect(page.getByText(fullName(c)).first()).toBeVisible();
      await expect(page.getByText(DEMO_TEXT)).toHaveCount(0);
    });
  }
});

test('REH-NAV: website → employee card → website navigation uses canonical paths', async ({ browser }) => {
  await clean(browser, `/company/${R2.websiteSlug}`, async (page) => {
    await page.getByRole('link', { name: `Open digital business card for ${fullName(R2)}` }).click();
    await expect(page).toHaveURL(new RegExp(`/card/${R2.employee.slug}$`));
    await expect(page.getByText(fullName(R2)).first()).toBeVisible();
    await page.getByRole('button', { name: `Visit ${R2.company} company profile` }).first().click();
    await expect(page).toHaveURL(new RegExp(`/company/${R2.websiteSlug}$`));
    await expect(page.getByRole('heading', { name: R2.company }).first()).toBeVisible();
    // Browser history works across the in-app navigation.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/card/${R2.employee.slug}$`));
    await expect(page.getByText(fullName(R2)).first()).toBeVisible();
  });
  // A direct load of a deep link (no in-app navigation first) works too.
  await clean(browser, `/card/${R3.employee.slug}`, async (page) => {
    await page.getByRole('button', { name: `Visit ${R3.company} company profile` }).first().click();
    await expect(page).toHaveURL(new RegExp(`/company/${R3.websiteSlug}$`));
  });
});

test('REH-PERSIST: customer data survives a reload and a brand-new browser', async ({ browser }) => {
  const { page } = sessions[R1.key];
  await page.reload();
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(page.getByText(fullName(R1)).first()).toBeVisible();

  const fresh = await newBrowser(browser);
  try {
    // Directive 34: R1 registered with Google, so it signs back in with Google (same identity, same workspace).
    await googleLogin(fresh.page, { email: R1.email, name: R1.company });
    await fresh.page.getByRole('button', { name: 'Employees & Cards' }).click();
    await expect(fresh.page.getByText(fullName(R1)).first()).toBeVisible();
    await expect(fresh.page.getByText(/1 \/ 3 employees used/)).toBeVisible();
    for (const o of others(R1)) await expect(fresh.page.getByText(fullName(o))).toHaveCount(0);
    await fresh.page.getByRole('button', { name: 'Profile & Branding' }).click();
    await expect(fresh.page.locator('label:has-text("Company Tagline") + input')).toHaveValue(R1.tagline);
    await expect(fresh.page.getByTestId('publishing-panel-company').getByTestId('publishing-state')).toHaveText('Published');
    await shot(fresh.page, 'd27-R1-new-browser-session');
  } finally {
    await fresh.ctx.close();
  }
});

test('REH-UNPUBLISH: unpublished content disappears from clean browsers; ?preview=true is no bypass', async ({ browser }) => {
  const { page } = sessions[R2.key];
  await page.goto('/app');
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await page.locator('[data-testid^="publish-card-"]').first().click();
  await page.getByTestId('publishing-panel-card').getByTestId('unpublish-button').click();
  await expect(page.getByTestId('publishing-panel-card').getByTestId('publishing-state')).toHaveText('Unpublished');
  await page.getByRole('button', { name: 'Close publishing' }).click();

  for (const path of [`/card/${R2.employee.slug}`, `/card/${R2.employee.slug}?preview=true`, `/profile/${R2.employee.slug}?preview=true`]) {
    await clean(browser, path, async (p) => {
      await expect(p.getByText(/Card Currently in Draft|Card Not Found|Profile Not Found|Profile .*Draft/).first()).toBeVisible();
      await expect(p.getByText(fullName(R2))).toHaveCount(0);
    });
  }
  // Another customer's signed-in session cannot preview it either.
  const other = sessions[R3.key].page;
  await other.goto(`/card/${R2.employee.slug}?preview=true`);
  await expect(other.getByText('Card Currently in Draft')).toBeVisible();
  await expect(other.getByText(fullName(R2))).toHaveCount(0);
  // The website no longer lists the unpublished card's employee.
  await clean(browser, `/company/${R2.websiteSlug}`, async (p) => {
    await expect(p.getByRole('heading', { name: R2.company }).first()).toBeVisible();
    await expect(p.getByText(fullName(R2))).toHaveCount(0);
  });

  // Republish: back for everyone.
  await page.goto('/app');
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await page.locator('[data-testid^="publish-card-"]').first().click();
  await page.getByTestId('publishing-panel-card').getByTestId('publish-button').click();
  await expect(page.getByTestId('publishing-panel-card').getByTestId('publishing-state')).toHaveText('Published');
  await page.getByRole('button', { name: 'Close publishing' }).click();
  await clean(browser, `/card/${R2.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(R2)).first()).toBeVisible();
  });
});

test('REH-404: unknown slugs and paths show not-found pages, never demo content', async ({ browser }) => {
  for (const slug of ['acme-innovations', 'nexus-global', 'no-such-company']) {
    await clean(browser, `/company/${slug}`, async (p) => {
      await expect(p.getByText('Company Profile Not Found')).toBeVisible();
      await expect(p.getByText(DEMO_TEXT)).toHaveCount(0);
    });
  }
  await clean(browser, '/card/rahul-sharma', async (p) => {
    await expect(p.getByText('Card Not Found')).toBeVisible();
  });
  for (const path of ['/admin', '/cards/leela-kapoor', '/card/leela-kapoor/edit', '/company']) {
    await clean(browser, path, async (p) => {
      if (path === '/company') {
        // "/company" alone is the marketing section about company plans, not an entity.
        await expect(p.getByTestId('not-found-page')).toHaveCount(0);
        return;
      }
      await expect(p.getByTestId('not-found-page')).toBeVisible();
      await expect(p.getByText(DEMO_TEXT)).toHaveCount(0);
    });
  }
  await clean(browser, '/card/..%2F..%2Fadmin', async (p) => {
    await expect(p.getByTestId('not-found-page')).toBeVisible();
  });
});

test('REH-LEGACY: old hash links still open and are rewritten to the canonical path', async ({ browser }) => {
  await clean(browser, `/#/card/${R1.employee.slug}`, async (p) => {
    await expect(p).toHaveURL(new RegExp(`/card/${R1.employee.slug}$`));
    await expect(p.getByText(fullName(R1)).first()).toBeVisible();
  });
  await clean(browser, `/#company/${R3.websiteSlug}`, async (p) => {
    await expect(p).toHaveURL(new RegExp(`/company/${R3.websiteSlug}$`));
    await expect(p.getByRole('heading', { name: R3.company }).first()).toBeVisible();
  });
});

test('REH-OWNER: the App Owner sees all three customers correctly and measured platform health', async ({ browser }) => {
  const owner = { uid: 'u_owner', email: 'u_owner@dsbc.test', token: await idToken('u_owner@dsbc.test') };
  for (const c of CUSTOMERS) {
    await ok('adminSetCustomerClassification', { customerType: 'company', customerId: await companyIdOf(c), isPilot: true, stage: 'LIVE_WEBSITE', reason: 'D27 rehearsal customer' }, owner);
  }
  const { ctx, page } = await newBrowser(browser);
  try {
    await signIn(page, owner.email, OWNER_PASSWORD);
    await page.locator('button:visible', { hasText: 'Demo Readiness' }).first().click();
    const panel = page.getByTestId('demo-readiness');
    await expect(panel.getByText('3 of 3 customer(s) demo ready', { exact: false })).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByTestId('demo-ready-badge')).toHaveText(['Demo ready', 'Demo ready', 'Demo ready']);
    for (const c of CUSTOMERS) await expect(panel.getByText(c.company).first()).toBeVisible();
    await expect(panel.getByText(DEMO_TEXT)).toHaveCount(0);
    await shot(page, 'd27-owner-demo-readiness');

    await page.locator('button:visible', { hasText: 'Production Launch Gate' }).first().click();
    // The browser certifies nothing: it points at the measured sources instead.
    await expect(page.getByTestId('launch-certification-state')).toHaveText(/NOT CERTIFIED BY THE BROWSER/);
    await expect(page.getByText(/CODE READY|PRODUCTION LAUNCH READY|OPERATIONALLY READY/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Health & Fail-Safe Observability' }).click();
    const health = page.getByTestId('platform-health');
    await expect(health.getByTestId('platform-health-overall')).toBeVisible({ timeout: 60_000 });
    // Measured, not asserted: the emulator rehearsal has no public origin or email provider, so never OK.
    await expect(health.getByTestId('platform-health-overall')).not.toHaveText(/Overall: OK/);
    await expect(health.getByTestId('health-ENVIRONMENT')).toContainText('OK');
    await expect(health.getByTestId('health-ENTITLEMENTS')).toContainText('OK');
    await expect(health.getByTestId('health-PUBLIC_URL')).toContainText('NOT_CONFIGURED');
    await shot(page, 'd27-owner-platform-health');
  } finally {
    await ctx.close();
  }
});
