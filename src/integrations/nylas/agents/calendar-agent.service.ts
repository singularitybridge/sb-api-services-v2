/**
 * Calendar Agent - Nylas Calendar/Events/Availability API Operations
 *
 * Handles ALL Nylas Calendar API operations with multi-grant support.
 * Part of the three-agent architecture (Contacts, Calendar, Email).
 *
 * Responsibilities:
 * - Multi-user availability checking (15+ participants)
 * - Calendar event creation/update/deletion
 * - Interval algebra for free/busy calculations
 * - Cache-first queries with 24-hour TTL + real-time webhooks
 */

import {
  getCompanyWideAvailability,
  findUserGrantOrThrow,
} from '../../../services/company-calendar.service';
import {
  createCalendarEventForGrant,
  updateCalendarEventForGrant,
  deleteCalendarEventForGrant,
  NylasEventMultiUser,
  CreateEventParams,
} from '../nylas-multi-user.service';
import { NylasEventCache } from '../../../models/NylasEventCache';

// ==========================================
// Types & Interfaces
// ==========================================

export interface TimeSlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
  available_participants: string[]; // emails
  all_available: boolean; // true if ALL participants free
}

export interface MeetingPayload {
  meeting_id: string;
  subject: string;
  description?: string;
  company_id: string;
  organizer: {
    name: string;
    email: string;
    user_id?: string;
  };
  participants: Array<{
    contact_id?: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    status?: 'pending' | 'accepted' | 'declined';
  }>;
  time: {
    start: string;
    end: string;
    timezone: string;
    duration_minutes?: number;
  };
  location: {
    type: 'physical' | 'video' | 'phone';
    provider?: 'zoom' | 'google_meet' | 'teams' | 'custom';
    join_url?: string;
    physical_address?: string;
    dial_in?: string;
  };
  calendar?: {
    calendar_event_id?: string;
    calendar_html_link?: string;
    calendar_id?: string;
    ical_uid?: string;
  };
  email?: {
    message_id?: string;
    thread_id?: string;
    sent_at?: string;
  };
  meta: {
    source: string;
    language: string;
    created_at: string;
    updated_at: string;
    status: 'draft' | 'scheduled' | 'sent' | 'confirmed' | 'cancelled';
  };
}

// ==========================================
// Availability Checking
// ==========================================

/**
 * Check availability for multiple users (company-wide)
 *
 * @param params - Availability check parameters
 * @returns Array of time slots where ALL participants are available
 */
export const checkAvailabilityForUsers = async (params: {
  companyId: string;
  userEmails: string[];
  duration_minutes: number;
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  timezone?: string;
}): Promise<TimeSlot[]> => {
  const {
    companyId,
    userEmails,
    duration_minutes,
    start_time,
    end_time,
    timezone,
  } = params;

  console.log(
    `[Calendar Agent] Checking availability for ${userEmails.length} users (${duration_minutes}min)`
  );

  // Convert to Unix timestamps
  const startUnix = Math.floor(new Date(start_time).getTime() / 1000);
  const endUnix = Math.floor(new Date(end_time).getTime() / 1000);

  // Get availability for all users in parallel
  const availabilityMap = await getCompanyWideAvailability(companyId, {
    start: startUnix,
    end: endUnix,
  });

  // Filter to requested users only
  const relevantEvents = userEmails.map((email) => ({
    email,
    events: availabilityMap.get(email) || [],
  }));

  // Calculate free slots using interval algebra
  const slots = calculateGroupAvailability(
    relevantEvents,
    startUnix,
    endUnix,
    duration_minutes * 60, // Convert to seconds
    timezone || 'UTC'
  );

  console.log(
    `[Calendar Agent] Found ${slots.length} slots where all participants are available`
  );

  return slots;
};

/**
 * Calculate group availability using interval algebra (Pure Function)
 *
 * @param userEvents - Events for each user
 * @param searchStart - Unix timestamp search start
 * @param searchEnd - Unix timestamp search end
 * @param durationSeconds - Required duration in seconds
 * @param timezone - IANA timezone
 * @returns Array of time slots
 */
export const calculateGroupAvailability = (
  userEvents: Array<{ email: string; events: NylasEventMultiUser[] }>,
  searchStart: number,
  searchEnd: number,
  durationSeconds: number,
  timezone: string
): TimeSlot[] => {
  // Convert all events to busy intervals
  const busyIntervals = userEvents.flatMap(({ email, events }) =>
    events.map((event) => ({
      start: event.when.start_time,
      end: event.when.end_time,
      email,
    }))
  );

  // Sort by start time for efficient processing
  const sorted = busyIntervals.sort((a, b) => a.start - b.start);

  // Find all potential time slots (15-minute increments)
  const slots: TimeSlot[] = [];
  let currentTime = searchStart;
  const increment = 15 * 60; // 15 minutes in seconds

  while (currentTime + durationSeconds <= searchEnd) {
    const slotEnd = currentTime + durationSeconds;

    // Check which users are busy during this slot
    const busyUsers = new Set<string>();
    for (const interval of sorted) {
      // Check if interval overlaps with [currentTime, slotEnd]
      if (interval.start < slotEnd && interval.end > currentTime) {
        busyUsers.add(interval.email);
      }
    }

    // Determine available participants
    const allUsers = new Set(userEvents.map((u) => u.email));
    const availableUsers = Array.from(allUsers).filter(
      (email) => !busyUsers.has(email)
    );

    // Only include slots where ALL participants are available
    if (availableUsers.length === allUsers.size) {
      slots.push({
        start: new Date(currentTime * 1000).toISOString(),
        end: new Date(slotEnd * 1000).toISOString(),
        available_participants: availableUsers,
        all_available: true,
      });
    }

    // Move to next slot
    currentTime += increment;
  }

  return slots;
};

// ==========================================
// Event Creation & Management
// ==========================================

/**
 * Create calendar event using organizer's grant
 *
 * @param payload - Meeting payload with all details
 * @returns Updated payload with calendar event details
 */
export const createCalendarEventForUser = async (
  payload: MeetingPayload
): Promise<MeetingPayload> => {
  const organizerAccount = await findUserGrantOrThrow(
    payload.company_id,
    payload.organizer.email
  );

  console.log(
    `[Calendar Agent] Creating event for ${payload.organizer.email}: "${payload.subject}"`
  );

  const event = await createCalendarEventForGrant(
    organizerAccount.nylasGrantId,
    {
      calendarId: 'primary',
      title: payload.subject,
      description: payload.description,
      when: {
        start_time: Math.floor(new Date(payload.time.start).getTime() / 1000),
        end_time: Math.floor(new Date(payload.time.end).getTime() / 1000),
        timezone: payload.time.timezone,
      },
      location:
        payload.location.physical_address || payload.location.join_url,
      participants: payload.participants.map((p) => ({
        name: p.name,
        email: p.email,
      })),
      conferencing:
        payload.location.type === 'video'
          ? {
              provider: (payload.location.provider ||
                'google_meet') as 'google_meet',
              autocreate: {},
            }
          : undefined,
    }
  );

  console.log(
    `[Calendar Agent] Event created: ${event.id} (Join URL: ${event.conferencing?.details?.url || 'N/A'})`
  );

  return {
    ...payload,
    calendar: {
      calendar_event_id: event.id,
      calendar_html_link: event.html_link,
      calendar_id: event.calendar_id,
      ical_uid: event.ical_uid,
    },
    location: {
      ...payload.location,
      join_url:
        event.conferencing?.details?.url || payload.location.join_url,
    },
  };
};

/**
 * Update existing calendar event
 *
 * @param companyId - MongoDB company ID
 * @param organizerEmail - Organizer's email
 * @param eventId - Nylas event ID
 * @param updates - Partial event updates
 * @returns Updated event
 */
export const updateCalendarEventForUser = async (
  companyId: string,
  organizerEmail: string,
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    when: { start_time: number; end_time: number };
    participants: Array<{ name: string; email: string }>;
  }>
): Promise<NylasEventMultiUser> => {
  const organizerAccount = await findUserGrantOrThrow(
    companyId,
    organizerEmail
  );

  console.log(
    `[Calendar Agent] Updating event ${eventId} for ${organizerEmail}`
  );

  const event = await updateCalendarEventForGrant(
    organizerAccount.nylasGrantId,
    eventId,
    updates
  );

  // Update cache
  await NylasEventCache.upsertEvent(
    organizerAccount.nylasGrantId,
    'calendar',
    eventId,
    event,
    24 // 24-hour TTL
  );

  return event;
};

/**
 * Delete calendar event
 *
 * @param companyId - MongoDB company ID
 * @param organizerEmail - Organizer's email
 * @param eventId - Nylas event ID
 */
export const deleteCalendarEventForUser = async (
  companyId: string,
  organizerEmail: string,
  eventId: string
): Promise<void> => {
  const organizerAccount = await findUserGrantOrThrow(
    companyId,
    organizerEmail
  );

  console.log(
    `[Calendar Agent] Deleting event ${eventId} for ${organizerEmail}`
  );

  await deleteCalendarEventForGrant(organizerAccount.nylasGrantId, eventId);

  // Remove from cache
  await NylasEventCache.deleteEvent(
    organizerAccount.nylasGrantId,
    'calendar',
    eventId
  );
};

// ==========================================
// Helper Functions (Pure)
// ==========================================

/**
 * Calculate duration between two ISO timestamps (Pure Function)
 *
 * @param start - ISO 8601 timestamp
 * @param end - ISO 8601 timestamp
 * @returns Duration in minutes
 */
export const calculateDuration = (start: string, end: string): number => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.floor((endMs - startMs) / 60000);
};

/**
 * Format date/time with timezone (Pure Function)
 *
 * @param isoString - ISO 8601 timestamp
 * @param timezone - IANA timezone
 * @returns Formatted date/time string
 */
export const formatDateTime = (
  isoString: string,
  timezone: string
): string => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(isoString));
};

/**
 * Check if two time ranges overlap (Pure Function)
 *
 * @param range1 - First time range [start, end]
 * @param range2 - Second time range [start, end]
 * @returns true if ranges overlap
 */
export const timeRangesOverlap = (
  range1: { start: number; end: number },
  range2: { start: number; end: number }
): boolean => {
  return range1.start < range2.end && range1.end > range2.start;
};

/**
 * Generate time slots between start and end with given increment
 * Pure function
 *
 * @param startUnix - Unix timestamp start
 * @param endUnix - Unix timestamp end
 * @param incrementMinutes - Increment in minutes
 * @returns Array of time slot boundaries
 */
export const generateTimeSlots = (
  startUnix: number,
  endUnix: number,
  incrementMinutes: number
): Array<{ start: number; end: number }> => {
  const slots: Array<{ start: number; end: number }> = [];
  const incrementSeconds = incrementMinutes * 60;

  let current = startUnix;
  while (current < endUnix) {
    slots.push({
      start: current,
      end: Math.min(current + incrementSeconds, endUnix),
    });
    current += incrementSeconds;
  }

  return slots;
};
