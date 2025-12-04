/**
 * Calendar Service for Nylas Microservice
 *
 * Thin wrapper around Nylas Calendar API
 * All business logic and database operations handled by main app
 */

import axios from 'axios';
import { config } from '../config.js';

const NYLAS_API_URL = config.nylas.apiUrl;

// ==========================================
// Type Definitions
// ==========================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  when: {
    start_time: number;
    end_time: number;
    start_timezone?: string;
    end_timezone?: string;
  };
  location?: string;
  participants?: Array<{
    email: string;
    name?: string;
    status?: 'yes' | 'no' | 'maybe' | 'noreply';
  }>;
  busy?: boolean;
  calendar_id?: string;
  conferencing?: any;
  reminders?: any;
  metadata?: Record<string, any>;
}

export interface FreeBusyResponse {
  email: string;
  time_slots: Array<{
    start_time: number;
    end_time: number;
    status: 'busy' | 'free';
    object?: string;
  }>;
}

export interface AvailabilityRequest {
  grantId: string;
  startTime: string;
  endTime: string;
  emails?: string[];
  duration?: number;
}

export interface CreateEventRequest {
  grantId: string;
  calendarId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  location?: string;
  participants?: Array<{
    email: string;
    name?: string;
  }>;
  busy?: boolean;
  conferencing?: any;
  reminders?: any;
  metadata?: Record<string, any>;
}

// ==========================================
// Calendar Availability
// ==========================================

/**
 * Get free/busy information for users
 * Uses Nylas Calendar API v3
 */
export async function getFreeBusy(params: AvailabilityRequest): Promise<FreeBusyResponse[]> {
  const { grantId, startTime, endTime, emails } = params;

  try {
    const response = await axios.post(
      `${NYLAS_API_URL}/v3/grants/${grantId}/calendar/free-busy`,
      {
        start_time: new Date(startTime).getTime() / 1000,
        end_time: new Date(endTime).getTime() / 1000,
        emails: emails || [],
      },
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    throw new Error(
      `Failed to get free/busy data: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Calendar Events
// ==========================================

/**
 * Create a calendar event
 */
export async function createEvent(params: CreateEventRequest): Promise<CalendarEvent> {
  const { grantId, calendarId, title, description, startTime, endTime, timezone, location, participants, busy, conferencing, reminders, metadata } = params;

  const eventData: any = {
    title,
    when: {
      start_time: Math.floor(new Date(startTime).getTime() / 1000),
      end_time: Math.floor(new Date(endTime).getTime() / 1000),
    },
  };

  if (timezone) {
    eventData.when.start_timezone = timezone;
    eventData.when.end_timezone = timezone;
  }

  if (description) eventData.description = description;
  if (location) eventData.location = location;
  if (busy !== undefined) eventData.busy = busy;
  if (conferencing) eventData.conferencing = conferencing;
  if (reminders) eventData.reminders = reminders;
  if (metadata) eventData.metadata = metadata;

  if (participants && participants.length > 0) {
    eventData.participants = participants.map(p => ({
      email: p.email,
      name: p.name,
    }));
  }

  try {
    const url = calendarId
      ? `${NYLAS_API_URL}/v3/grants/${grantId}/events?calendar_id=${calendarId}`
      : `${NYLAS_API_URL}/v3/grants/${grantId}/events`;

    const response = await axios.post(url, eventData, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to create event: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Get a specific event
 */
export async function getEvent(grantId: string, eventId: string): Promise<CalendarEvent> {
  try {
    const response = await axios.get(
      `${NYLAS_API_URL}/v3/grants/${grantId}/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to get event: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Update a calendar event
 */
export async function updateEvent(
  grantId: string,
  eventId: string,
  updates: Partial<CreateEventRequest>
): Promise<CalendarEvent> {
  const eventData: any = {};

  if (updates.title) eventData.title = updates.title;
  if (updates.description !== undefined) eventData.description = updates.description;
  if (updates.location !== undefined) eventData.location = updates.location;
  if (updates.busy !== undefined) eventData.busy = updates.busy;

  if (updates.startTime || updates.endTime) {
    eventData.when = {};
    if (updates.startTime) {
      eventData.when.start_time = Math.floor(new Date(updates.startTime).getTime() / 1000);
    }
    if (updates.endTime) {
      eventData.when.end_time = Math.floor(new Date(updates.endTime).getTime() / 1000);
    }
    if (updates.timezone) {
      eventData.when.start_timezone = updates.timezone;
      eventData.when.end_timezone = updates.timezone;
    }
  }

  if (updates.participants) {
    eventData.participants = updates.participants.map(p => ({
      email: p.email,
      name: p.name,
    }));
  }

  try {
    const response = await axios.put(
      `${NYLAS_API_URL}/v3/grants/${grantId}/events/${eventId}`,
      eventData,
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
      `Failed to update event: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(grantId: string, eventId: string): Promise<void> {
  try {
    await axios.delete(
      `${NYLAS_API_URL}/v3/grants/${grantId}/events/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );
  } catch (error: any) {
    throw new Error(
      `Failed to delete event: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * List calendar events
 */
export async function listEvents(
  grantId: string,
  params: {
    calendarId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }
): Promise<CalendarEvent[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.calendarId) queryParams.set('calendar_id', params.calendarId);
    if (params.startTime) queryParams.set('start', Math.floor(new Date(params.startTime).getTime() / 1000).toString());
    if (params.endTime) queryParams.set('end', Math.floor(new Date(params.endTime).getTime() / 1000).toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());

    const url = `${NYLAS_API_URL}/v3/grants/${grantId}/events?${queryParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
      },
    });

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to list events: ${error.response?.data?.message || error.message}`
    );
  }
}
