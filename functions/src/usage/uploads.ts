// ============================================================================
// Backend-only asset upload with storage quota (Directive 25 Phase 10)
// ============================================================================
// storage.rules deny every client write, so this is the only way a file gets
// into Cloud Storage. The handler authorises the caller from server records,
// validates the bytes (magic numbers, 5 MB cap), reserves storage quota
// atomically and only then writes the object.

import { randomUUID } from 'node:crypto';
import { logger } from 'firebase-functions';
import { bucket, db } from '../shared/firebase';
import { deny, fail, invalid } from '../shared/errors';
import { ID_PATTERN, obj, oneOf, str } from '../shared/validate';
import { requireActiveProfile, resolveCommercialSubject, type Caller } from '../auth/identity';
import { releaseStorage, reserveStorage } from './quota';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function sniffImage(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function uploadAsset(caller: Caller, data: unknown) {
  const p = obj(data, ['kind', 'employeeId', 'dataBase64', 'fileName']);
  const kind = oneOf(p, 'kind', ['company_logo', 'employee_photo', 'individual_photo'] as const);
  const profile = requireActiveProfile(caller);
  const raw = str(p, 'dataBase64', { max: Math.ceil(MAX_UPLOAD_BYTES * 1.4) });
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) invalid('Empty file.');
  if (buf.length > MAX_UPLOAD_BYTES) invalid('File exceeds 5 MB.');
  const contentType = sniffImage(buf);
  if (!contentType) invalid('File is not a PNG, JPEG or WEBP image.');
  const safeName = (str(p, 'fileName', { optional: true, max: 120 }) || 'upload').toLowerCase().replace(/[^a-z0-9.]/g, '_');

  let path: string;
  if (kind === 'company_logo') {
    if (profile.role !== 'company_admin' || !profile.companyId) deny('Only a company admin may upload branding.');
    path = `companies/${profile.companyId}/branding/${Date.now()}_${safeName}`;
  } else if (kind === 'employee_photo') {
    const employeeId = str(p, 'employeeId', { pattern: ID_PATTERN });
    const emp = await db().collection('employees').doc(employeeId).get();
    if (!emp.exists || emp.get('companyId') !== profile.companyId) deny('Employee is not in your company.');
    const isAdmin = profile.role === 'company_admin';
    if (!isAdmin && profile.employeeId !== employeeId) deny('You may only upload your own photo.');
    path = `companies/${profile.companyId}/employees/${employeeId}/${Date.now()}_${safeName}`;
  } else {
    if (profile.companyId) deny('Company members upload through their company.');
    path = `individuals/${caller.uid}/${Date.now()}_${safeName}`;
  }

  const subject = await resolveCommercialSubject(caller);
  await db().runTransaction(async (tx) => {
    const commit = await reserveStorage(tx, subject, buf.length);
    commit();
  });

  try {
    const token = randomUUID();
    const file = bucket().file(path);
    await file.save(buf, { contentType: contentType!, resumable: false, metadata: { metadata: { firebaseStorageDownloadTokens: token, uploadedBy: caller.uid, tenantId: subject.tenantId } } });
    // In the emulator the object lives in the Storage emulator, never in Google Cloud Storage.
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const origin = emulatorHost ? `http://${emulatorHost.replace(/^https?:\/\//, '')}` : 'https://firebasestorage.googleapis.com';
    const downloadUrl = `${origin}/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    return { path, bytes: buf.length, contentType, downloadUrl };
  } catch (err) {
    await releaseStorage(subject, buf.length); // compensate the reservation
    logger.error('uploadAsset failed', err); // detail stays server-side
    return fail('internal', 'Upload failed.');
  }
}
