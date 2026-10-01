/**
 * Security and sanitization utilities for Digital Business Card SaaS
 * Enforces URL safety, protocol whitelisting, and input sanitization.
 */

/**
 * Validates and sanitizes a URL.
 * Only permits https:// and http:// schemes.
 * Rejects javascript:, data:, vbscript:, and relative script injections.
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Strip non-printable and control characters
  const clean = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');
  const lower = clean.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('//')
  ) {
    console.warn(`[Security Warning] Blocked potentially malicious URL scheme: ${trimmed}`);
    return null;
  }

  // If scheme is omitted, normalize to https://
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    // Disallow custom schemes with colons before slash (e.g. unknown-scheme:payload)
    const colonIdx = clean.indexOf(':');
    const slashIdx = clean.indexOf('/');
    if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
      return null;
    }
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Validates and formats a phone number for tel: href.
 */
export function sanitizePhoneHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9+]/g, '');
  if (!digits) return null;
  return `tel:${digits}`;
}

/**
 * Validates and formats a WhatsApp number for https://wa.me/ href.
 */
export function sanitizeWhatsAppHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

/**
 * Validates and formats an email for mailto: href.
 */
export function sanitizeMailtoHref(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

/**
 * Strip internal fields to ensure clean public projection
 */
export function sanitizePublicCardProjection<T extends Record<string, any>>(data: T, allowedKeys: (keyof T)[]): Partial<T> {
  const projected: Partial<T> = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      projected[key] = data[key];
    }
  }
  return projected;
}
