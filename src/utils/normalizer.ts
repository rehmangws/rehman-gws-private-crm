import { Lead } from '../types/crm';

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  // Strip all non-digit and non-plus characters
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  // If starts with 00, convert to +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.substring(2);
  }
  return cleaned;
}

export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function extractDomain(url?: string | null): string {
  if (!url) return '';
  let cleaned = url.trim().toLowerCase();
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  // Remove www.
  cleaned = cleaned.replace(/^www\./, '');
  // Remove path, query, hash
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  return cleaned;
}

export function normalizeWebsite(url?: string | null): string {
  if (!url) return '';
  const domain = extractDomain(url);
  return domain ? `https://${domain}` : '';
}

export function normalizeBusinessName(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export interface DuplicateCheckResult {
  status: 'Unique' | 'Possible Duplicate' | 'Duplicate';
  matchedLead?: Lead;
  reason?: string;
  field?: 'googlePlaceId' | 'externalPlaceId' | 'phone' | 'website' | 'nameAndAddress';
}

export function checkDuplicateLead(
  candidate: {
    id?: string;
    googlePlaceId?: string;
    externalPlaceId?: string;
    phone?: string;
    whatsapp?: string;
    website?: string;
    businessName?: string;
    address?: string;
    city?: string;
  },
  existingLeads: Lead[]
): DuplicateCheckResult {
  const normPhone = normalizePhone(candidate.phone);
  const normWhatsapp = normalizePhone(candidate.whatsapp);
  const normDomain = extractDomain(candidate.website);
  const normName = normalizeBusinessName(candidate.businessName);
  const normAddress = candidate.address ? candidate.address.trim().toLowerCase() : '';
  const normCity = candidate.city ? candidate.city.trim().toLowerCase() : '';

  for (const lead of existingLeads) {
    if (candidate.id && lead.id === candidate.id) {
      continue; // Skip self if editing
    }

    // 1. External / Google Place ID exact match -> Definite Duplicate
    if (
      candidate.googlePlaceId &&
      lead.googlePlaceId &&
      candidate.googlePlaceId === lead.googlePlaceId
    ) {
      return {
        status: 'Duplicate',
        matchedLead: lead,
        reason: `Matched existing lead "${lead.businessName}" by Google Place ID.`,
        field: 'googlePlaceId',
      };
    }

    if (
      candidate.externalPlaceId &&
      lead.externalPlaceId &&
      candidate.externalPlaceId === lead.externalPlaceId
    ) {
      return {
        status: 'Duplicate',
        matchedLead: lead,
        reason: `Matched existing lead "${lead.businessName}" by External Place ID.`,
        field: 'externalPlaceId',
      };
    }

    // 2. Normalized Phone / WhatsApp match -> Definite Duplicate
    if (normPhone && (lead.phoneNormalized === normPhone || lead.whatsappNormalized === normPhone)) {
      return {
        status: 'Duplicate',
        matchedLead: lead,
        reason: `Matched existing lead "${lead.businessName}" with phone number ${lead.phone}.`,
        field: 'phone',
      };
    }
    if (normWhatsapp && (lead.whatsappNormalized === normWhatsapp || lead.phoneNormalized === normWhatsapp)) {
      return {
        status: 'Duplicate',
        matchedLead: lead,
        reason: `Matched existing lead "${lead.businessName}" with WhatsApp number ${lead.whatsapp}.`,
        field: 'phone',
      };
    }

    // 3. Domain match (if domain is non-empty and not generic social like facebook/instagram)
    if (
      normDomain &&
      lead.websiteDomain &&
      normDomain === lead.websiteDomain &&
      !['facebook.com', 'instagram.com', 'linkedin.com', 'google.com'].includes(normDomain)
    ) {
      return {
        status: 'Possible Duplicate',
        matchedLead: lead,
        reason: `Shares domain "${normDomain}" with existing lead "${lead.businessName}".`,
        field: 'website',
      };
    }

    // 4. Normalized Business Name + Address or City match
    if (normName && lead.businessNameNormalized && normName === lead.businessNameNormalized) {
      if (
        (normCity && lead.city && normCity === lead.city.trim().toLowerCase()) ||
        (normAddress && lead.address && normAddress.includes(lead.address.trim().toLowerCase()))
      ) {
        return {
          status: 'Possible Duplicate',
          matchedLead: lead,
          reason: `Same business name and city/address as "${lead.businessName}".`,
          field: 'nameAndAddress',
        };
      }
    }
  }

  return { status: 'Unique' };
}
