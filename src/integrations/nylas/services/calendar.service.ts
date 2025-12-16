/**
 * Nylas Calendar Service
 *
 * Handles calendar and event operations via V3 microservice proxy
 */

import axios from 'axios';
import { NylasCalendar, NylasEvent } from '../types';
import { resolveGrantId } from '../utils/grant-resolver';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

/**
 * Get calendars via V3 microservice
 */
export async function getCalendars(
  companyId: string,
  userEmail?: string,
): Promise<NylasCalendar[]> {
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS CALENDAR] Getting calendars via V3:', { grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/calendar/calendars`, {
      params: { grantId },
      timeout: 10000,
    });

    const calendars = response.data?.data || [];
    console.log('[NYLAS CALENDAR] Got calendars:', calendars.length);
    return calendars;
  } catch (error: any) {
    console.error('[NYLAS CALENDAR ERROR] getCalendars:', error.response?.data || error.message);
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

  console.log('[NYLAS CALENDAR] Getting events via V3:', { start, end, limit, calendarId });

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
    console.log('[NYLAS CALENDAR] Got events:', events.length);

    if (events.length > 0) {
      console.log('[NYLAS CALENDAR] First 3 events:');
      events.slice(0, 3).forEach((event: NylasEvent, i: number) => {
        const startTime = event.when?.start_time
          ? new Date(event.when.start_time * 1000).toISOString()
          : 'NO TIME';
        console.log(`[NYLAS CALENDAR]   ${i + 1}. "${event.title}" at ${startTime}`);
      });
    }

    return events;
  } catch (error: any) {
    console.error('[NYLAS CALENDAR ERROR] getCalendarEvents:', error.response?.data || error.message);
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

  console.log('[NYLAS CALENDAR] Creating event via V3:', {
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
    console.log('[NYLAS CALENDAR] Event created:', eventData?.id || 'NO ID', 'title:', eventData?.title || 'NO TITLE');
    return eventData;
  } catch (error: any) {
    console.error('[NYLAS CALENDAR ERROR] createCalendarEvent:', error.response?.data || error.message);
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

  console.log('[NYLAS CALENDAR] Getting event by ID via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

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
    console.error('[NYLAS CALENDAR ERROR] getEventById:', error.response?.data || error.message);
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

  console.log('[NYLAS CALENDAR] Updating event via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.put(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events/${eventId}`, updatePayload, {
      timeout: 15000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS CALENDAR ERROR] updateCalendarEvent:', error.response?.data || error.message);
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

  console.log('[NYLAS CALENDAR] Deleting event via V3:', { eventId, grantId: grantId.substring(0, 8) + '...' });

  try {
    await axios.delete(`${V3_SERVICE_URL}/api/v1/nylas/calendar/events/${eventId}`, {
      params: {
        grantId,
        calendarId: primaryCalendar?.id,
      },
      timeout: 10000,
    });
  } catch (error: any) {
    console.error('[NYLAS CALENDAR ERROR] deleteCalendarEvent:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to delete calendar event');
  }
}
