// Read-only production smoke test: a fresh, never-signed-in Chrome context opens public URLs.
import { chromium } from '@playwright/test';

const OUT = process.argv[2];
const slugs = process.argv.slice(3);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const slug of slugs) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', (r) => { if (r.url().includes('resolvePublicEntity')) calls.push(`${r.status()} ${r.url()}`); });
  const resolved = page.waitForResponse((r) => r.url().includes('resolvePublicEntity'), { timeout: 60000 });
  await page.goto(`https://task360-ift.web.app/card/${slug}`, { waitUntil: 'load' });
  await resolved;
  await page.waitForTimeout(2500);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  const cookies = (await ctx.cookies()).length;
  const images = await page.$$eval('img', (els) => els.map((e) => ({ src: e.src.slice(0, 110), loaded: e.complete && e.naturalWidth > 0 })));
  console.log(JSON.stringify(images));
  await page.screenshot({ path: `${OUT}/smoke-${slug}.png`, fullPage: false });
  console.log(JSON.stringify({ slug, calls, cookies, text }, null, 1));
  await ctx.close();
}
await browser.close();
