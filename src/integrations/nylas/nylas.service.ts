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
export async function getCalendars(
  companyId: string,
): Promise<NylasCalendar[]> {
  console.log('[NYLAS DEBUG] getCalendars called for company:', companyId);
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  console.log(
    '[NYLAS DEBUG] API Key:',
    apiKey ? `${apiKey.substring(0, 15)}...` : 'NULL',
  );
  console.log(
    '[NYLAS DEBUG] Grant ID:',
    grantId ? `${grantId.substring(0, 15)}...` : 'NULL',
  );

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const endpoint = `/v3/grants/${grantId}/calendars`;
  console.log('[NYLAS DEBUG] Calling:', endpoint);
  const response = await makeNylasRequest<{ data: NylasCalendar[] }>(
    apiKey,
    endpoint,
  );
  console.log('[NYLAS DEBUG] Got calendars:', response.data?.length || 0);
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

  const { limit = 20, start: startOpt, end: endOpt } = options;
  let start = startOpt;
  let end = endOpt;

  // Default to past 7 days to next 30 days if no time range is specified
  if (!start && !end) {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60;
    const thirtyDaysLater = now + 30 * 24 * 60 * 60;
    start = sevenDaysAgo;
    end = thirtyDaysLater;
  }

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

  console.log('[NYLAS DEBUG] getCalendarEvents query:', {
    start,
    end,
    limit,
    calendar: primaryCalendar.id,
  });
  console.log(
    '[NYLAS DEBUG] getCalendarEvents returned:',
    response.data?.length || 0,
    'events',
  );
  if (response.data && response.data.length > 0) {
    console.log('[NYLAS DEBUG] First 3 events:');
    response.data.slice(0, 3).forEach((event, i) => {
      const startTime = event.when?.start_time
        ? new Date(event.when.start_time * 1000).toISOString()
        : 'NO TIME';
      console.log(`[NYLAS DEBUG]   ${i + 1}. "${event.title}" at ${startTime}`);
    });
  }

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

  console.log('[NYLAS DEBUG] Creating event:', {
    title,
    calendar: primaryCalendar.id,
    start: startTimestamp,
    end: endTimestamp,
  });
  const response = await makeNylasRequest<{ data: NylasEvent } | NylasEvent>(
    apiKey,
    endpoint,
    {
      method: 'POST',
      body: payload,
    },
  );
  const eventData = 'data' in response ? response.data : response;
  console.log(
    '[NYLAS DEBUG] Event created:',
    eventData?.id || 'NO ID',
    'title:',
    eventData?.title || 'NO TITLE',
  );
  return eventData;
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

// ==========================================
// ADVANCED CALENDAR MANAGEMENT
// ==========================================

/**
 * Get a specific calendar event by ID
 */
export async function getEventById(
  companyId: string,
  eventId: string,
): Promise<NylasEvent> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const endpoint = `/v3/grants/${grantId}/events/${eventId}`;
  const response = await makeNylasRequest<{ data: NylasEvent } | NylasEvent>(
    apiKey,
    endpoint,
  );
  return 'data' in response ? response.data : response;
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  companyId: string,
  eventId: string,
  params: {
    title?: string;
    description?: string;
    startTime?: string | number;
    endTime?: string | number;
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

  // Get the event first to determine calendar ID
  const existingEvent = await getEventById(companyId, eventId);
  const calendars = await getCalendars(companyId);
  const primaryCalendar =
    calendars.find((cal) => cal.is_primary) || calendars[0];

  const endpoint = `/v3/grants/${grantId}/events/${eventId}?calendar_id=${primaryCalendar.id}`;

  const { title, description, startTime, endTime, participants, location } =
    params;
  const payload: any = {};

  // Only include fields that are being updated
  if (title !== undefined) {
    payload.title = title;
  }

  if (description !== undefined) {
    payload.description = description;
  }

  if (location !== undefined) {
    payload.location = location;
  }

  if (startTime !== undefined && endTime !== undefined) {
    const startTimestamp =
      typeof startTime === 'string'
        ? Math.floor(new Date(startTime).getTime() / 1000)
        : startTime;
    const endTimestamp =
      typeof endTime === 'string'
        ? Math.floor(new Date(endTime).getTime() / 1000)
        : endTime;

    payload.when = {
      start_time: startTimestamp,
      end_time: endTimestamp,
    };
  }

  if (participants !== undefined) {
    payload.participants = participants.map((email) => ({
      email: typeof email === 'string' ? email : email,
      status: 'noreply',
    }));
  }

  const response = await makeNylasRequest<{ data: NylasEvent } | NylasEvent>(
    apiKey,
    endpoint,
    {
      method: 'PUT',
      body: payload,
    },
  );
  return 'data' in response ? response.data : response;
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  companyId: string,
  eventId: string,
): Promise<void> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  // Get calendars to find primary calendar ID
  const calendars = await getCalendars(companyId);
  const primaryCalendar =
    calendars.find((cal) => cal.is_primary) || calendars[0];

  const endpoint = `/v3/grants/${grantId}/events/${eventId}?calendar_id=${primaryCalendar.id}`;
  await makeNylasRequest(apiKey, endpoint, {
    method: 'DELETE',
  });
}

// ==========================================
// AVAILABILITY & SMART SCHEDULING
// ==========================================

interface FreeBusySlot {
  start_time: number;
  end_time: number;
  status: 'busy' | 'free';
}

interface FreeBusyData {
  email: string;
  timeSlots: FreeBusySlot[];
}

interface AvailableSlot {
  start_time: number;
  end_time: number;
  score: number; // Quality score (0-100)
  reason: string; // Why this slot is good/bad
}

/**
 * Get free/busy information for participants
 */
export async function getFreeBusy(
  companyId: string,
  emails: string[],
  startTime: number,
  endTime: number,
): Promise<FreeBusyData[]> {
  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  const endpoint = `/v3/grants/${grantId}/calendars/free-busy`;
  const payload = {
    emails: emails,
    start_time: startTime,
    end_time: endTime,
  };

  const response = await makeNylasRequest<any>(apiKey, endpoint, {
    method: 'POST',
    body: payload,
  });

  // Transform response to our format
  const freeBusyData: FreeBusyData[] = [];

  for (const email of emails) {
    const emailData = response[email] || [];
    freeBusyData.push({
      email,
      timeSlots: emailData.map((slot: any) => ({
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: slot.status || 'free',
      })),
    });
  }

  return freeBusyData;
}

/**
 * Find available time slots with intelligent ranking
 */
export async function findAvailableSlots(
  companyId: string,
  params: {
    durationMinutes: number;
    dateRangeStart: number;
    dateRangeEnd: number;
    preferredTimeStart?: string; // "09:00"
    preferredTimeEnd?: string; // "17:00"
    participants?: string[];
    bufferMinutes?: number;
  },
): Promise<AvailableSlot[]> {
  const {
    durationMinutes,
    dateRangeStart,
    dateRangeEnd,
    preferredTimeStart = '09:00',
    preferredTimeEnd = '17:00',
    participants = [],
    bufferMinutes = 15,
  } = params;

  const apiKey = await getApiKey(companyId, 'nylas_api_key');
  const grantId = await getApiKey(companyId, 'nylas_grant_id');

  if (!apiKey) {
    throw new Error('Nylas API key not found');
  }
  if (!grantId) {
    throw new Error('Nylas Grant ID not found');
  }

  // Get existing events in the range
  const events = await getCalendarEvents(companyId, {
    start: dateRangeStart,
    end: dateRangeEnd,
    limit: 100,
  });

  // Get free/busy for participants if provided
  const participantBusySlots: FreeBusySlot[] = [];
  if (participants.length > 0) {
    const freeBusyData = await getFreeBusy(
      companyId,
      participants,
      dateRangeStart,
      dateRangeEnd,
    );

    // Merge all busy slots from participants
    freeBusyData.forEach((data) => {
      participantBusySlots.push(
        ...data.timeSlots.filter((slot) => slot.status === 'busy'),
      );
    });
  }

  // Parse preferred times
  const [prefStartHour, prefStartMin] = preferredTimeStart
    .split(':')
    .map(Number);
  const [prefEndHour, prefEndMin] = preferredTimeEnd.split(':').map(Number);

  // Generate candidate slots
  const candidateSlots: AvailableSlot[] = [];
  const durationSeconds = durationMinutes * 60;
  const bufferSeconds = bufferMinutes * 60;

  // Iterate through each day in the range
  let currentDay = Math.floor(dateRangeStart / 86400) * 86400; // Start of day
  const endDay = Math.floor(dateRangeEnd / 86400) * 86400;

  while (currentDay <= endDay) {
    const dayStart = currentDay + prefStartHour * 3600 + prefStartMin * 60;
    const dayEnd = currentDay + prefEndHour * 3600 + prefEndMin * 60;

    // Try slots every 30 minutes within work hours
    for (
      let slotStart = dayStart;
      slotStart + durationSeconds <= dayEnd;
      slotStart += 1800
    ) {
      const slotEnd = slotStart + durationSeconds;

      // Check if this slot conflicts with existing events
      const hasConflict = events.some((event) => {
        const eventStart = event.when.start_time - bufferSeconds;
        const eventEnd = event.when.end_time + bufferSeconds;
        return !(slotEnd <= eventStart || slotStart >= eventEnd);
      });

      // Check participant availability
      const participantConflict = participantBusySlots.some((slot) => {
        return !(slotEnd <= slot.start_time || slotStart >= slot.end_time);
      });

      if (!hasConflict && !participantConflict) {
        // Calculate quality score
        const score = calculateSlotScore(
          slotStart,
          slotEnd,
          events,
          prefStartHour,
          prefEndHour,
        );

        candidateSlots.push({
          start_time: slotStart,
          end_time: slotEnd,
          score,
          reason: generateSlotReason(score, slotStart, events),
        });
      }
    }

    currentDay += 86400; // Next day
  }

  // Sort by score (highest first) and return top 10
  return candidateSlots.sort((a, b) => b.score - a.score).slice(0, 10);
}

/**
 * Calculate quality score for a time slot (0-100)
 */
function calculateSlotScore(
  slotStart: number,
  slotEnd: number,
  events: NylasEvent[],
  preferredStartHour: number,
  preferredEndHour: number,
): number {
  let score = 50; // Base score

  const slotDate = new Date(slotStart * 1000);
  const hour = slotDate.getUTCHours();

  // Time of day preference (max +30)
  if (hour >= 9 && hour < 12) {
    score += 30; // Morning prime time
  } else if (hour >= 13 && hour < 15) {
    score += 20; // Early afternoon
  } else if (hour >= 15 && hour < 17) {
    score += 10; // Late afternoon
  }

  // Check spacing from other events (max +20)
  let minGapBefore = Infinity;
  let minGapAfter = Infinity;

  events.forEach((event) => {
    if (event.when.end_time <= slotStart) {
      const gap = slotStart - event.when.end_time;
      minGapBefore = Math.min(minGapBefore, gap);
    }
    if (event.when.start_time >= slotEnd) {
      const gap = event.when.start_time - slotEnd;
      minGapAfter = Math.min(minGapAfter, gap);
    }
  });

  // Reward good spacing
  const minGap = Math.min(minGapBefore, minGapAfter);
  if (minGap > 3600) {
    score += 20; // 1+ hour gap
  } else if (minGap > 1800) {
    score += 10; // 30+ min gap
  }

  // Day of week preference (max +10)
  const dayOfWeek = slotDate.getUTCDay();
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    score += 10; // Tue-Thu preferred
  } else if (dayOfWeek === 5) {
    score += 5; // Friday okay
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Generate human-readable reason for slot score
 */
function generateSlotReason(
  score: number,
  slotStart: number,
  events: NylasEvent[],
): string {
  const slotDate = new Date(slotStart * 1000);
  const hour = slotDate.getUTCHours();
  const dayOfWeek = slotDate.getUTCDay();

  const reasons: string[] = [];

  if (hour >= 9 && hour < 12) {
    reasons.push('optimal morning time');
  } else if (hour >= 13 && hour < 15) {
    reasons.push('good afternoon slot');
  }

  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    reasons.push('mid-week');
  }

  if (score >= 80) {
    return `Excellent slot: ${reasons.join(', ')}`;
  } else if (score >= 60) {
    return `Good slot: ${reasons.join(', ')}`;
  } else {
    return `Available: ${reasons.join(', ') || 'outside preferred hours'}`;
  }
}

// ==========================================
// BATCH OPERATIONS
// ==========================================

interface BatchEventCreate {
  title: string;
  description?: string;
  startTime: string | number;
  endTime: string | number;
  participants?: string[];
  location?: string;
}

interface BatchCreateResult {
  success: boolean;
  created: NylasEvent[];
  failed: Array<{ event: BatchEventCreate; error: string }>;
}

/**
 * Create multiple calendar events in batch
 */
export async function createMultipleEvents(
  companyId: string,
  events: BatchEventCreate[],
): Promise<BatchCreateResult> {
  const created: NylasEvent[] = [];
  const failed: Array<{ event: BatchEventCreate; error: string }> = [];

  for (const event of events) {
    try {
      const createdEvent = await createCalendarEvent(companyId, {
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        participants: event.participants,
        location: event.location,
      });
      created.push(createdEvent);
    } catch (error: any) {
      failed.push({
        event,
        error: error.message || 'Unknown error',
      });
    }
  }

  return {
    success: failed.length === 0,
    created,
    failed,
  };
}

// ==========================================
// CONFLICT DETECTION
// ==========================================

interface ConflictCheck {
  hasConflict: boolean;
  conflicts: NylasEvent[];
  alternativeSlots?: AvailableSlot[];
}

/**
 * Check if a proposed time conflicts with existing events
 */
export async function checkEventConflicts(
  companyId: string,
  startTime: number,
  endTime: number,
  participants?: string[],
): Promise<ConflictCheck> {
  // Get events in the proposed time range (with some buffer)
  const bufferTime = 3600; // 1 hour buffer
  const events = await getCalendarEvents(companyId, {
    start: startTime - bufferTime,
    end: endTime + bufferTime,
    limit: 100,
  });

  // Check for direct conflicts
  const conflicts = events.filter((event) => {
    return !(
      endTime <= event.when.start_time || startTime >= event.when.end_time
    );
  });

  const hasConflict = conflicts.length > 0;

  // If there's a conflict, find alternative slots
  let alternativeSlots: AvailableSlot[] | undefined;

  if (hasConflict) {
    const duration = (endTime - startTime) / 60; // Convert to minutes

    // Search for alternatives in the next 7 days
    const searchEnd = startTime + 7 * 86400;

    alternativeSlots = await findAvailableSlots(companyId, {
      durationMinutes: duration,
      dateRangeStart: startTime,
      dateRangeEnd: searchEnd,
      participants: participants || [],
    });
  }

  return {
    hasConflict,
    conflicts,
    alternativeSlots,
  };
}
