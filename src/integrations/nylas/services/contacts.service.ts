/**
 * Nylas Contact Management Service
 *
 * Proxies contact operations through V3 microservice
 */

import axios from 'axios';
import { resolveGrantId } from '../utils/grant-resolver';
import { NylasContact, NylasContactEmail, NylasContactPhone } from '../types';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

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
