import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

const NYLAS_API_URL = 'https://api.us.nylas.com';

interface NylasEmailRecipient {
  email: string;
  name?: string;
}

interface NylasEmail {
  id: string;
  from: NylasEmailRecipient[];
  to: NylasEmailRecipient[];
  cc?: NylasEmailRecipient[];
  bcc?: NylasEmailRecipient[];
  subject: string;
  body: string;
  snippet: string;
  date: number;
  unread: boolean;
  thread_id: string;
}

interface NylasCalendar {
  id: string;
  name: string;
  is_primary: boolean;
}

interface NylasEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  when: {
    start_time: number;
    end_time: number;
  };
  participants?: NylasEmailRecipient[];
}

interface NylasGrant {
  id: string;
  provider: string;
  email: string;
}

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

    console.error('Nylas API Error:', {
      status,
      url,
      error: errorData,
    });

    throw new Error(errorMessage);
  }
}

// Email functions
export async function getEmails(
  companyId: string,
  options: { limit?: number; unread?: boolean } = {},
): Promise<NylasEmail[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const { limit = 10, unread } = options;
  let endpoint = `/v3/grants/${grantId}/messages?limit=${limit}`;

  if (unread) {
    endpoint += '&unread=true';
  }

  const response = await makeNylasRequest<{ data: NylasEmail[] }>(
    apiKey,
    endpoint,
  );
  return response.data || [];
}

export async function getEmailById(
  companyId: string,
  messageId: string,
): Promise<NylasEmail> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const endpoint = `/v3/grants/${grantId}/messages/${messageId}`;
  const response = await makeNylasRequest<{ data: NylasEmail } | NylasEmail>(
    apiKey,
    endpoint,
  );
  return 'data' in response ? response.data : response;
}

export async function sendEmail(
  companyId: string,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
  },
): Promise<{ id: string; thread_id: string }> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const { to, subject, body, cc, bcc } = params;
  const endpoint = `/v3/grants/${grantId}/messages/send`;

  const payload: any = {
    to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
    subject,
    body,
  };

  if (cc) {
    payload.cc = Array.isArray(cc)
      ? cc.map((email) => ({ email }))
      : [{ email: cc }];
  }

  if (bcc) {
    payload.bcc = Array.isArray(bcc)
      ? bcc.map((email) => ({ email }))
      : [{ email: bcc }];
  }

  return await makeNylasRequest(apiKey, endpoint, {
    method: 'POST',
    body: payload,
  });
}

// Calendar functions
export async function getCalendars(companyId: string): Promise<NylasCalendar[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const endpoint = `/v3/grants/${grantId}/calendars`;
  const response = await makeNylasRequest<{ data: NylasCalendar[] }>(
    apiKey,
    endpoint,
  );
  return response.data || [];
}

export async function getCalendarEvents(
  companyId: string,
  options: { start?: number; end?: number; limit?: number } = {},
): Promise<NylasEvent[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  // First, get the primary calendar
  const calendars = await getCalendars(companyId);

  if (calendars.length === 0) {
    return [];
  }

  // Use the primary calendar or the first calendar
  const primaryCalendar =
    calendars.find((cal) => cal.is_primary) || calendars[0];

  const { limit = 20, start, end } = options;
  let endpoint = `/v3/grants/${grantId}/events?calendar_id=${primaryCalendar.id}&limit=${limit}`;

  if (start) {
    endpoint += `&start=${start}`;
  }

  if (end) {
    endpoint += `&end=${end}`;
  }

  const response = await makeNylasRequest<{ data: NylasEvent[] }>(
    apiKey,
    endpoint,
  );
  return response.data || [];
}

export async function createCalendarEvent(
  companyId: string,
  params: {
    title: string;
    description?: string;
    startTime: string | number;
    endTime: string | number;
    participants?: string[];
    location?: string;
  },
): Promise<NylasEvent> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  // First, get the primary calendar
  const calendars = await getCalendars(companyId);

  if (calendars.length === 0) {
    throw new Error('No calendars found for this account');
  }

  // Use the primary calendar or the first calendar
  const primaryCalendar =
    calendars.find((cal) => cal.is_primary) || calendars[0];

  const { title, description, startTime, endTime, participants, location } =
    params;
  const endpoint = `/v3/grants/${grantId}/events?calendar_id=${primaryCalendar.id}`;

  // Convert timestamps to Unix timestamps if they're in ISO format
  const startTimestamp =
    typeof startTime === 'string'
      ? Math.floor(new Date(startTime).getTime() / 1000)
      : startTime;
  const endTimestamp =
    typeof endTime === 'string'
      ? Math.floor(new Date(endTime).getTime() / 1000)
      : endTime;

  const payload: any = {
    title,
    when: {
      start_time: startTimestamp,
      end_time: endTimestamp,
    },
  };

  if (description) {
    payload.description = description;
  }

  if (location) {
    payload.location = location;
  }

  if (participants && participants.length > 0) {
    payload.participants = participants.map((email) => ({
      email: typeof email === 'string' ? email : email,
      status: 'noreply',
    }));
  }

  const response = await makeNylasRequest<{ data: NylasEvent } | NylasEvent>(
    apiKey,
    endpoint,
    {
      method: 'POST',
      body: payload,
    },
  );
  return 'data' in response ? response.data : response;
}

// Get list of connected grants (accounts)
export async function getGrants(companyId: string): Promise<NylasGrant[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }

  const endpoint = '/v3/grants';
  const response = await makeNylasRequest<{ data: NylasGrant[] }>(
    apiKey,
    endpoint,
  );
  return response.data || [];
}

/**
 * Verify Nylas API key and grant ID by making a minimal test request
 */
export async function verifyNylasKeys(
  apiKey: string,
  grantId: string,
): Promise<boolean> {
  try {
    // Make a minimal request to verify the key
    await axios.get(`${NYLAS_API_URL}/v3/grants/${grantId}/messages?limit=1`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return true;
  } catch (error: any) {
    // 401 or 403 means invalid/unauthorized key
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return false;
    }
    console.error('Nylas key verification error:', error.message, status);
    return false;
  }
}
