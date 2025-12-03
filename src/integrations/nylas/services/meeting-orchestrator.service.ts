/**
 * Meeting Orchestrator Service
 *
 * Coordinates the three-agent architecture (Contacts, Calendar, Email)
 * for end-to-end meeting scheduling with company-wide admin capabilities.
 *
 * Flow: Contacts (enrich) → Calendar (create event) → Email (send invites)
 *
 * Supports:
 * - Small meetings (2-5 people)
 * - Large group coordination (15+ participants)
 * - Availability checking across entire company
 * - Multi-grant parallel operations
 */

import { findUserGrantOrThrow } from './company-calendar.service';
import { enrichParticipantsWithContacts } from '../agents/contacts-agent.service';
import {
  checkAvailabilityForUsers,
  createCalendarEventForUser,
  calculateDuration,
  type MeetingPayload,
  type TimeSlot,
} from '../agents/calendar-agent.service';
import { sendMeetingInviteForUser } from '../agents/email-agent.service';

// ==========================================
// Result Type for Functional Error Handling
// ==========================================

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ==========================================
// Core Orchestration Functions
// ==========================================

/**
 * Schedule meeting end-to-end (Main Flow)
 * Flow: Contacts → Calendar → Email
 *
 * @param params - Meeting scheduling parameters
 * @returns Complete meeting payload
 */
export const scheduleMeeting = async (params: {
  companyId: string;
  organizer: { name: string; email: string };
  participants: Array<{ name: string; email: string }>;
  subject: string;
  description?: string;
  time: { start: string; end: string; timezone: string };
  location: {
    type: 'physical' | 'video' | 'phone';
    provider?: 'teams' | 'zoom' | 'google_meet' | 'custom';
    physical_address?: string;
    dial_in?: string;
  };
  language?: string;
}): Promise<MeetingPayload> => {
  console.log(
    `[Orchestrator] Scheduling meeting: "${params.subject}" with ${params.participants.length} participants`
  );

  // 1. Validate organizer has connected calendar
  await findUserGrantOrThrow(params.companyId, params.organizer.email);

  // 2. Create initial payload
  let payload: MeetingPayload = {
    meeting_id: generateUUID(),
    subject: params.subject,
    description: params.description,
    company_id: params.companyId,
    organizer: params.organizer,
    participants: params.participants,
    time: {
      ...params.time,
      duration_minutes: calculateDuration(params.time.start, params.time.end),
    },
    location: params.location,
    meta: {
      source: 'ai_assistant',
      language: params.language || 'en',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
    },
  };

  console.log(`[Orchestrator] Created payload: ${payload.meeting_id}`);

  // 3. Enrich with contact data (Contacts Agent)
  console.log(`[Orchestrator] Step 1/3: Enriching with contact data...`);
  payload.participants = await enrichParticipantsWithContacts(
    payload.company_id,
    payload.organizer.email,
    payload.participants
  );

  // 4. Create calendar event (Calendar Agent)
  console.log(`[Orchestrator] Step 2/3: Creating calendar event...`);
  payload = await createCalendarEventForUser(payload);
  payload.meta.status = 'scheduled';

  // 5. Send email invitation (Email Agent)
  console.log(`[Orchestrator] Step 3/3: Sending email invitations...`);
  payload = await sendMeetingInviteForUser(payload);

  console.log(
    `[Orchestrator] ✅ Meeting scheduled successfully: ${payload.meeting_id}`
  );

  // 6. Return final payload
  return payload;
};

/**
 * Find availability and schedule meeting (Alternative Flow)
 * Flow: Calendar (check) → Contacts → Calendar (create) → Email
 *
 * @param params - Availability and scheduling parameters
 * @returns Available slots and scheduled meeting (if slot found)
 */
export const findAvailabilityAndSchedule = async (params: {
  companyId: string;
  organizer: { name: string; email: string };
  participantEmails: string[];
  duration_minutes: number;
  date_preferences: Array<{ start: string; end: string }>;
  timezone: string;
  subject: string;
  description?: string;
  location: { type: 'physical' | 'video' | 'phone'; provider?: 'teams' | 'zoom' | 'google_meet' | 'custom'; physical_address?: string };
}): Promise<{
  available_slots: TimeSlot[];
  scheduled_meeting?: MeetingPayload;
}> => {
  console.log(
    `[Orchestrator] Finding availability for ${params.participantEmails.length + 1} people (${params.duration_minutes}min)`
  );

  // 1. Check availability for all participants (parallel)
  const allEmails = [params.organizer.email, ...params.participantEmails];
  const availableSlots = await checkAvailabilityForUsers({
    companyId: params.companyId,
    userEmails: allEmails,
    duration_minutes: params.duration_minutes,
    start_time: params.date_preferences[0].start,
    end_time:
      params.date_preferences[params.date_preferences.length - 1].end,
    timezone: params.timezone,
  });

  console.log(
    `[Orchestrator] Found ${availableSlots.length} available slots`
  );

  // 2. If no availability, return empty slots
  if (availableSlots.length === 0) {
    console.log(
      `[Orchestrator] No availability found for all participants`
    );
    return { available_slots: [] };
  }

  // 3. Pick first available slot where ALL participants are free
  const selectedSlot = availableSlots[0];
  console.log(
    `[Orchestrator] Selected slot: ${selectedSlot.start} - ${selectedSlot.end}`
  );

  // 4. Schedule meeting using selected slot
  const meeting = await scheduleMeeting({
    companyId: params.companyId,
    organizer: params.organizer,
    participants: params.participantEmails.map((email) => ({
      name: email.split('@')[0], // Fallback name from email
      email,
    })),
    subject: params.subject,
    description: params.description,
    time: {
      start: selectedSlot.start,
      end: selectedSlot.end,
      timezone: params.timezone,
    },
    location: params.location,
  });

  return {
    available_slots: availableSlots,
    scheduled_meeting: meeting,
  };
};

/**
 * Schedule recurring meeting (future enhancement)
 *
 * @param params - Recurring meeting parameters
 * @returns Array of scheduled meetings
 */
export const scheduleRecurringMeeting = async (params: {
  companyId: string;
  organizer: { name: string; email: string };
  participants: Array<{ name: string; email: string }>;
  subject: string;
  description?: string;
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly';
    count: number;
    start_date: string;
    start_time: string;
    duration_minutes: number;
    timezone: string;
  };
  location: {
    type: 'physical' | 'video' | 'phone';
    provider?: 'teams' | 'zoom' | 'google_meet' | 'custom';
    physical_address?: string;
  };
}): Promise<MeetingPayload[]> => {
  console.log(
    `[Orchestrator] Scheduling ${params.recurrence.count} recurring meetings (${params.recurrence.frequency})`
  );

  // Calculate occurrence dates based on recurrence pattern
  const occurrences = generateRecurrenceOccurrences(
    params.recurrence.start_date,
    params.recurrence.start_time,
    params.recurrence.duration_minutes,
    params.recurrence.frequency,
    params.recurrence.count,
    params.recurrence.timezone
  );

  // Schedule each occurrence
  const meetings: MeetingPayload[] = [];
  for (const occurrence of occurrences) {
    try {
      const meeting = await scheduleMeeting({
        companyId: params.companyId,
        organizer: params.organizer,
        participants: params.participants,
        subject: `${params.subject} (${occurrence.index}/${params.recurrence.count})`,
        description: params.description,
        time: {
          start: occurrence.start,
          end: occurrence.end,
          timezone: params.recurrence.timezone,
        },
        location: params.location,
      });
      meetings.push(meeting);
    } catch (error: any) {
      console.error(
        `[Orchestrator] Failed to schedule occurrence ${occurrence.index}:`,
        error.message
      );
    }
  }

  console.log(
    `[Orchestrator] ✅ Scheduled ${meetings.length}/${params.recurrence.count} recurring meetings`
  );

  return meetings;
};

// ==========================================
// Error Handling Wrappers
// ==========================================

/**
 * Wrap scheduleMeeting with error handling (Result type)
 *
 * @param params - Meeting parameters
 * @returns Result with meeting or error
 */
export const scheduleMeetingSafe = async (
  params: any
): Promise<Result<MeetingPayload>> => {
  try {
    const meeting = await scheduleMeeting(params);
    return { ok: true, value: meeting };
  } catch (error: any) {
    console.error('[Orchestrator] ❌ Scheduling failed:', error.message);
    return { ok: false, error };
  }
};

/**
 * Wrap findAvailabilityAndSchedule with error handling
 *
 * @param params - Availability parameters
 * @returns Result with slots/meeting or error
 */
export const findAvailabilityAndScheduleSafe = async (
  params: any
): Promise<
  Result<{ available_slots: TimeSlot[]; scheduled_meeting?: MeetingPayload }>
> => {
  try {
    const result = await findAvailabilityAndSchedule(params);
    return { ok: true, value: result };
  } catch (error: any) {
    console.error('[Orchestrator] ❌ Availability check failed:', error.message);
    return { ok: false, error };
  }
};

// ==========================================
// Helper Functions (Pure)
// ==========================================

/**
 * Generate UUID v4 (Pure Function)
 *
 * @returns UUID string
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Generate recurrence occurrences (Pure Function)
 *
 * @param startDate - YYYY-MM-DD
 * @param startTime - HH:MM
 * @param durationMinutes - Duration
 * @param frequency - daily | weekly | monthly
 * @param count - Number of occurrences
 * @param timezone - IANA timezone
 * @returns Array of occurrence time ranges
 */
const generateRecurrenceOccurrences = (
  startDate: string,
  startTime: string,
  durationMinutes: number,
  frequency: 'daily' | 'weekly' | 'monthly',
  count: number,
  timezone: string
): Array<{ index: number; start: string; end: string }> => {
  const occurrences: Array<{ index: number; start: string; end: string }> = [];

  const baseDate = new Date(`${startDate}T${startTime}:00`);

  for (let i = 0; i < count; i++) {
    const occurrenceDate = new Date(baseDate);

    switch (frequency) {
      case 'daily':
        occurrenceDate.setDate(baseDate.getDate() + i);
        break;
      case 'weekly':
        occurrenceDate.setDate(baseDate.getDate() + i * 7);
        break;
      case 'monthly':
        occurrenceDate.setMonth(baseDate.getMonth() + i);
        break;
    }

    const start = occurrenceDate.toISOString();
    const end = new Date(
      occurrenceDate.getTime() + durationMinutes * 60000
    ).toISOString();

    occurrences.push({ index: i + 1, start, end });
  }

  return occurrences;
};

/**
 * Compose async functions (Functional Composition)
 *
 * @param fns - Array of async functions
 * @returns Composed function
 */
export const pipe =
  <T>(...fns: Array<(arg: T) => Promise<T>>) =>
  (initial: T): Promise<T> =>
    fns.reduce((promise, fn) => promise.then(fn), Promise.resolve(initial));
