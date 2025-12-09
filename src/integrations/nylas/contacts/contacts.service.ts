/**
 * Nylas Contact Management Service
 *
 * Proxies contact operations through V3 microservice
 */

import axios from 'axios';
import { getApiKey } from '../../../services/api.key.service';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

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
// Helper Functions
// ==========================================

/**
 * Resolve grant ID for a specific user email by calling V3 microservice
 * Falls back to company default if user email not provided or not found
 */
async function resolveGrantId(companyId: string, userEmail?: string): Promise<string> {
  // If userEmail provided, try to get user-specific grant from V3
  if (userEmail) {
    try {
      const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/grants/by-email`, {
        params: { email: userEmail.toLowerCase() },
        timeout: 5000,
      });

      if (response.data?.grantId) {
        console.log(`[contacts-service] Resolved grant for ${userEmail}: ${response.data.grantId.substring(0, 8)}...`);
        return response.data.grantId;
      }
    } catch (error: any) {
      console.warn(`[contacts-service] Could not resolve grant for ${userEmail}, falling back to company default:`, error.message);
    }
  }

  // Fall back to company default grant
  const grantId = await getApiKey(companyId, 'nylas_grant_id');
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }
  return grantId;
}

// ==========================================
// Contact Management Functions
// ==========================================

/**
 * Get contacts via V3 microservice
 */
export async function getContacts(
  companyId: string,
  options: { limit?: number; email?: string; userEmail?: string } = {},
): Promise<NylasContact[]> {
  const { limit = 50, email, userEmail } = options;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS CONTACTS] Getting contacts via V3:', { limit, email, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/contacts`, {
      params: {
        grantId,
        limit,
        email,
      },
      timeout: 10000,
    });

    const contacts = response.data?.data || [];
    console.log('[NYLAS CONTACTS] Got contacts:', contacts.length);
    return contacts;
  } catch (error: any) {
    console.error('[NYLAS CONTACTS ERROR]', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get contacts');
  }
}

/**
 * Create a new contact via V3 microservice
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
    userEmail?: string;
  },
): Promise<NylasContact> {
  const { userEmail, ...contactData } = contact;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS CONTACTS] Creating contact via V3:', { email: contact.email, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/contacts`, {
      grantId,
      givenName: contactData.givenName,
      surname: contactData.surname,
      email: contactData.email,
      phone: contactData.phone,
      companyName: contactData.companyName,
      notes: contactData.notes,
    }, {
      timeout: 10000,
    });

    const createdContact = response.data?.data || response.data;
    console.log('[NYLAS CONTACTS] Contact created:', createdContact?.id);
    return createdContact;
  } catch (error: any) {
    console.error('[NYLAS CONTACTS ERROR]', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to create contact');
  }
}

/**
 * Update an existing contact via V3 microservice
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
    userEmail?: string;
  },
): Promise<NylasContact> {
  const { userEmail, ...updateData } = updates;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS CONTACTS] Updating contact via V3:', { contactId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.put(`${V3_SERVICE_URL}/api/v1/nylas/contacts/${contactId}`, {
      grantId,
      ...updateData,
    }, {
      timeout: 10000,
    });

    const updatedContact = response.data?.data || response.data;
    console.log('[NYLAS CONTACTS] Contact updated:', updatedContact?.id);
    return updatedContact;
  } catch (error: any) {
    console.error('[NYLAS CONTACTS ERROR]', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to update contact');
  }
}
