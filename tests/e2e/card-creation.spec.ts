// Directive 31 — production card creation journey, in real Chrome against the
// production-mode bundle wired to the Firebase Emulator Suite.
//
//   Step 1 choose one of the three real templates (Continue disabled until chosen)
//   Step 2 details + photo upload + optional custom card address
//   Create → publishing panel opens with that address → Publish → QR / public URL
//   A clean, never-signed-in browser opens the public card.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { addAndPublishEmployee, chooseCardDesign, fillEmployeeDetails, fullName, newBrowser, registerCompany, shot, type Customer } from './support/journey';
import { adminAuth, adminDb, createUser, ok, resetEmulators, type TestUser } from '../backend/support/backendEnv';

test.describe.configure({ mode: 'serial' });

const C: Customer = {
  key: 'D31',
  company: 'Kesar Interiors',
  email: 'admin@kesar-interiors.test',
  websiteSlug: 'kesar-interiors',
  tagline: 'Homes that feel like you',
  about: 'Kesar Interiors designs homes and offices.',
  service: 'Space Planning',
  product: 'Design Package',
  employee: { first: 'Asha', last: 'Verma', title: 'Lead Designer', email: 'asha@kesar-interiors.test', slug: 'asha-verma', template: 'modern' },
};
const SECOND = { first: 'Ravi', last: 'Nair', title: 'Site Engineer', email: 'ravi@kesar-interiors.test', slug: 'ravi-nair' };

let page: Page;
let owner: TestUser;

const companyId = async () => (await adminDb.collection('users').where('email', '==', C.email).get()).docs[0].get('companyId') as string;
const employeeByEmail = async (email: string) => (await adminDb.collection('employees').where('email', '==', email).get()).docs[0];

async function clean<T>(browser: Browser, path: string, fn: (p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext();
  try {
    const p = await ctx.newPage();
    await p.goto(path);
    return await fn(p);
  } finally {
    await ctx.close();
  }
}

test.beforeAll(async ({ browser }) => {
  await resetEmulators();
  owner = await createUser('u_owner', { claims: { platformRole: 'app_owner' } });
  await adminDb.doc('users/u_owner').set({ id: 'u_owner', email: owner.email, displayName: 'Platform Owner', role: 'app_owner', companyId: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await ok('bootstrapControlPlane', { reason: 'D31 bootstrap' }, owner);
  page = (await newBrowser(browser)).page;
});

test('D31-SETUP: customer registers and is activated through the App Owner approval', async () => {
  await registerCompany(page, C, undefined, async () => {
    // Directive 30 gate: verified email + App Owner approval (the real callable).
    const user = (await adminDb.collection('users').where('email', '==', C.email).get()).docs[0];
    await adminAuth.updateUser(user.id, { emailVerified: true });
    await ok('approveCustomer', { customerType: 'company', customerId: await companyId(), reason: 'D31 onboarding' }, owner);
  });
  await expect(page.getByRole('button', { name: 'Employees & Cards' })).toBeVisible();
});

test('D31-TEMPLATE: all three real templates are shown and one must be chosen before details', async () => {
  await page.getByRole('button', { name: 'Employees & Cards' }).click();
  await expect(page.getByText(/0 \/ 3 employees used/)).toBeVisible();
  await page.getByRole('button', { name: 'Add Employee' }).first().click();
  const step = page.getByTestId('template-step');
  for (const t of ['classic', 'modern', 'minimal']) {
    const option = page.getByTestId(`template-option-${t}`);
    await expect(option).toHaveAttribute('aria-checked', 'false'); // no silent default
    await expect(option.getByText('Your Name').first()).toBeVisible(); // a real rendered card, not a label
  }
  await expect(page.getByTestId('template-continue')).toBeDisabled();
  await expect(page.locator('label:has-text("First Name")')).toHaveCount(0); // details are not reachable yet
  await shot(page, 'd31-template-step');
  await step.getByRole('button', { name: 'Cancel' }).click();
  // Previews never create records.
  expect((await adminDb.collection('employees').get()).size).toBe(0);
  expect((await adminDb.collection('cards').get()).size).toBe(0);
});

test('D31-CREATE: design + details + photo + custom address → created, published, QR', async () => {
  await addAndPublishEmployee(page, C);
  await shot(page, 'd31-created-published');
  const emp = await employeeByEmail(C.employee.email);
  const cid = await companyId();
  const card = await adminDb.doc(`cards/${emp.get('cardId')}`).get();
  expect(card.get('templateId')).toBe('modern');
  expect(card.get('publicSlug')).toBe('asha-verma');
  const slug = await adminDb.doc('slugs/asha-verma').get();
  expect(slug.get('entityId')).toBe(card.id);
  expect(slug.get('tenantId')).toBe(cid);
  expect((await adminDb.doc(`publishingRecords/${card.id}`).get()).get('publishingState')).toBe('PUBLISHED');
  // The photo went through uploadAsset into the tenant's employee folder.
  expect(decodeURIComponent(emp.get('profilePhotoUrl'))).toContain(`companies/${cid}/employees/${emp.id}/`);
});

test('D31-PUBLIC: a clean, never-signed-in browser sees the real card with its photo', async ({ browser }) => {
  await clean(browser, `/card/${C.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(C)).first()).toBeVisible();
    await expect(p.getByText(C.employee.title).first()).toBeVisible();
    await expect(p.getByText('Card Not Found')).toHaveCount(0);
    const img = p.locator(`img[src*="employees"]`).first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await shot(p, 'd31-public-card');
  });
});

test('D31-SLUG: a taken, reserved or malformed custom address is refused and never replaced silently', async () => {
  await chooseCardDesign(page, 'classic');
  for (const [slug, msg] of [['asha-verma', /already claimed/i], ['admin', /reserved|not allowed|system/i], ['a', /at least|too short|characters/i]] as const) {
    await fillEmployeeDetails(page, SECOND, { customSlug: slug });
    await page.getByTestId('employee-submit').click();
    await expect(page.getByTestId('custom-slug-error')).toHaveText(msg);
  }
  expect((await adminDb.collection('employees').where('email', '==', SECOND.email).get()).size).toBe(0);
  // A free address is kept exactly as requested.
  await fillEmployeeDetails(page, SECOND, { customSlug: 'Ravi Nair' });
  await page.getByTestId('employee-submit').click();
  await expect(page.getByTestId('publishing-panel-card').getByTestId('publishing-slug')).toHaveValue(SECOND.slug);
  await page.getByRole('button', { name: 'Close publishing' }).click();
  const ravi = await employeeByEmail(SECOND.email);
  const card = await adminDb.doc(`cards/${ravi.get('cardId')}`).get();
  expect(card.get('publicSlug')).toBe(SECOND.slug);
  expect(card.get('templateId')).toBe('classic');
});

test('D31-EDIT: editing an employee keeps the card design unless it is changed', async () => {
  const emp = await employeeByEmail(C.employee.email);
  const row = page.locator('tr', { hasText: fullName(C) });
  await row.getByTitle('Edit Profile').click();
  await expect(page.getByTestId('selected-template')).toHaveText('modern');
  await page.locator('label:has-text("Job Designation") + input').fill('Principal Designer');
  await page.getByTestId('employee-submit').click();
  await expect(page.getByText('Principal Designer').first()).toBeVisible();
  expect((await adminDb.doc(`cards/${emp.get('cardId')}`).get()).get('templateId')).toBe('modern');
});

test('D31-INACTIVE: a deactivated employee is unavailable publicly and the panel says why; activation restores it', async ({ browser }) => {
  const row = page.locator('tr', { hasText: fullName(C) });
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await expect(row.getByRole('button', { name: 'Activate' })).toBeVisible();
  await row.getByTestId(/publish-card-/).click();
  await expect(page.getByTestId('publishing-inactive-warning')).toBeVisible();
  await page.getByRole('button', { name: 'Close publishing' }).click();
  await clean(browser, `/card/${C.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(C))).toHaveCount(0);
  });
  await row.getByRole('button', { name: 'Activate' }).click();
  await expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  await clean(browser, `/card/${C.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(C)).first()).toBeVisible();
  });
});

test('D31-UNPUBLISH: unpublish hides the card, republish restores the same address', async ({ browser }) => {
  const row = page.locator('tr', { hasText: fullName(C) });
  await row.getByTestId(/publish-card-/).click();
  const panel = page.getByTestId('publishing-panel-card');
  await panel.getByTestId('unpublish-button').click();
  await expect(panel.getByTestId('publishing-state')).toHaveText(/Unpublished/);
  await clean(browser, `/card/${C.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(C))).toHaveCount(0);
  });
  await panel.getByTestId('publish-button').click();
  await expect(panel.getByTestId('public-url')).toHaveText(new RegExp(`/card/${C.employee.slug}$`));
  await page.getByRole('button', { name: 'Close publishing' }).click();
  await clean(browser, `/card/${C.employee.slug}`, async (p) => {
    await expect(p.getByText(fullName(C)).first()).toBeVisible();
  });
});
