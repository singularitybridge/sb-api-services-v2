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
