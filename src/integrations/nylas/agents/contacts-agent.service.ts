/**
 * Contacts Agent - Nylas Contacts API Operations
 *
 * Handles ALL Nylas Contacts API operations with company-wide scope.
 * Part of the three-agent architecture (Contacts, Calendar, Email).
 *
 * Responsibilities:
 * - Contact search and lookup
 * - Company directory aggregation
 * - Meeting payload enrichment with contact data
 * - Cache-first queries with 7-day TTL
 */

import axios from 'axios';
import {
  findUserGrant,
  getAllCompanyGrants,
  batchQueryGrants,
} from '../services/company-calendar.service';
import { NylasEventCache } from '../models/NylasEventCache';

const NYLAS_API_URL = 'https://api.us.nylas.com';

// ==========================================
// Types & Interfaces
// ==========================================

export interface NylasContact {
  id: string;
  grant_id: string;
  given_name?: string;
  surname?: string;
  emails: Array<{ email: string; type?: string }>;
  phone_numbers?: Array<{ number: string; type?: string }>;
  job_title?: string;
  company_name?: string;
  notes?: string;
  raw: any;
}

export interface MeetingParticipant {
  contact_id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status?: 'pending' | 'accepted' | 'declined';
}

// ==========================================
// Core Contact Operations
// ==========================================

/**
 * Find contact by email using specific user's grant
 *
 * @param companyId - MongoDB company ID
 * @param userEmail - User whose grant to use for search
 * @param searchEmail - Email address to search for
 * @returns Contact or null if not found
 */
export const findContactForUser = async (
  companyId: string,
  userEmail: string,
  searchEmail: string
): Promise<NylasContact | null> => {
  const userAccount = await findUserGrant(companyId, userEmail);
  if (!userAccount) return null;

  // Check cache first (7-day TTL)
  const cached = await NylasEventCache.findOne({
    grantId: userAccount.nylasGrantId,
    eventType: 'contact' as any,
    'data.email': searchEmail,
    expiresAt: { $gt: new Date() },
  });

  if (cached && cached.data) {
    console.log(`[Contacts Agent] Cache hit for ${searchEmail}`);
    return cached.data as any as NylasContact;
  }

  // Cache miss - query Nylas API
  console.log(
    `[Contacts Agent] Cache miss for ${searchEmail}, querying Nylas API`
  );

  try {
    const apiKey = process.env.NYLAS_API_KEY;
    if (!apiKey) {
      throw new Error('NYLAS_API_KEY not configured');
    }

    const response = await axios.get(
      `${NYLAS_API_URL}/v3/grants/${userAccount.nylasGrantId}/contacts`,
      {
        params: { email: searchEmail, limit: 1 },
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const contacts = response.data.data || [];
    if (contacts.length === 0) return null;

    const contact = normalizeContact(contacts[0]);

    // Update cache with 7-day TTL
    await NylasEventCache.upsertEvent(
      userAccount.nylasGrantId,
      'contact' as any,
      contact.id,
      contact,
      7 * 24 // 7 days in hours
    );

    return contact;
  } catch (error: any) {
    console.error(
      `[Contacts Agent] Failed to fetch contact ${searchEmail}:`,
      error.message
    );
    return null;
  }
};

/**
 * Get company directory by aggregating contacts from ALL grants
 *
 * @param companyId - MongoDB company ID
 * @returns Map of email → contact (deduplicated)
 */
export const getCompanyDirectory = async (
  companyId: string
): Promise<Map<string, NylasContact>> => {
  const accounts = await getAllCompanyGrants(companyId);

  console.log(
    `[Contacts Agent] Fetching directory from ${accounts.length} grants`
  );

  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) {
    throw new Error('NYLAS_API_KEY not configured');
  }

  const allContacts = await batchQueryGrants(
    accounts.map((a) => a.nylasGrantId),
    async (grantId) => {
      const response = await axios.get(
        `${NYLAS_API_URL}/v3/grants/${grantId}/contacts`,
        {
          params: { limit: 100 },
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.data || [];
    }
  );

  // Deduplicate by email (first occurrence wins)
  const contactMap = new Map<string, NylasContact>();
  allContacts.forEach(({ result }) => {
    if (result) {
      result.forEach((contact: any) => {
        const normalized = normalizeContact(contact);
        const primaryEmail = normalized.emails[0]?.email;
        if (primaryEmail && !contactMap.has(primaryEmail)) {
          contactMap.set(primaryEmail, normalized);
        }
      });
    }
  });

  console.log(
    `[Contacts Agent] Directory complete: ${contactMap.size} unique contacts`
  );

  return contactMap;
};

/**
 * Create new contact in user's Nylas account
 *
 * @param companyId - MongoDB company ID
 * @param userEmail - User whose grant to use
 * @param contactData - Contact details
 * @returns Created contact
 */
export const createContactForUser = async (
  companyId: string,
  userEmail: string,
  contactData: {
    given_name?: string;
    surname?: string;
    email: string;
    phone?: string;
    company_name?: string;
    job_title?: string;
    notes?: string;
  }
): Promise<NylasContact> => {
  const userAccount = await findUserGrant(companyId, userEmail);
  if (!userAccount) {
    throw new Error(
      `User ${userEmail} has not connected their calendar. Cannot create contact.`
    );
  }

  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) {
    throw new Error('NYLAS_API_KEY not configured');
  }

  const response = await axios.post(
    `${NYLAS_API_URL}/v3/grants/${userAccount.nylasGrantId}/contacts`,
    {
      given_name: contactData.given_name,
      surname: contactData.surname,
      emails: [{ email: contactData.email, type: 'work' }],
      phone_numbers: contactData.phone
        ? [{ number: contactData.phone, type: 'work' }]
        : undefined,
      company_name: contactData.company_name,
      job_title: contactData.job_title,
      notes: contactData.notes,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const contact = normalizeContact(response.data.data);

  // Update cache
  await NylasEventCache.upsertEvent(
    userAccount.nylasGrantId,
    'contact' as any,
    contact.id,
    contact,
    7 * 24 // 7 days
  );

  console.log(
    `[Contacts Agent] Created contact: ${contactData.email} (ID: ${contact.id})`
  );

  return contact;
};

// ==========================================
// Meeting Payload Enrichment
// ==========================================

/**
 * Enrich meeting participants with contact data
 *
 * @param companyId - MongoDB company ID
 * @param organizerEmail - Organizer's email (used for contact lookups)
 * @param participants - Array of participants to enrich
 * @returns Enriched participants with contact details
 */
export const enrichParticipantsWithContacts = async (
  companyId: string,
  organizerEmail: string,
  participants: MeetingParticipant[]
): Promise<MeetingParticipant[]> => {
  console.log(
    `[Contacts Agent] Enriching ${participants.length} participants`
  );

  // Try to find contacts for all participants in parallel
  const enrichedParticipants = await Promise.all(
    participants.map(async (participant) => {
      const contact = await findContactForUser(
        companyId,
        organizerEmail,
        participant.email
      );

      if (!contact) return participant;

      // Merge contact data with participant
      return {
        ...participant,
        contact_id: contact.id,
        name:
          contact.given_name && contact.surname
            ? `${contact.given_name} ${contact.surname}`
            : participant.name,
        phone: contact.phone_numbers?.[0]?.number || participant.phone,
        company: contact.company_name || participant.company,
      };
    })
  );

  const enrichedCount = enrichedParticipants.filter(
    (p) => p.contact_id
  ).length;
  console.log(
    `[Contacts Agent] Enriched ${enrichedCount}/${participants.length} participants`
  );

  return enrichedParticipants;
};

// ==========================================
// Helper Functions (Pure)
// ==========================================

/**
 * Normalize Nylas contact response to standard format
 * Pure function - no side effects
 *
 * @param raw - Raw Nylas API contact response
 * @returns Normalized contact object
 */
const normalizeContact = (raw: any): NylasContact => ({
  id: raw.id,
  grant_id: raw.grant_id,
  given_name: raw.given_name,
  surname: raw.surname,
  emails: raw.emails || [],
  phone_numbers: raw.phone_numbers,
  job_title: raw.job_title,
  company_name: raw.company_name,
  notes: raw.notes,
  raw,
});

/**
 * Extract primary email from contact
 * Pure function
 *
 * @param contact - Nylas contact
 * @returns Primary email address or empty string
 */
export const getPrimaryEmail = (contact: NylasContact): string => {
  return contact.emails[0]?.email || '';
};

/**
 * Format contact name
 * Pure function
 *
 * @param contact - Nylas contact
 * @returns Formatted full name
 */
export const formatContactName = (contact: NylasContact): string => {
  if (contact.given_name && contact.surname) {
    return `${contact.given_name} ${contact.surname}`;
  }
  if (contact.given_name) return contact.given_name;
  if (contact.surname) return contact.surname;
  return getPrimaryEmail(contact);
};
