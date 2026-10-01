import { Employee, Company, Department } from '../types';

/**
 * Escapes characters for vCard text values per RFC 6350:
 * Backslash (\), semicolon (;), comma (,), and newlines.
 */
export function escapeVCardText(text: string = ''): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
    .trim();
}

/**
 * Validates and sanitizes a phone number for vCard TEL property.
 */
export function sanitizeVCardPhone(phone: string = ''): string {
  // Allow international +, digits, pauses, hyphens, spaces, parens
  return phone.replace(/[^0-9+*#,\- ]/g, '').trim();
}

/**
 * Generates an RFC 6350 compliant vCard 3.0 string.
 * Strictly includes only public contact fields, escaping all delimiters.
 */
export function generateVCard(
  employee: Employee,
  company?: Company,
  department?: Department | null
): string {
  const safeLastName = escapeVCardText(employee.lastName || '');
  const safeFirstName = escapeVCardText(employee.firstName || '');
  const rawDisplayName = employee.displayName || `${employee.firstName} ${employee.lastName}`.trim();
  const safeDisplayName = escapeVCardText(rawDisplayName);

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${safeLastName};${safeFirstName};;;`,
    `FN:${safeDisplayName}`,
  ];

  if (company) {
    const safeOrgName = escapeVCardText(company.name);
    const orgUnit = department?.name ? `;${escapeVCardText(department.name)}` : '';
    lines.push(`ORG:${safeOrgName}${orgUnit}`);
  }

  if (employee.designation) {
    lines.push(`TITLE:${escapeVCardText(employee.designation)}`);
  }

  if (employee.phone) {
    const cleanPhone = sanitizeVCardPhone(employee.phone);
    if (cleanPhone) {
      lines.push(`TEL;TYPE=WORK,VOICE:${cleanPhone}`);
    }
  }

  if (employee.whatsapp && employee.whatsapp !== employee.phone) {
    const cleanWa = sanitizeVCardPhone(employee.whatsapp);
    if (cleanWa) {
      lines.push(`TEL;TYPE=CELL,VOICE:${cleanWa}`);
    }
  }

  if (employee.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
    lines.push(`EMAIL;TYPE=PREF,INTERNET:${employee.email.trim()}`);
  }

  if (employee.website) {
    const cleanUrl = employee.website.startsWith('http') ? employee.website : `https://${employee.website}`;
    lines.push(`URL:${cleanUrl.trim()}`);
  } else if (company?.website) {
    const cleanUrl = company.website.startsWith('http') ? company.website : `https://${company.website}`;
    lines.push(`URL:${cleanUrl.trim()}`);
  }

  if (company?.address && company.branding?.showCompanyAddress !== false) {
    const safeAddress = escapeVCardText(company.address.replace(/\r?\n/g, ', '));
    lines.push(`ADR;TYPE=WORK:;;${safeAddress};;;;`);
  }

  if (employee.linkedin) {
    const cleanLinkedin = employee.linkedin.startsWith('http')
      ? employee.linkedin
      : `https://${employee.linkedin}`;
    lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${cleanLinkedin.trim()}`);
  }

  if (employee.instagram) {
    const cleanInsta = employee.instagram.startsWith('http')
      ? employee.instagram
      : `https://${employee.instagram}`;
    lines.push(`X-SOCIALPROFILE;TYPE=instagram:${cleanInsta.trim()}`);
  }

  if (employee.bio) {
    const safeBio = escapeVCardText(employee.bio);
    lines.push(`NOTE:${safeBio}`);
  }

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function downloadVCard(
  employee: Employee,
  company?: Company,
  department?: Department | null
): void {
  const vCardContent = generateVCard(employee, company, department);
  const blob = new Blob(['\uFEFF', vCardContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const safeName = (employee.displayName || `${employee.firstName}_${employee.lastName}`)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
    
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${safeName}.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

