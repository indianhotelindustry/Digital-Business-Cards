// Directive 24 Phase 4 — DSBC Connect: public contact exchange stays open but
// strictly validated; connectionEvents can no longer be injected by
// unauthenticated visitors or by users outside the connection.

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { createRulesEnv, dbFor, fullWorld, ID, loadFixtures } from './support/rulesEnv';

let env: RulesTestEnvironment;
const T = '2026-10-01T00:00:00.000Z';

// Exactly the shape ExchangeContactModal + connectService.createConnectionRequest write.
const visitorRequest = (overrides: Record<string, unknown> = {}) => ({
  id: 'conn_visitor_1',
  connectionVersion: 'v2.0',
  requesterUserId: 'visitor_1696150000000_ab12',
  recipientUserId: null,
  requesterIdentityId: 'visitor_1696150000000_ab12',
  recipientIdentityId: 'emp_a',
  requesterName: 'Visitor Name',
  requesterTitle: 'CTO',
  requesterCompany: 'Visitor Co',
  requesterEmail: 'visitor@example.test',
  requesterCompanyId: null,
  recipientCompanyId: 'company_acme',
  status: 'pending',
  initiatedBy: 'visitor_1696150000000_ab12',
  exchangeMethod: 'card_exchange',
  consentState: 'requested',
  sharedCategories: ['email'],
  initialNote: 'Met at the expo',
  createdAt: T,
  updatedAt: T,
  lastInteractionAt: T,
  ...overrides,
});

beforeAll(async () => {
  env = await createRulesEnv('phase4connect');
});
afterAll(async () => env?.cleanup());
beforeEach(async () => loadFixtures(env, fullWorld()));

const visitor = () => dbFor(env, ID.unauthenticated);

describe('Phase 4 — public contact exchange', () => {
  it('ALLOWED (control): visitor sends a contact-exchange request to an active employee', async () => {
    await assertSucceeds(setDoc(doc(visitor(), 'connections', 'conn_visitor_1'), visitorRequest()));
  });

  const attacks: Record<string, Record<string, unknown>> = {
    'to a company that does not exist': { recipientCompanyId: 'company_ghost' },
    'to a suspended company': { recipientCompanyId: 'company_suspended', recipientIdentityId: 'emp_susp' },
    'impersonating a real user as requester': { requesterUserId: 'uid_ind_a', requesterIdentityId: 'uid_ind_a', initiatedBy: 'uid_ind_a' },
    'pre-accepted': { status: 'accepted' },
    'with consent already granted': { consentState: 'granted' },
    'binding a B employee to company A': { recipientIdentityId: 'emp_b' },
    'targeting a specific recipient user': { recipientUserId: 'uid_emp_a' },
    'claiming a requester company': { requesterCompanyId: 'company_nexus' },
    'with an injected extra field': { relationshipPriority: 'vip', ownerOverride: true },
  };
  for (const [name, overrides] of Object.entries(attacks)) {
    it(`DENIED: visitor request ${name}`, async () => {
      await assertFails(setDoc(doc(visitor(), 'connections', 'conn_visitor_x'), visitorRequest(overrides)));
    });
  }
});

describe('Phase 4 — connectionEvents lockdown', () => {
  const event = (overrides: Record<string, unknown> = {}) => ({
    id: 'cevt_new', connectionId: 'conn_ab', participantUserIds: ['uid_ind_a', 'uid_ind_b'], eventType: 'NOTE_ADDED',
    actorUserId: 'uid_ind_a', actorName: 'A', description: 'x', timestamp: T, ...overrides,
  });

  it('DENIED: unauthenticated CONNECTION_REQUESTED event', async () => {
    await assertFails(setDoc(doc(visitor(), 'connectionEvents', 'cevt_new'), event({ eventType: 'CONNECTION_REQUESTED', actorUserId: 'visitor_x', participantUserIds: [] })));
  });

  it('DENIED: outsider injects an event into someone else\'s connection', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.employeeB), 'connectionEvents', 'cevt_new'), event({ actorUserId: 'uid_emp_b' })));
  });

  it('DENIED: outsider writes an event naming a victim as owner', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.employeeB), 'connectionEvents', 'cevt_new'), event({ actorUserId: 'uid_emp_b', ownerUserId: 'uid_emp_b', participantUserIds: ['uid_ind_a'] })));
  });

  it('DENIED: participant adds an outsider to participantUserIds', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_new'), event({ participantUserIds: ['uid_ind_a', 'uid_ind_b', 'uid_emp_b'] })));
  });

  it('DENIED: participant forges another actor', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_new'), event({ actorUserId: 'uid_ind_b' })));
  });

  it('DENIED: event for a connection that does not exist', async () => {
    await assertFails(setDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_new'), event({ connectionId: 'conn_ghost' })));
  });

  it('DENIED: timeline history is immutable (update)', async () => {
    await assertFails(updateDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_ab'), { description: 'rewritten' }));
  });

  it('DENIED: timeline history is immutable (delete)', async () => {
    await assertFails(deleteDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_ab')));
  });

  it('ALLOWED (control): participant records an event on their own connection', async () => {
    await assertSucceeds(setDoc(doc(dbFor(env, ID.individualA), 'connectionEvents', 'cevt_new'), event()));
  });
});
