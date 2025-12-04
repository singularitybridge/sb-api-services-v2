/**
 * Nylas Contact Management Service
 *
 * Provides CRUD operations for Google Contacts through Nylas API v3
 */

import { getNylasClient } from '../../../lib/nylas-client';
import { getApiKey } from '../../../services/api.key.service';

// Get singleton Nylas client instance
const nylasClient = getNylasClient();

// ==========================================
// Grant Resolution Helper
// ==========================================

/**
 * Get API key and grant ID for Nylas requests
 * Supports both legacy company-level grants and new per-user grants
 * Falls back to environment variables for service account model
 * @param companyId - Company ID for API key lookup
 * @param grantId - Optional grantId (for per-user access). If not provided, uses company-level grant.
 */
async function getNylasCredentials(
  companyId: string,
  grantId?: string
): Promise<{ apiKey: string; grantId: string }> {
  // Try company API key first, fall back to environment variable
  let apiKey = await getApiKey(companyId, 'nylas_api_key');
  if (!apiKey) {
    apiKey = process.env.NYLAS_API_KEY || null;
    if (!apiKey) {
      throw new Error('Nylas API key not found for company');
    }
    console.log('[CONTACTS SERVICE] Using Nylas API key from .env');
  }

  // If grantId provided (per-user), use it
  if (grantId) {
    return { apiKey, grantId };
  }

  // Try company-level grant, fall back to environment variable
  let companyGrantId = await getApiKey(companyId, 'nylas_grant_id');
  if (!companyGrantId) {
    companyGrantId = process.env.NYLAS_GRANT_ID || null;
    if (!companyGrantId) {
      throw new Error('Nylas Grant ID not found for company. Please connect your email account.');
    }
    console.log('[CONTACTS SERVICE] Using Nylas Grant ID from .env (service account)');
  }

  return { apiKey, grantId: companyGrantId };
}

// ==========================================
// Interfaces
// ==========================================

export interface NylasContactEmail {
  email: string;
  type?: string;
}

export interface NylasContactPhone {
  number: string;
  type?: string;
}

export interface NylasContact {
  id: string;
  given_name?: string;
  surname?: string;
  emails?: NylasContactEmail[];
  phone_numbers?: NylasContactPhone[];
  company_name?: string;
  notes?: string;
}

// ==========================================
// Contact Management Functions
// ==========================================

/**
 * Get contacts from Nylas
 */
export async function getContacts(
  companyId: string,
  options: { limit?: number; email?: string; grantId?: string } = {},
): Promise<NylasContact[]> {
  const { limit = 50, email, grantId: userGrantId } = options;
  const { grantId } = await getNylasCredentials(companyId, userGrantId);

  console.log('[NYLAS CONTACTS] Getting contacts:', { limit, email });

  // Use microservice via NylasClient
  let response;
  if (email) {
    // If filtering by email, use search endpoint
    response = await nylasClient.searchContacts({
      grantId,
      email,
      limit,
    });
  } else {
    // Otherwise use list endpoint
    response = await nylasClient.listContacts(grantId, { limit });
  }

  console.log('[NYLAS CONTACTS] Got contacts:', response.data?.length || 0);

  return response.data || [];
}

/**
 * Create a new contact in Nylas
 */
export async function createContact(
  companyId: string,
  contact: {
    givenName?: string;
    surname?: string;
    email: string;
    phone?: string;
    companyName?: string;
    notes?: string;
    grantId?: string;
  },
): Promise<NylasContact> {
  const { grantId: userGrantId } = contact;
  const { grantId } = await getNylasCredentials(companyId, userGrantId);

  const payload: any = {
    grantId,
    emails: [{ email: contact.email, type: 'work' }],
  };

  if (contact.givenName) {
    payload.given_name = contact.givenName;
  }

  if (contact.surname) {
    payload.surname = contact.surname;
  }

  if (contact.phone) {
    payload.phone_numbers = [{ number: contact.phone, type: 'work' }];
  }

  if (contact.companyName) {
    payload.company_name = contact.companyName;
  }

  if (contact.notes) {
    payload.notes = contact.notes;
  }

  console.log('[NYLAS CONTACTS] Creating contact:', payload);

  // Use microservice via NylasClient
  const response = await nylasClient.createContact(payload);

  console.log('[NYLAS CONTACTS] Contact created:', response.data.id);

  return response.data;
}

/**
 * Update an existing contact
 */
export async function updateContact(
  companyId: string,
  contactId: string,
  updates: {
    givenName?: string;
    surname?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    notes?: string;
    grantId?: string;
  },
): Promise<NylasContact> {
  const { grantId: userGrantId } = updates;
  const { grantId } = await getNylasCredentials(companyId, userGrantId);

  const payload: any = {};

  if (updates.givenName !== undefined) {
    payload.given_name = updates.givenName;
  }

  if (updates.surname !== undefined) {
    payload.surname = updates.surname;
  }

  if (updates.email !== undefined) {
    payload.emails = [{ email: updates.email, type: 'work' }];
  }

  if (updates.phone !== undefined) {
    payload.phone_numbers = [{ number: updates.phone, type: 'work' }];
  }

  if (updates.companyName !== undefined) {
    payload.company_name = updates.companyName;
  }

  if (updates.notes !== undefined) {
    payload.notes = updates.notes;
  }

  console.log('[NYLAS CONTACTS] Updating contact:', contactId, payload);

  // Use microservice via NylasClient
  const response = await nylasClient.updateContact(grantId, contactId, payload);

  console.log('[NYLAS CONTACTS] Contact updated:', response.data.id);

  return response.data;
}

/**
 * Get a single contact by ID
 */
export async function getContactById(
  companyId: string,
  contactId: string,
  grantId?: string,
): Promise<NylasContact> {
  const credentials = await getNylasCredentials(companyId, grantId);

  console.log('[NYLAS CONTACTS] Getting contact by ID:', contactId);

  // Use microservice via NylasClient
  const response = await nylasClient.getContact(credentials.grantId, contactId);

  console.log('[NYLAS CONTACTS] Contact retrieved:', response.data.id);

  // DEBUG: Log emails field type and value
  console.log('[DEBUG SERVICE] contactData.emails type:', typeof response.data.emails);
  console.log('[DEBUG SERVICE] contactData.emails value:', response.data.emails);
  console.log('[DEBUG SERVICE] contactData.emails JSON:', JSON.stringify(response.data.emails));
  console.log('[DEBUG SERVICE] Is Array:', Array.isArray(response.data.emails));

  return response.data;
}

/**
 * Delete a contact (hard delete from Nylas)
 */
export async function deleteContact(
  companyId: string,
  contactId: string,
  grantId?: string,
): Promise<void> {
  const credentials = await getNylasCredentials(companyId, grantId);

  console.log('[NYLAS CONTACTS] Deleting contact:', contactId);

  // Use microservice via NylasClient
  await nylasClient.deleteContact(credentials.grantId, contactId);

  console.log('[NYLAS CONTACTS] Contact deleted:', contactId);
}

// ==========================================
// Advanced Search & Filtering
// ==========================================

export interface SearchCriteria {
  name?: string;           // Search in given_name + surname
  email?: string;          // Search in emails
  phone?: string;          // Search in phone_numbers
  companyName?: string;    // Search in company_name
  limit?: number;          // Max results (default: 50)
}

/**
 * Search contacts with multiple criteria
 * Note: Nylas API has limited search - we fetch and filter client-side
 */
export async function searchContacts(
  companyId: string,
  criteria: SearchCriteria,
  grantId?: string,
): Promise<NylasContact[]> {
  const { limit = 50, name, email, phone, companyName } = criteria;
  const credentials = await getNylasCredentials(companyId, grantId);

  console.log('[NYLAS CONTACTS] Searching contacts:', criteria);

  // Use microservice via NylasClient
  const response = await nylasClient.searchContacts({
    grantId: credentials.grantId,
    email,
    phone,
    limit: Math.max(limit, 100),
  });

  let contacts = response.data || [];

  // Client-side filtering for criteria not supported by Nylas API
  if (name) {
    const lowerName = name.toLowerCase();
    contacts = contacts.filter(c => {
      const fullName = `${c.given_name || ''} ${c.surname || ''}`.toLowerCase();
      return fullName.includes(lowerName);
    });
  }

  if (companyName) {
    const lowerCompany = companyName.toLowerCase();
    contacts = contacts.filter(c =>
      c.company_name?.toLowerCase().includes(lowerCompany)
    );
  }

  // Trim to requested limit
  const results = contacts.slice(0, limit);

  console.log('[NYLAS CONTACTS] Search results:', results.length);

  return results;
}

/**
 * Find duplicate contacts based on email or name similarity
 */
export async function findDuplicates(
  companyId: string,
  options: { limit?: number; grantId?: string } = {},
): Promise<Array<{ contacts: NylasContact[]; reason: string }>> {
  const { limit = 100, grantId: userGrantId } = options;
  const credentials = await getNylasCredentials(companyId, userGrantId);

  console.log('[NYLAS CONTACTS] Finding duplicates...');

  // Use microservice via NylasClient to fetch all contacts
  const response = await nylasClient.listContacts(credentials.grantId, { limit });

  const contacts = response.data || [];
  const duplicates: Array<{ contacts: NylasContact[]; reason: string }> = [];

  // Find duplicates by email
  const emailMap = new Map<string, NylasContact[]>();
  contacts.forEach(contact => {
    contact.emails?.forEach(emailObj => {
      const email = emailObj.email.toLowerCase();
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email)!.push(contact);
    });
  });

  emailMap.forEach((contactList, email) => {
    if (contactList.length > 1) {
      duplicates.push({
        contacts: contactList,
        reason: `Duplicate email: ${email}`,
      });
    }
  });

  // Find duplicates by exact name match
  const nameMap = new Map<string, NylasContact[]>();
  contacts.forEach(contact => {
    if (contact.given_name && contact.surname) {
      const fullName = `${contact.given_name} ${contact.surname}`.toLowerCase();
      if (!nameMap.has(fullName)) {
        nameMap.set(fullName, []);
      }
      nameMap.get(fullName)!.push(contact);
    }
  });

  nameMap.forEach((contactList, name) => {
    if (contactList.length > 1) {
      // Check if not already found by email
      const ids = contactList.map(c => c.id).sort().join(',');
      const alreadyFound = duplicates.some(dup =>
        dup.contacts.map(c => c.id).sort().join(',') === ids
      );

      if (!alreadyFound) {
        duplicates.push({
          contacts: contactList,
          reason: `Duplicate name: ${name}`,
        });
      }
    }
  });

  console.log('[NYLAS CONTACTS] Found duplicates:', duplicates.length);

  return duplicates;
}
