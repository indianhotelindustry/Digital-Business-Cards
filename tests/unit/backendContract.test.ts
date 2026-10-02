// Directive 25: the browser's list of callables must match what the backend
// exports, and the browser bundle sources must not contain backend secrets.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const index = readFileSync('functions/src/index.ts', 'utf8');
const exported = (kind: 'callable' | 'onRequest') =>
  [...index.matchAll(new RegExp(`export const (\\w+) = ${kind}\\(`, 'g'))].map((m) => m[1]).sort();

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('browser <-> backend contract', () => {
  it('BACKEND_CALLABLES equals the callables exported by functions/src/index.ts', () => {
    const client = readFileSync('src/lib/backend.ts', 'utf8');
    const list = client.slice(client.indexOf('BACKEND_CALLABLES = ['), client.indexOf('] as const'));
    const names = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    // Public callables (no sign-in) are re-exported from functions/src/public.
    const publicCallables = [...index.matchAll(/export \{ (\w+) \} from '\.\/public\//g)].map((m) => m[1]);
    expect(names).toEqual([...exported('callable'), ...publicCallables].sort());
  });

  it('the payment webhook is an HTTP endpoint, not a browser-callable function', () => {
    expect(exported('onRequest')).toEqual(['razorpayWebhook']);
    expect(exported('callable')).not.toContain('razorpayWebhook');
  });

  it('no secret material or secret parameter is referenced from browser sources', () => {
    const offenders = sources('src').filter((f) =>
      /RAZORPAY_(KEY|WEBHOOK)_SECRET|rzp_sec_|BEGIN PRIVATE KEY|private_key_id|GEMINI_API_KEY\s*=/.test(readFileSync(f, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('every callable handler derives identity from the verified token (loadCaller)', () => {
    expect(index).toMatch(/onCall\(\{ secrets, cors: true \}, async \(req: CallableRequest<unknown>\) => handler\(await loadCaller\(req\.auth\), req\.data\)\)/);
  });
});
