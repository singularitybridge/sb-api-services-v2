/**
 * Nylas Contact Management Service
 *
 * Provides CRUD operations for Google Contacts through Nylas API v3
 */

import axios from 'axios';
import { getApiKey } from '../../../services/api.key.service';

const NYLAS_API_URL = 'https://api.us.nylas.com';

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
// Utility Functions
// ==========================================

async function makeNylasRequest<T>(
  apiKey: string,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
  } = {},
): Promise<T> {
  const url = `${NYLAS_API_URL}${endpoint}`;
  const { method = 'GET', body } = options;

  try {
    const response = await axios({
      url,
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      data: body,
    });

    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;

    let errorMessage = `Nylas API request failed: ${status || error.message}`;

    if (errorData?.error) {
      errorMessage =
        typeof errorData.error === 'string'
          ? errorData.error
          : JSON.stringify(errorData.error);
    } else if (errorData?.message) {
      errorMessage = errorData.message;
    } else if (errorData?.error_description) {
      errorMessage = errorData.error_description;
    }

    console.error(`[NYLAS CONTACTS ERROR] ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

// ==========================================
// Contact Management Functions
// ==========================================

/**
 * Get contacts from Nylas
 */
export async function getContacts(
  companyId: string,
  options: { limit?: number; email?: string } = {},
): Promise<NylasContact[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const { limit = 50, email } = options;

  let endpoint = `/v3/grants/${grantId}/contacts?limit=${limit}`;

  if (email) {
    endpoint += `&email=${encodeURIComponent(email)}`;
  }

  console.log('[NYLAS CONTACTS] Getting contacts:', { limit, email });

  const response = await makeNylasRequest<{ data: NylasContact[] }>(
    apiKey,
    endpoint,
  );

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
  },
): Promise<NylasContact> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const payload: any = {
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

  const endpoint = `/v3/grants/${grantId}/contacts`;
  const response = await makeNylasRequest<{ data: NylasContact } | NylasContact>(
    apiKey,
    endpoint,
    {
      method: 'POST',
      body: payload,
    },
  );

  const contactData = 'data' in response ? response.data : response;

  console.log('[NYLAS CONTACTS] Contact created:', contactData.id);

  return contactData;
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
  },
): Promise<NylasContact> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

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

  const endpoint = `/v3/grants/${grantId}/contacts/${contactId}`;
  const response = await makeNylasRequest<{ data: NylasContact } | NylasContact>(
    apiKey,
    endpoint,
    {
      method: 'PUT',
      body: payload,
    },
  );

  const contactData = 'data' in response ? response.data : response;

  console.log('[NYLAS CONTACTS] Contact updated:', contactData.id);

  return contactData;
}

/**
 * Get a single contact by ID
 */
export async function getContactById(
  companyId: string,
  contactId: string,
): Promise<NylasContact> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  console.log('[NYLAS CONTACTS] Getting contact by ID:', contactId);

  const endpoint = `/v3/grants/${grantId}/contacts/${contactId}`;
  const response = await makeNylasRequest<{ data: NylasContact } | NylasContact>(
    apiKey,
    endpoint,
  );

  const contactData = 'data' in response ? response.data : response;

  console.log('[NYLAS CONTACTS] Contact retrieved:', contactData.id);

  return contactData;
}

/**
 * Delete a contact (hard delete from Nylas)
 */
export async function deleteContact(
  companyId: string,
  contactId: string,
): Promise<void> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  console.log('[NYLAS CONTACTS] Deleting contact:', contactId);

  const endpoint = `/v3/grants/${grantId}/contacts/${contactId}`;
  await makeNylasRequest(apiKey, endpoint, {
    method: 'DELETE',
  });

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
): Promise<NylasContact[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const { limit = 50, name, email, phone, companyName } = criteria;

  // Fetch contacts (Nylas API supports email filter, rest is client-side)
  let endpoint = `/v3/grants/${grantId}/contacts?limit=${Math.max(limit, 100)}`;

  if (email) {
    endpoint += `&email=${encodeURIComponent(email)}`;
  }

  console.log('[NYLAS CONTACTS] Searching contacts:', criteria);

  const response = await makeNylasRequest<{ data: NylasContact[] }>(
    apiKey,
    endpoint,
  );

  let contacts = response.data || [];

  // Client-side filtering for criteria not supported by Nylas API
  if (name) {
    const lowerName = name.toLowerCase();
    contacts = contacts.filter(c => {
      const fullName = `${c.given_name || ''} ${c.surname || ''}`.toLowerCase();
      return fullName.includes(lowerName);
    });
  }

  if (phone) {
    const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
    contacts = contacts.filter(c =>
      c.phone_numbers?.some(p => p.number.replace(/\D/g, '').includes(cleanPhone))
    );
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
  options: { limit?: number } = {},
): Promise<Array<{ contacts: NylasContact[]; reason: string }>> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const { limit = 100 } = options;

  console.log('[NYLAS CONTACTS] Finding duplicates...');

  // Fetch all contacts
  const endpoint = `/v3/grants/${grantId}/contacts?limit=${limit}`;
  const response = await makeNylasRequest<{ data: NylasContact[] }>(
    apiKey,
    endpoint,
  );

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
