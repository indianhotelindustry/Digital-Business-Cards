// Directive 34 Phase 1 — Google sign-in journeys in real Chrome against the
// production-mode bundle wired to the Firebase Emulator Suite. Google is the
// Auth emulator's Google provider, driven through its sign-in popup (the popup
// path; the redirect fallback cannot be triggered against the emulator here).
// Every case runs in a fresh browser context (no shared storage or session).
//
//   D34-E2E-1 Create Free Card -> Google -> name -> active individual, no company, no demo data
//   D34-E2E-2 Register as Company -> Google -> company form (Free plan) -> active company workspace
//   D34-E2E-3 the same Google identity registers again -> "already has", still one company
//   D34-E2E-4 an unknown Google identity -> Login as Company -> not authorized
//   D34-E2E-5 the person closes the Google popup -> no error, still on the sign-in screen
//   D34-E2E-6 the sign-in screen at 360x740: no horizontal scroll, Google buttons >= 44px
//   D34-E2E-7 a password account signs in by email, links Google (same UID), then signs in with Google
import { expect, test, type Browser, type Page } from '@playwright/test';
import { completeGooglePopup, googleLogin, googleSignIn, PASSWORD, seedPasswordCompany, shot, signIn } from './support/journey';
import { adminAuth, adminDb, resetEmulators } from '../backend/support/backendEnv';

test.describe.configure({ mode: 'serial' });

/** Founder condition: the new flows never show the legacy demo dataset. */
const DEMO = /Acme|Rahul|Nexus/;

const INDIVIDUAL = { email: 'meera.iyer@d34.test', name: 'Meera Iyer' };
const OWNER = { email: 'kavya@saffron-studio.test', name: 'Kavya Rao' };
const COMPANY = 'Saffron Studio';
const STRANGER = { email: 'stranger@d34.test', name: 'Unknown Person' };
const LEGACY = { email: 'arjun@indigo-traders.test', company: 'Indigo Traders', displayName: 'Arjun Mehta' };

const uidOf = async (email: string) => (await adminAuth.getUserByEmail(email)).uid;
const companiesOwnedBy = async (uid: string) => (await adminDb.collection('companies').where('ownerUid', '==', uid).get()).docs;

async function fresh<T>(browser: Browser, fn: (page: Page) => Promise<T>, viewport?: { width: number; height: number }): Promise<T> {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  try {
    return await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}

/** Marketing page -> the full-screen Google sign-in screen. */
async function openSignIn(page: Page, cta: 'Sign In' | 'Create My Free Card' | 'Create Company Profile') {
  await page.goto('/');
  await page.locator('button:visible', { hasText: cta }).first().click();
  await expect(page.getByTestId('sign-in-screen')).toBeVisible();
}

test.beforeAll(async () => {
  await resetEmulators();
});

test('D34-E2E-1: Create Free Card with Google makes an active individual account, no company, no demo data', async ({ browser }) => {
  await fresh(browser, async (page) => {
    await openSignIn(page, 'Create My Free Card');
    await googleSignIn(page, 'create_free_card', INDIVIDUAL);
    await expect(page.getByRole('heading', { name: 'Create your free card account' })).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveValue(INDIVIDUAL.name); // from the Google profile
    await page.getByRole('button', { name: 'Create my free card account' }).click();

    const home = page.getByTestId('individual-home');
    await expect(home).toBeVisible();
    await expect(home).toContainText(`Welcome, ${INDIVIDUAL.name}`);
    await expect(page.locator('body')).not.toContainText(DEMO);
    await shot(page, 'd34-e2e-1-individual-home');

    const uid = await uidOf(INDIVIDUAL.email);
    expect((await adminAuth.getUser(uid)).providerData.map((p) => p.providerId)).toEqual(['google.com']);
    const user = await adminDb.doc(`users/${uid}`).get();
    expect(user.get('status')).toBe('active');
    expect(user.get('accountType')).toBe('individual');
    expect(user.get('companyId')).toBeNull();
    expect(await companiesOwnedBy(uid)).toHaveLength(0);
    expect((await adminDb.collection('companies').get()).size).toBe(0);
  });
});

test('D34-E2E-2: Register as Company with Google opens an active company workspace (Free plan)', async ({ browser }) => {
  await fresh(browser, async (page) => {
    await openSignIn(page, 'Create Company Profile');
    await googleSignIn(page, 'register_company', OWNER);
    const form = page.locator('form', { has: page.getByRole('button', { name: 'Create company workspace' }) });
    await expect(form.getByLabel('Your name')).toHaveValue(OWNER.name);
    await expect(form.getByRole('radio', { name: /Free/ })).toBeChecked();
    await expect(form.getByRole('radio', { name: /Paid plans/ })).toBeDisabled();
    await expect(form.getByText('available soon')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(DEMO);
    await shot(page, 'd34-e2e-2-company-form');
    await form.getByLabel('Company name').fill(COMPANY);
    await form.getByRole('button', { name: 'Create company workspace' }).click();

    await expect(page.getByTestId('sign-in-screen')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Employees & Cards' })).toBeVisible();
    await page.getByRole('button', { name: 'Profile & Branding' }).click();
    await expect(page.locator('label:has-text("Company Display Name") + input')).toHaveValue(COMPANY);
    await expect(page.locator('body')).not.toContainText(DEMO);
    await shot(page, 'd34-e2e-2-company-workspace');

    const uid = await uidOf(OWNER.email);
    const owned = await companiesOwnedBy(uid);
    expect(owned).toHaveLength(1);
    expect(owned[0].get('status')).toBe('active');
    expect(owned[0].get('name')).toBe(COMPANY);
    const user = await adminDb.doc(`users/${uid}`).get();
    expect(user.get('role')).toBe('company_admin');
    expect(user.get('status')).toBe('active');
    expect(user.get('companyId')).toBe(owned[0].id);
  });
});

test('D34-E2E-3: the same Google identity registering again is told it already has a workspace; still one company', async ({ browser }) => {
  await fresh(browser, async (page) => {
    await openSignIn(page, 'Create Company Profile');
    await googleSignIn(page, 'register_company', OWNER);
    await expect(page.getByText('This Google account already has a DSBC company workspace.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create company workspace' })).toHaveCount(0);
    await shot(page, 'd34-e2e-3-already-registered');

    const uid = await uidOf(OWNER.email);
    expect(await companiesOwnedBy(uid)).toHaveLength(1);
    expect((await adminDb.collection('companies').get()).size).toBe(1);
    // The existing workspace is one click away.
    await page.getByRole('button', { name: 'Go to my workspace' }).click();
    await expect(page.getByRole('button', { name: 'Employees & Cards' })).toBeVisible();
  });
});

test('D34-E2E-4: an unknown Google identity at Login as Company is not authorized and gets no account', async ({ browser }) => {
  await fresh(browser, async (page) => {
    await openSignIn(page, 'Sign In');
    await googleSignIn(page, 'company_login', STRANGER);
    await expect(page.getByText('This Google account is not authorized as a Company Owner or Admin.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(DEMO);
    await shot(page, 'd34-e2e-4-not-authorized');

    const uid = await uidOf(STRANGER.email);
    expect((await adminDb.doc(`users/${uid}`).get()).exists).toBe(false);
    expect(await companiesOwnedBy(uid)).toHaveLength(0);
    expect((await adminDb.collection('companies').get()).size).toBe(1);
  });
});

test('D34-E2E-5: closing the Google popup shows no error and stays on the sign-in screen', async ({ browser }) => {
  const usersBefore = (await adminAuth.listUsers()).users.length;
  await fresh(browser, async (page) => {
    await openSignIn(page, 'Sign In');
    const popupP = page.waitForEvent('popup');
    await page.getByTestId('google-company_login').click();
    const popup = await popupP;
    await popup.waitForLoadState('load');
    await expect(popup.locator('#title')).toHaveText('Sign-in with Google.com');
    // While Google is open, every entry point is disabled (no second popup).
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card']) {
      await expect(page.getByTestId(`google-${intent}`)).toBeDisabled();
    }
    await popup.close(); // the person dismisses Google

    // The SDK reports auth/popup-closed-by-user a few seconds later; the screen re-enables, silently.
    await expect(page.getByTestId('google-company_login')).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByTestId('sign-in-screen').locator('main')).toHaveAttribute('data-state', 'choose');
    await expect(page.getByRole('alert')).toHaveCount(0);
    for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card']) {
      await expect(page.getByTestId(`google-${intent}`)).toBeEnabled();
    }
    await shot(page, 'd34-e2e-5-popup-cancelled');
  });
  expect((await adminAuth.listUsers()).users.length).toBe(usersBefore);
});

test('D34-E2E-6: the sign-in screen at 360x740 has no horizontal scroll and every Google button is at least 44px tall', async ({ browser }) => {
  await fresh(
    browser,
    async (page) => {
      // Below 640px the header "Sign In" is hidden; the mobile menu carries it (Task 8 fix round 1).
      await page.goto('/');
      await page.getByRole('button', { name: 'Open menu' }).click();
      const mobileSignIn = page.getByRole('button', { name: 'Sign In', exact: true });
      await expect(mobileSignIn).toBeVisible();
      expect((await mobileSignIn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await mobileSignIn.click();
      const screen = page.getByTestId('sign-in-screen');
      await expect(screen).toBeVisible();
      await expect(screen.locator('main')).toHaveAttribute('data-state', 'choose');
      const overflow = await page.evaluate(() => {
        const over = (el: Element | null) => (el ? el.scrollWidth - el.clientWidth : Number.NaN);
        const screenEl = document.querySelector('[data-testid="sign-in-screen"]');
        return {
          doc: over(document.documentElement),
          body: over(document.body),
          screen: over(screenEl),
          main: over(screenEl?.querySelector('main') ?? null),
        };
      });
      expect(overflow.doc).toBeLessThanOrEqual(0);
      expect(overflow.body).toBeLessThanOrEqual(0);
      expect(overflow.screen).toBeLessThanOrEqual(0); // the screen itself does not scroll sideways
      expect(overflow.main).toBeLessThanOrEqual(0);
      for (const intent of ['company_login', 'individual_login', 'register_company', 'create_free_card']) {
        const box = await page.getByTestId(`google-${intent}`).boundingBox();
        expect(box, intent).not.toBeNull();
        expect(box!.height, intent).toBeGreaterThanOrEqual(44);
        expect(box!.x, intent).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, intent).toBeLessThanOrEqual(360);
      }
      await shot(page, 'd34-e2e-6-sign-in-360');
    },
    { width: 360, height: 740 },
  );
});

test('D34-E2E-7: a password account signs in by email, links Google (same UID), then signs in with Google to the same workspace', async ({ browser }) => {
  const uid = await seedPasswordCompany(LEGACY, { password: PASSWORD });
  await fresh(browser, async (page) => {
    await signIn(page, LEGACY.email);
    await expect(page.getByRole('button', { name: 'Employees & Cards' })).toBeVisible();
    const banner = page.getByTestId('link-google-banner');
    await expect(banner).toBeVisible();
    await shot(page, 'd34-e2e-7-link-google-banner');

    const popupP = page.waitForEvent('popup');
    await banner.getByRole('button', { name: 'Link Google' }).click();
    await completeGooglePopup(await popupP, { email: LEGACY.email, name: LEGACY.displayName });
    // D45: success must be stated, never implied by the control disappearing. The
    // first production attempt failed precisely because a silent unmount read as success.
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Google account linked successfully.');
    await expect(banner).toContainText(LEGACY.email);
    await expect(banner).toContainText('You can now sign in with Google using this account.');
    await expect(banner.getByRole('button', { name: 'Link Google' })).toHaveCount(0);
    await shot(page, 'd34-e2e-7-link-google-success');
    await expect.poll(async () => (await adminAuth.getUser(uid)).providerData.map((p) => p.providerId).sort()).toEqual(['google.com', 'password']);

    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('button:visible', { hasText: 'Sign In' }).first()).toBeVisible();

    // Back with Google: the linked Google account is the same Firebase user and workspace.
    await googleLogin(page, { email: LEGACY.email, name: LEGACY.displayName }, 'company_login');
    await expect(page.getByRole('button', { name: 'Employees & Cards' })).toBeVisible();
    await expect(page.getByTestId('link-google-banner')).toHaveCount(0);
    await page.getByRole('button', { name: 'Profile & Branding' }).click();
    await expect(page.locator('label:has-text("Company Display Name") + input')).toHaveValue(LEGACY.company);
    await shot(page, 'd34-e2e-7-google-same-workspace');
  });
  expect(await uidOf(LEGACY.email)).toBe(uid);
  expect((await adminAuth.listUsers()).users.filter((u) => u.email === LEGACY.email)).toHaveLength(1);
  expect(await companiesOwnedBy(uid)).toHaveLength(1);
});
