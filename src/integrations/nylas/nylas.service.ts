/**
 * Nylas Service - V3 Microservice Proxy
 *
 * All operations are proxied through the V3 GCP microservice
 * which handles direct Nylas API communication.
 */

import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

// ==========================================
// Interfaces
// ==========================================

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

// ==========================================
// Helper Functions
// ==========================================

/**
 * Resolve grant ID for a specific user email by calling V3 microservice
 * Falls back to company default, then to V3's default grant
 */
async function resolveGrantId(companyId: string, userEmail?: string): Promise<string> {
  // If userEmail provided, try to get user-specific grant from V3
  if (userEmail) {
    try {
      const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/grants/by-email`, {
        params: { email: userEmail.toLowerCase() },
        timeout: 15000, // Increased for Cloud Run cold start
      });

      if (response.data?.grantId) {
        console.log(`[nylas-service] Resolved grant for ${userEmail}: ${response.data.grantId.substring(0, 8)}...`);
        return response.data.grantId;
      }
    } catch (error: any) {
      console.warn(`[nylas-service] Could not resolve grant for ${userEmail}, falling back to company default:`, error.message);
    }
  }

  // Try company default grant
  const companyGrantId = await getApiKey(companyId, 'nylas_grant_id');
  if (companyGrantId) {
    console.log(`[nylas-service] Using company default grant: ${companyGrantId.substring(0, 8)}...`);
    return companyGrantId;
  }

  // Fall back to V3's default grant (NYLAS_GRANT_ID secret)
  // This calls V3 without a grantId, which will use V3's env default
  console.log('[nylas-service] No company grant found, using V3 default grant');

  // V3 will use its default grant when grantId is not provided
  // Return empty string to indicate "use V3 default"
  return '';
}

// ==========================================
// Email Functions
// ==========================================

/**
 * Get emails via V3 microservice
 */
export async function getEmails(
  companyId: string,
  options: { limit?: number; unread?: boolean; userEmail?: string } = {},
): Promise<NylasEmail[]> {
  const { limit = 10, unread, userEmail } = options;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS] Getting emails via V3:', { limit, unread, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/email/messages`, {
      params: {
        grantId,
        limit,
        ...(unread !== undefined && { unread }),
      },
      timeout: 15000,
    });

    return response.data?.data || [];
  } catch (error: any) {
    console.error('[NYLAS ERROR] getEmails:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get emails');
  }
}

/**
 * Get single email by ID via V3 microservice
 */
export async function getEmailById(
  companyId: string,
  messageId: string,
  userEmail?: string,
): Promise<NylasEmail> {
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS] Getting email by ID via V3:', { messageId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/email/messages/${messageId}`, {
      params: { grantId },
      timeout: 10000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS ERROR] getEmailById:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get email');
  }
}

/**
 * Send email via V3 microservice
 */
export async function sendEmail(
  companyId: string,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    userEmail?: string;
  },
): Promise<{ id: string; thread_id: string }> {
  const { to, subject, body, cc, bcc, userEmail } = params;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS] Sending email via V3:', { to, subject, grantId: grantId.substring(0, 8) + '...' });

  // Format recipients
  const toRecipients = Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }];
  const ccRecipients = cc ? (Array.isArray(cc) ? cc.map((email) => ({ email })) : [{ email: cc }]) : undefined;
  const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc.map((email) => ({ email })) : [{ email: bcc }]) : undefined;

  try {
    const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/email/messages/send`, {
      grantId,
      to: toRecipients,
      subject,
      body,
      cc: ccRecipients,
      bcc: bccRecipients,
    }, {
      timeout: 30000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS ERROR] sendEmail:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to send email');
  }
}

// ==========================================
// Calendar Functions
// ==========================================

/**
 * Get calendars via V3 microservice
 */
export async function getCalendars(
  companyId: string,
  userEmail?: string,
): Promise<NylasCalendar[]> {
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS DEBUG] getCalendars via V3:', { grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/calendar/calendars`, {
      params: { grantId },
      timeout: 10000,
    });

    const calendars = response.data?.data || [];
    console.log('[NYLAS DEBUG] Got calendars:', calendars.length);
    return calendars;
  } catch (error: any) {
    console.error('[NYLAS ERROR] getCalendars:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get calendars');
  }
}

/**
 * Get calendar events via V3 microservice
 */
export async function getCalendarEvents(
  companyId: string,
  options: { start?: number; end?: number; limit?: number; userEmail?: string; calendarId?: string } = {},
): Promise<NylasEvent[]> {
  const { userEmail, calendarId: providedCalendarId } = options;
  const grantId = await resolveGrantId(companyId, userEmail);

  // Get calendar ID if not provided
  let calendarId = providedCalendarId;
  if (!calendarId) {
    const calendars = await getCalendars(companyId, userEmail);
    if (calendars.length === 0) {
      return [];
    }
    const primaryCalendar = calendars.find((cal) => cal.is_primary) || calendars[0];
    calendarId = primaryCalendar.id;
  }

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

  console.log('[NYLAS DEBUG] getCalendarEvents via V3:', { start, end, limit, calendarId });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events`, {
      params: {
        grantId,
        calendarId,
        limit,
        start,
        end,
      },
      timeout: 15000,
    });

    const events = response.data?.data || [];
    console.log('[NYLAS DEBUG] getCalendarEvents returned:', events.length, 'events');

    if (events.length > 0) {
      console.log('[NYLAS DEBUG] First 3 events:');
      events.slice(0, 3).forEach((event: NylasEvent, i: number) => {
        const startTime = event.when?.start_time
          ? new Date(event.when.start_time * 1000).toISOString()
          : 'NO TIME';
        console.log(`[NYLAS DEBUG]   ${i + 1}. "${event.title}" at ${startTime}`);
      });
    }

    return events;
  } catch (error: any) {
    console.error('[NYLAS ERROR] getCalendarEvents:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get calendar events');
  }
}

/**
 * Create calendar event via V3 microservice
 */
export async function createCalendarEvent(
  companyId: string,
  params: {
    title: string;
    description?: string;
    startTime: string | number;
    endTime: string | number;
    participants?: string[];
    location?: string;
    userEmail?: string;
  },
): Promise<NylasEvent> {
  const { userEmail } = params;
  const grantId = await resolveGrantId(companyId, userEmail);

  // Get primary calendar
  const calendars = await getCalendars(companyId, userEmail);
  if (calendars.length === 0) {
    throw new Error('No calendars found for this account');
  }
  const primaryCalendar = calendars.find((cal) => cal.is_primary) || calendars[0];

  const { title, description, startTime, endTime, participants, location } = params;

  // Convert timestamps to Unix timestamps if they're in ISO format
  const startTimestamp = typeof startTime === 'string'
    ? Math.floor(new Date(startTime).getTime() / 1000)
    : startTime;
  const endTimestamp = typeof endTime === 'string'
    ? Math.floor(new Date(endTime).getTime() / 1000)
    : endTime;

  console.log('[NYLAS DEBUG] Creating event via V3:', {
    title,
    calendar: primaryCalendar.id,
    start: startTimestamp,
    end: endTimestamp,
  });

  try {
    const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events`, {
      grantId,
      calendarId: primaryCalendar.id,
      title,
      description,
      when: {
        startTime: startTimestamp,
        endTime: endTimestamp,
      },
      location,
      participants: participants?.map((email) => ({
        email: typeof email === 'string' ? email : email,
        status: 'noreply',
      })),
    }, {
      timeout: 15000,
    });

    const eventData = response.data?.data || response.data;
    console.log('[NYLAS DEBUG] Event created:', eventData?.id || 'NO ID', 'title:', eventData?.title || 'NO TITLE');
    return eventData;
  } catch (error: any) {
    console.error('[NYLAS ERROR] createCalendarEvent:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to create calendar event');
  }
}

/**
 * Get a specific calendar event by ID via V3 microservice
 */
export async function getEventById(
  companyId: string,
  eventId: string,
  userEmail?: string,
): Promise<NylasEvent> {
  const grantId = await resolveGrantId(companyId, userEmail);

  // Get primary calendar for the query
  const calendars = await getCalendars(companyId, userEmail);
  const primaryCalendar = calendars.find((cal) => cal.is_primary) || calendars[0];

  console.log('[NYLAS] Getting event by ID via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events/${eventId}`, {
      params: {
        grantId,
        calendarId: primaryCalendar?.id,
      },
      timeout: 10000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS ERROR] getEventById:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get event');
  }
}

/**
 * Update an existing calendar event via V3 microservice
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
    userEmail?: string;
  },
): Promise<NylasEvent> {
  const { userEmail } = params;
  const grantId = await resolveGrantId(companyId, userEmail);

  // Get primary calendar
  const calendars = await getCalendars(companyId, userEmail);
  const primaryCalendar = calendars.find((cal) => cal.is_primary) || calendars[0];

  const { title, description, startTime, endTime, participants, location } = params;

  const updatePayload: any = { grantId, calendarId: primaryCalendar?.id };

  if (title !== undefined) updatePayload.title = title;
  if (description !== undefined) updatePayload.description = description;
  if (location !== undefined) updatePayload.location = location;

  if (startTime !== undefined && endTime !== undefined) {
    const startTimestamp = typeof startTime === 'string'
      ? Math.floor(new Date(startTime).getTime() / 1000)
      : startTime;
    const endTimestamp = typeof endTime === 'string'
      ? Math.floor(new Date(endTime).getTime() / 1000)
      : endTime;
    updatePayload.when = {
      startTime: startTimestamp,
      endTime: endTimestamp,
    };
  }

  if (participants !== undefined) {
    updatePayload.participants = participants.map((email) => ({
      email: typeof email === 'string' ? email : email,
      status: 'noreply',
    }));
  }

  console.log('[NYLAS] Updating event via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.put(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events/${eventId}`, updatePayload, {
      timeout: 15000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS ERROR] updateCalendarEvent:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to update calendar event');
  }
}

/**
 * Delete a calendar event via V3 microservice
 */
export async function deleteCalendarEvent(
  companyId: string,
  eventId: string,
  userEmail?: string,
): Promise<void> {
  const grantId = await resolveGrantId(companyId, userEmail);

  // Get primary calendar
  const calendars = await getCalendars(companyId, userEmail);
  const primaryCalendar = calendars.find((cal) => cal.is_primary) || calendars[0];

  console.log('[NYLAS] Deleting event via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

  try {
    await axios.delete(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events/${eventId}`, {
      params: {
        grantId,
        calendarId: primaryCalendar?.id,
      },
      timeout: 10000,
    });
  } catch (error: any) {
    console.error('[NYLAS ERROR] deleteCalendarEvent:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to delete calendar event');
  }
}

// ==========================================
// Availability & Scheduling
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
  score: number;
  reason: string;
}

/**
 * Get free/busy information via V3 microservice
 */
export async function getFreeBusy(
  companyId: string,
  emails: string[],
  startTime: number,
  endTime: number,
  userEmail?: string,
): Promise<FreeBusyData[]> {
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS] Getting free/busy via V3:', { emails, startTime, endTime, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/calendar/free-busy`, {
      grantId,
      emails,
      startTime,
      endTime,
    }, {
      timeout: 15000,
    });

    // Transform response to our format
    const responseData = response.data?.data || response.data;
    const freeBusyData: FreeBusyData[] = [];

    for (const email of emails) {
      const emailData = responseData?.[email] || [];
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
  } catch (error: any) {
    console.error('[NYLAS ERROR] getFreeBusy:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get free/busy information');
  }
}

/**
 * Find available time slots with intelligent ranking
 * This uses internal logic based on getCalendarEvents and getFreeBusy
 */
export async function findAvailableSlots(
  companyId: string,
  params: {
    durationMinutes: number;
    dateRangeStart: number;
    dateRangeEnd: number;
    preferredTimeStart?: string;
    preferredTimeEnd?: string;
    participants?: string[];
    bufferMinutes?: number;
    userEmail?: string;
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
    userEmail,
  } = params;

  // Get existing events in the range
  const events = await getCalendarEvents(companyId, {
    userEmail,
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
      userEmail,
    );

    freeBusyData.forEach((data) => {
      participantBusySlots.push(
        ...data.timeSlots.filter((slot) => slot.status === 'busy'),
      );
    });
  }

  // Parse preferred times
  const [prefStartHour, prefStartMin] = preferredTimeStart.split(':').map(Number);
  const [prefEndHour, prefEndMin] = preferredTimeEnd.split(':').map(Number);

  // Generate candidate slots
  const candidateSlots: AvailableSlot[] = [];
  const durationSeconds = durationMinutes * 60;
  const bufferSeconds = bufferMinutes * 60;

  // Iterate through each day in the range
  let currentDay = Math.floor(dateRangeStart / 86400) * 86400;
  const endDay = Math.floor(dateRangeEnd / 86400) * 86400;

  while (currentDay <= endDay) {
    const dayStart = currentDay + prefStartHour * 3600 + prefStartMin * 60;
    const dayEnd = currentDay + prefEndHour * 3600 + prefEndMin * 60;

    // Try slots every 30 minutes within work hours
    for (let slotStart = dayStart; slotStart + durationSeconds <= dayEnd; slotStart += 1800) {
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
        const score = calculateSlotScore(slotStart, slotEnd, events, prefStartHour, prefEndHour);
        candidateSlots.push({
          start_time: slotStart,
          end_time: slotEnd,
          score,
          reason: generateSlotReason(score, slotStart, events),
        });
      }
    }

    currentDay += 86400;
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
  let score = 50;

  const slotDate = new Date(slotStart * 1000);
  const hour = slotDate.getUTCHours();

  // Time of day preference (max +30)
  if (hour >= 9 && hour < 12) {
    score += 30;
  } else if (hour >= 13 && hour < 15) {
    score += 20;
  } else if (hour >= 15 && hour < 17) {
    score += 10;
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

  const minGap = Math.min(minGapBefore, minGapAfter);
  if (minGap > 3600) {
    score += 20;
  } else if (minGap > 1800) {
    score += 10;
  }

  // Day of week preference (max +10)
  const dayOfWeek = slotDate.getUTCDay();
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    score += 10;
  } else if (dayOfWeek === 5) {
    score += 5;
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
// Batch Operations
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
// Conflict Detection
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
  userEmail?: string,
): Promise<ConflictCheck> {
  // Get events in the proposed time range (with some buffer)
  const bufferTime = 3600;
  const events = await getCalendarEvents(companyId, {
    start: startTime - bufferTime,
    end: endTime + bufferTime,
    limit: 100,
    userEmail,
  });

  // Check for direct conflicts
  const conflicts = events.filter((event) => {
    return !(endTime <= event.when.start_time || startTime >= event.when.end_time);
  });

  const hasConflict = conflicts.length > 0;

  // If there's a conflict, find alternative slots
  let alternativeSlots: AvailableSlot[] | undefined;

  if (hasConflict) {
    const duration = (endTime - startTime) / 60;
    const searchEnd = startTime + 7 * 86400;

    alternativeSlots = await findAvailableSlots(companyId, {
      durationMinutes: duration,
      dateRangeStart: startTime,
      dateRangeEnd: searchEnd,
      participants: participants || [],
      userEmail,
    });
  }

  return {
    hasConflict,
    conflicts,
    alternativeSlots,
  };
}
