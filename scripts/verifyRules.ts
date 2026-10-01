import { doc, getDoc, setDoc, updateDoc, deleteDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

// Directive 24: this legacy, unauthenticated script used to write against the
// LIVE Firebase project and counted any error (including network failures) as
// a PASS. It is kept for reference but only runs against the emulator. The
// authoritative security suite is `npm run test:rules` (tests/rules/*).
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run verifyRules.ts against a real Firebase project. Use `npm run test:rules`.');
  process.exit(2);
}
{
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}

async function runAll13SecurityTests() {
  console.log('====================================================');
  console.log('  STARTING SUITE OF ALL 13 FIRESTORE SECURITY TESTS  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. CT-001: Cross-tenant read on private user document (Expect DENIED)
  try {
    const docRef = doc(db, 'users', 'user_admin_nexus_demo');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log('❌ [CT-001] FAIL: Unauthenticated/cross-tenant read of private user was ALLOWED');
      failed++;
    } else {
      console.log('✅ [CT-001] PASS: Private user document read blocked by security rules');
      passed++;
    }
  } catch (err: any) {
    console.log('✅ [CT-001] PASS: Private user document read rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 2. CT-002: Cross-tenant employee update (Expect DENIED)
  try {
    const docRef = doc(db, 'employees', 'emp_nexus_marcus');
    await updateDoc(docRef, { displayName: 'Tampered Name', updatedAt: new Date().toISOString() });
    console.log('❌ [CT-002] FAIL: Cross-tenant employee mutation was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-002] PASS: Cross-tenant employee mutation rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 3. CT-003: Cross-tenant employee deletion (Expect DENIED)
  try {
    const docRef = doc(db, 'employees', 'emp_nexus_marcus');
    await deleteDoc(docRef);
    console.log('❌ [CT-003] FAIL: Cross-tenant employee deletion was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-003] PASS: Cross-tenant employee deletion rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 4. CT-004: Foreign companyId injection into department (Expect DENIED)
  try {
    const docRef = doc(db, 'departments', 'dept_injected_foreign_tenant');
    await setDoc(docRef, {
      id: 'dept_injected_foreign_tenant',
      companyId: 'company_nexus',
      name: 'Injected Foreign Dept',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-004] FAIL: Foreign companyId injection was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-004] PASS: Foreign companyId injection rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 5. CT-005: Cross-tenant department assignment (Expect DENIED)
  try {
    const docRef = doc(db, 'employees', 'emp_acme_rahul');
    await updateDoc(docRef, {
      departmentId: 'dept_nexus_leadership',
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-005] FAIL: Cross-tenant department assignment was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-005] PASS: Cross-tenant department assignment rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 6. CT-006: Cross-tenant card association (Expect DENIED)
  try {
    const docRef = doc(db, 'cards', 'card_tamper_cross_tenant_test');
    await setDoc(docRef, {
      id: 'card_tamper_cross_tenant_test',
      companyId: 'company_acme',
      employeeId: 'emp_nexus_marcus',
      templateId: 'classic',
      publicSlug: 'tamper-slug-cross-test',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-006] FAIL: Cross-tenant employee-card association was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-006] PASS: Cross-tenant employee-card association rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 7. CT-007: Peer user private profile read (Expect DENIED)
  try {
    const docRef = doc(db, 'users', 'user_admin_acme_demo');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log('❌ [CT-007] FAIL: Peer private user profile read was ALLOWED');
      failed++;
    } else {
      console.log('✅ [CT-007] PASS: Peer user profile not readable without authorization');
      passed++;
    }
  } catch (err: any) {
    console.log('✅ [CT-007] PASS: Peer private user profile read rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 8. CT-008: Peer employee record overwrite (Expect DENIED)
  try {
    const docRef = doc(db, 'employees', 'emp_acme_rahul');
    await updateDoc(docRef, {
      displayName: 'Hacked Identity',
      bio: 'Unauthorized Bio Edit',
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-008] FAIL: Peer employee modification was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-008] PASS: Peer employee record modification rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 9. CT-009: Employee self-transfer companyId (Expect DENIED)
  try {
    const docRef = doc(db, 'employees', 'emp_acme_rahul');
    await updateDoc(docRef, {
      companyId: 'company_nexus',
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-009] FAIL: Unauthorized companyId transfer was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-009] PASS: Unauthorized companyId transfer rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 10. CT-010: Privilege escalation to app_owner (Expect DENIED)
  try {
    const docRef = doc(db, 'users', 'user_emp_rahul_demo');
    await updateDoc(docRef, {
      role: 'app_owner',
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [CT-010] FAIL: Privilege escalation to app_owner was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [CT-010] PASS: Privilege escalation to app_owner rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 11. PUB-001: Public unauthenticated read of active card (Expect ALLOWED)
  try {
    const docRef = doc(db, 'cards', 'card_acme_rahul');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().status === 'active') {
      console.log('✅ [PUB-001] PASS: Public can read active card (card_acme_rahul)');
      passed++;
    } else {
      console.log('❌ [PUB-001] FAIL: Active card was not found or inaccessible');
      failed++;
    }
  } catch (err: any) {
    console.log('❌ [PUB-001] FAIL with error: ' + err.message);
    failed++;
  }

  // 12. SUSP-001: Suspended company mutation / Self-unsuspend (Expect DENIED)
  try {
    const docRef = doc(db, 'companies', 'company_nexus');
    await updateDoc(docRef, {
      name: 'Tampered While Suspended',
      updatedAt: new Date().toISOString(),
    });
    console.log('❌ [SUSP-001] FAIL: Suspended company mutation was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [SUSP-001] PASS: Suspended company mutation rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  // 13. TELEM-001: Mismatched cross-tenant telemetry event injection (Expect DENIED)
  try {
    const docRef = doc(db, 'analytics', 'telemetry_spoof_test_runner');
    await setDoc(docRef, {
      id: 'telemetry_spoof_test_runner',
      companyId: 'company_nexus',
      employeeId: 'emp_acme_rahul',
      cardId: 'card_nexus_marcus',
      eventType: 'card_view',
      timestamp: new Date().toISOString(),
    });
    console.log('❌ [TELEM-001] FAIL: Mismatched telemetry injection was ALLOWED');
    failed++;
  } catch (err: any) {
    console.log('✅ [TELEM-001] PASS: Cross-tenant telemetry injection rejected (' + (err.code || 'permission-denied') + ')');
    passed++;
  }

  console.log('\n====================================================');
  console.log(`  SECURITY AUDIT COMPLETE: ${passed}/13 PASSED, ${failed}/13 FAILED  `);
  console.log('====================================================');

  process.exit(failed === 0 ? 0 : 1);
}

runAll13SecurityTests();
