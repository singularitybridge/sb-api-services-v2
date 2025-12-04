/**
 * Contacts Service for Nylas Microservice
 *
 * Thin wrapper around Nylas Contacts API
 * All business logic and database operations handled by main app
 */

import axios from 'axios';
import { config } from '../config.js';

const NYLAS_API_URL = config.nylas.apiUrl;

// ==========================================
// Type Definitions
// ==========================================

export interface ContactEmail {
  type?: 'work' | 'personal' | 'other';
  email: string;
}

export interface ContactPhoneNumber {
  type?: 'work' | 'mobile' | 'home' | 'other';
  number: string;
}

export interface ContactAddress {
  type?: 'work' | 'home' | 'other';
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface Contact {
  id: string;
  grant_id?: string;
  object?: string;
  given_name?: string;
  middle_name?: string;
  surname?: string;
  nickname?: string;
  company_name?: string;
  job_title?: string;
  manager_name?: string;
  office_location?: string;
  notes?: string;
  picture_url?: string;
  birthday?: string;
  emails?: ContactEmail[];
  phone_numbers?: ContactPhoneNumber[];
  physical_addresses?: ContactAddress[];
  web_pages?: Array<{ type?: string; url: string }>;
  im_addresses?: Array<{ type?: string; im_address: string }>;
  groups?: Array<{ id: string; name?: string }>;
}

export interface CreateContactRequest {
  grantId: string;
  given_name?: string;
  middle_name?: string;
  surname?: string;
  nickname?: string;
  company_name?: string;
  job_title?: string;
  manager_name?: string;
  office_location?: string;
  notes?: string;
  emails?: ContactEmail[];
  phone_numbers?: ContactPhoneNumber[];
  physical_addresses?: ContactAddress[];
  web_pages?: Array<{ type?: string; url: string }>;
}

export interface SearchContactsRequest {
  grantId: string;
  query?: string;
  email?: string;
  phone?: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// Search Contacts
// ==========================================

/**
 * Search contacts by query, email, or phone
 */
export async function searchContacts(params: SearchContactsRequest): Promise<Contact[]> {
  const { grantId, query, email, phone, limit = 50, offset = 0 } = params;

  try {
    const queryParams = new URLSearchParams();
    if (query) queryParams.set('q', query);
    if (email) queryParams.set('email', email);
    if (phone) queryParams.set('phone_number', phone);
    if (limit) queryParams.set('limit', limit.toString());
    if (offset) queryParams.set('offset', offset.toString());

    const url = `${NYLAS_API_URL}/v3/grants/${grantId}/contacts?${queryParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
      },
    });

    return response.data.data || [];
  } catch (error: any) {
    throw new Error(
      `Failed to search contacts: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Get Contact
// ==========================================

/**
 * Get a specific contact by ID
 */
export async function getContact(grantId: string, contactId: string): Promise<Contact> {
  try {
    const response = await axios.get(
      `${NYLAS_API_URL}/v3/grants/${grantId}/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to get contact: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Create Contact
// ==========================================

/**
 * Create a new contact
 */
export async function createContact(params: CreateContactRequest): Promise<Contact> {
  const { grantId, ...contactData } = params;

  try {
    const response = await axios.post(
      `${NYLAS_API_URL}/v3/grants/${grantId}/contacts`,
      contactData,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to create contact: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Update Contact
// ==========================================

/**
 * Update an existing contact
 */
export async function updateContact(
  grantId: string,
  contactId: string,
  updates: Partial<CreateContactRequest>
): Promise<Contact> {
  try {
    const response = await axios.put(
      `${NYLAS_API_URL}/v3/grants/${grantId}/contacts/${contactId}`,
      updates,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to update contact: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Delete Contact
// ==========================================

/**
 * Delete a contact
 */
export async function deleteContact(grantId: string, contactId: string): Promise<void> {
  try {
    await axios.delete(
      `${NYLAS_API_URL}/v3/grants/${grantId}/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );
  } catch (error: any) {
    throw new Error(
      `Failed to delete contact: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// List All Contacts
// ==========================================

/**
 * List all contacts for a grant
 */
export async function listContacts(
  grantId: string,
  params: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<Contact[]> {
  const { limit = 50, offset = 0 } = params;

  try {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', limit.toString());
    queryParams.set('offset', offset.toString());

    const url = `${NYLAS_API_URL}/v3/grants/${grantId}/contacts?${queryParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
      },
    });

    return response.data.data || [];
  } catch (error: any) {
    throw new Error(
      `Failed to list contacts: ${error.response?.data?.message || error.message}`
    );
  }
}
