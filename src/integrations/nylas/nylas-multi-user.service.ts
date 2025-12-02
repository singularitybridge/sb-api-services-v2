/**
 * Nylas Multi-User Service
 *
 * Grant-based Nylas API functions for multi-user orchestration
 * Parallel to nylas.service.ts but works with grantId directly
 */

import axios from 'axios';

const NYLAS_API_URL = 'https://api.us.nylas.com';

// ==========================================
// Types
// ==========================================

export interface NylasEventMultiUser {
  id: string;
  title: string;
  description?: string;
  location?: string;
  when: {
    start_time: number;
    end_time: number;
  };
  participants?: {
    name?: string;
    email: string;
    status?: 'noreply' | 'yes' | 'no' | 'maybe';
  }[];
  status?: string;
  conferencing?: {
    provider?: string;
    details?: {
      url?: string;
      meeting_code?: string;
      phone?: string[];
    };
  };
  html_link?: string;
  calendar_id?: string;
  ical_uid?: string;
}

export interface CreateEventParams {
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  when: {
    start_time: number;
    end_time: number;
    timezone?: string;
  };
  participants?: {
    name?: string;
    email: string;
    status?: 'noreply' | 'yes' | 'no' | 'maybe';
  }[];
  recurrence?: string[];
  conferencing?: {
    provider?: 'google_meet' | 'zoom' | 'teams';
    autocreate?: Record<string, any>;
    details?: {
      url?: string;
      meeting_code?: string;
      phone?: string[];
    };
  };
}

// ==========================================
// API Key Helper
// ==========================================

const getApiKey = async (): Promise<string> => {
  // For now, use environment variable
  // In production, this should fetch from database per company
  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) {
    throw new Error('NYLAS_API_KEY not configured');
  }
  return apiKey;
};

// ==========================================
// Get Calendar Events for Grant
// ==========================================

export const getCalendarEventsForGrant = async (
  grantId: string,
  options: {
    calendarId?: string;
    start?: number;
    end?: number;
    limit?: number;
  } = {}
): Promise<NylasEventMultiUser[]> => {
  const apiKey = await getApiKey();
  const { calendarId = 'primary', start, end, limit = 100 } = options;

  let url = `${NYLAS_API_URL}/v3/grants/${grantId}/events?calendar_id=${calendarId}&limit=${limit}`;

  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data || [];
  } catch (error: any) {
    console.error(`[NYLAS MULTI-USER] Error fetching events for grant ${grantId}:`, error.message);
    return [];
  }
};

// ==========================================
// Create Calendar Event for Grant
// ==========================================

export const createCalendarEventForGrant = async (
  grantId: string,
  params: CreateEventParams
): Promise<NylasEventMultiUser> => {
  const apiKey = await getApiKey();
  const { calendarId, ...eventData } = params;

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events?calendar_id=${calendarId}`;

  try {
    const response = await axios.post(url, eventData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`[NYLAS MULTI-USER] Error creating event for grant ${grantId}:`, error.message);
    throw error;
  }
};

// ==========================================
// Update Calendar Event for Grant
// ==========================================

export const updateCalendarEventForGrant = async (
  grantId: string,
  eventId: string,
  params: Partial<CreateEventParams>
): Promise<NylasEventMultiUser> => {
  const apiKey = await getApiKey();
  const { calendarId, ...eventData } = params;

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events/${eventId}${calendarId ? `?calendar_id=${calendarId}` : ''}`;

  try {
    const response = await axios.put(url, eventData, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`[NYLAS MULTI-USER] Error updating event ${eventId} for grant ${grantId}:`, error.message);
    throw error;
  }
};

// ==========================================
// Delete Calendar Event for Grant
// ==========================================

export const deleteCalendarEventForGrant = async (
  grantId: string,
  eventId: string,
  calendarId = 'primary'
): Promise<void> => {
  const apiKey = await getApiKey();

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events/${eventId}?calendar_id=${calendarId}`;

  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error(`[NYLAS MULTI-USER] Error deleting event ${eventId} for grant ${grantId}:`, error.message);
    throw error;
  }
};

// ==========================================
// Send Email for Grant
// ==========================================

export interface SendEmailParams {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  body: string;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  replyTo?: Array<{ email: string; name?: string }>;
}

export const sendEmailForGrant = async (
  grantId: string,
  params: SendEmailParams
): Promise<any> => {
  const apiKey = await getApiKey();

  const url = `${NYLAS_API_URL}/v3/grants/${grantId}/messages/send`;

  try {
    const response = await axios.post(url, params, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data;
  } catch (error: any) {
    console.error(`[NYLAS MULTI-USER] Error sending email for grant ${grantId}:`, error.message);
    throw error;
  }
};
