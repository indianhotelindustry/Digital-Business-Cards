// Directive 29: email verification through the real UI (production-mode
// bundle, Firebase Emulator Suite, real Chrome).
//   EV-1 registration -> unverified banner, resend, early check -> no App Owner UI
//   EV-2 the emailed link verifies; the app picks it up without signing out;
//        still no App Owner UI (verification grants nothing)
//   EV-3 only the server/admin grant (the real scripts/admin/setAppOwner.ts CLI,
//        against the emulator) confers App Owner, after a fresh sign-in
import { spawnSync } from 'node:child_process';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { newBrowser, registerCompany, shot, signIn, type Customer } from './support/journey';
import { adminAuth, PROJECT } from '../backend/support/backendEnv';

test.describe.configure({ mode: 'serial' });

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const OWNER_UI = /Production Launch Gate|Demo Readiness/;
const customer = { key: 'EV', company: 'Verification Pilot Co', email: 'ev-owner@dsbc.test' } as Customer;

async function verificationLinks(email: string): Promise<string[]> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const body = (await res.json()) as { oobCodes?: Array<{ email: string; requestType: string; oobLink: string }> };
  return (body.oobCodes ?? []).filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL').map((c) => c.oobLink);
}

let session: { ctx: BrowserContext; page: Page };
const banner = () => session.page.getByRole('region', { name: 'Email verification' });

test.afterAll(async () => {
  await session?.ctx.close();
});

test('EV-1: a new account is told to verify, can resend, and has no App Owner authority', async ({ browser }) => {
  session = await newBrowser(browser);
  await registerCompany(session.page, customer);

  await expect(banner()).toBeVisible();
  await expect(banner()).toContainText('Verify your email address');
  await expect(banner()).toContainText(customer.email);
  await expect(banner()).toContainText('can never be granted platform administration');
  expect(await verificationLinks(customer.email)).toHaveLength(1);

  await banner().getByRole('button', { name: "I've verified my email" }).click();
  await expect(banner().getByRole('status')).toContainText('Not verified yet');

  await banner().getByRole('button', { name: 'Resend email' }).click();
  await expect(banner().getByRole('status')).toContainText(`A new verification link was sent to ${customer.email}`);
  await expect(banner().getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  expect(await verificationLinks(customer.email)).toHaveLength(2);

  await expect(session.page.locator('button:visible', { hasText: OWNER_UI })).toHaveCount(0);
  await shot(session.page, 'd29-unverified-banner');
});

test('EV-2: the emailed link verifies the account; the app picks it up; still no App Owner authority', async () => {
  const links = await verificationLinks(customer.email);
  const res = await fetch(links[links.length - 1]); // what the mail client does
  expect(res.ok).toBe(true);

  await banner().getByRole('button', { name: "I've verified my email" }).click();
  await expect(banner().getByRole('status')).toHaveText('Email verified. Thank you.');
  await shot(session.page, 'd29-verified');
  await banner().getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner()).toHaveCount(0);

  await session.page.reload();
  await expect(session.page.getByRole('button', { name: 'Profile & Branding' })).toBeVisible();
  await expect(banner()).toHaveCount(0);

  const user = await adminAuth.getUserByEmail(customer.email);
  expect(user.emailVerified).toBe(true);
  expect(user.customClaims?.platformRole).toBeUndefined(); // no automatic grant
  await expect(session.page.locator('button:visible', { hasText: OWNER_UI })).toHaveCount(0);
});

test('EV-3: only the server/admin grant confers App Owner, and only after a fresh sign-in', async ({ browser }) => {
  // The emulator environment (FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST) is inherited.
  const grant = spawnSync('npx', ['tsx', 'scripts/admin/setAppOwner.ts', '--project', PROJECT, '--email', customer.email], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  expect(grant.status, grant.stderr).toBe(0);
  expect(grant.stdout).toMatch(/APP_OWNER_GRANTED: ev-owner@dsbc\.test .*\[emulator\]/);
  expect((await adminAuth.getUserByEmail(customer.email)).customClaims?.platformRole).toBe('app_owner');

  const fresh = await newBrowser(browser);
  try {
    await signIn(fresh.page, customer.email);
    await expect(fresh.page.getByRole('region', { name: 'Email verification' })).toHaveCount(0);
    await expect(fresh.page.locator('button:visible', { hasText: 'Production Launch Gate' }).first()).toBeVisible();
    await shot(fresh.page, 'd29-owner-after-grant');
  } finally {
    await fresh.ctx.close();
  }
});
