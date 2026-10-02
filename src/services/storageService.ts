// Directive 25 Phase 10: storage.rules deny every client write. Files go
// through the uploadAsset callable, which authorises the caller from server
// records, re-validates the bytes and reserves storage quota atomically.
// The browser-side checks below only give early feedback.
import { callBackend } from '../lib/backend';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validates file magic bytes to ensure file is genuinely a raster image,
 * preventing extension spoofing or executable upload attempts.
 */
export async function validateImageBytes(file: File): Promise<{ valid: boolean; reason?: string }> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      reason: `File size exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      reason: `Unsupported file type: ${file.type}. Allowed formats: JPEG, PNG, WEBP.`,
    };
  }

  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;

    // Check JPEG: FF D8 FF
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    // Check WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
    const isRiff =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46;
    const isWebp =
      isRiff &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    if (!isPng && !isJpeg && !isWebp) {
      return {
        valid: false,
        reason: 'File binary header does not match authorized image signature.',
      };
    }

    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      reason: `Failed to inspect file bytes: ${err.message || 'Unknown error'}`,
    };
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function upload(kind: 'company_logo' | 'employee_photo' | 'individual_photo', file: File, employeeId?: string): Promise<string> {
  const validation = await validateImageBytes(file);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid file');
  }
  const res = await callBackend<{ downloadUrl: string }>('uploadAsset', {
    kind,
    ...(employeeId ? { employeeId } : {}),
    dataBase64: await fileToBase64(file),
    fileName: file.name,
  });
  return res.downloadUrl;
}

/**
 * Uploads a company branding logo. The backend derives the company from the
 * caller's profile (companyId is kept in the signature for existing callers).
 */
export async function uploadCompanyLogo(_companyId: string, file: File): Promise<string> {
  return upload('company_logo', file);
}

/** Uploads an employee profile photo (company admin, or the employee themself). */
export async function uploadEmployeePhoto(_companyId: string, employeeId: string, file: File): Promise<string> {
  return upload('employee_photo', file, employeeId);
}
