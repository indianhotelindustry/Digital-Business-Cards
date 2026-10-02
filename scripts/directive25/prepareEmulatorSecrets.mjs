// Generates functions/.secret.local with RANDOM emulator-only secrets
// (Directive 25 Phase 12). The file is git-ignored; nothing here is a real
// Razorpay credential. Tests read the same file to sign test webhooks.
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const target = new URL('../../functions/.secret.local', import.meta.url);
if (!existsSync(target)) {
  const secret = () => randomBytes(32).toString('hex');
  writeFileSync(target, `RAZORPAY_KEY_SECRET=${secret()}\nRAZORPAY_WEBHOOK_SECRET=${secret()}\n`);
  console.log('Generated functions/.secret.local (emulator-only random secrets).');
}
