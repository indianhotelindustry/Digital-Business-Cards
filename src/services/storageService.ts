import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

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

/**
 * Uploads a validated company branding logo to Firebase Storage
 */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const validation = await validateImageBytes(file);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid file');
  }

  const cleanFileName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '_');
  const timestamp = Date.now();
  const storagePath = `companies/${companyId}/branding/${timestamp}_${cleanFileName}`;

  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      companyId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return getDownloadURL(snapshot.ref);
}

/**
 * Uploads a validated employee profile photo to Firebase Storage
 */
export async function uploadEmployeePhoto(
  companyId: string,
  employeeId: string,
  file: File
): Promise<string> {
  const validation = await validateImageBytes(file);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid file');
  }

  const cleanFileName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '_');
  const timestamp = Date.now();
  const storagePath = `companies/${companyId}/employees/${employeeId}/${timestamp}_${cleanFileName}`;

  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      companyId,
      employeeId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return getDownloadURL(snapshot.ref);
}
