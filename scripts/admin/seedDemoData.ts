// ============================================================================
// Controlled demo-data bootstrap (Directive 24 Phase 3)
// ============================================================================
// Replaces the browser auto-seed and the `!exists(company_acme)` rules
// backdoor. Writes the demo tenants with the Admin SDK, which bypasses rules
// by design, so it is guarded by adminTarget:
//   * emulator: always allowed
//   * real project: --project X --confirm-project X --allow-non-emulator,
//     and never a production-like project.
//
//   npm run seed                      (emulator: run `npm run emulators` first)
//   npm run seed -- --project dsbc-dev --confirm-project dsbc-dev --allow-non-emulator

import { pathToFileURL } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { parseArgs, resolveAdminTarget } from './adminTarget';
// seedService -> cardService -> demoStore -> seedService is a cycle; loading
// cardService first (as the app and scripts/seedDatabase.ts do) lets
// seedService finish initialising before demoStore reads DEMO_USERS.
import '../../src/services/cardService';
import { writeDemoSeedData } from '../../src/services/seedService';

export async function seedDemoData(db: Firestore): Promise<{ success: boolean; message: string; documents: number }> {
  let documents = 0;
  const result = await writeDemoSeedData(async (collectionName, id, data) => {
    await db.collection(collectionName).doc(id).set(JSON.parse(JSON.stringify(data)));
    documents++;
  });
  return { ...result, documents };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = resolveAdminTarget(args, 'seed-demo');
  const app = getApps()[0] || initializeApp({ projectId: target.projectId });
  const result = await seedDemoData(getFirestore(app, target.databaseId));
  console.log(`${result.success ? 'Seeded' : 'FAILED'}: ${result.documents} documents into ${target.projectId}/${target.databaseId}${target.emulator ? ' [emulator]' : ''}`);
  if (!result.success) {
    console.error(result.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
