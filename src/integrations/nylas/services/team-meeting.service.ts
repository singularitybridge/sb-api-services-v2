/**
 * Team Meeting Service
 *
 * Functional service for creating multi-user meetings with recurrence support
 * Uses compose/pipe patterns for data transformation
 */

import { Types } from 'mongoose';
import { Team } from '../../../models/Team';
import { TeamMember } from '../models/TeamMember';
import { EmailProfile } from '../models/EmailProfile';
import { NylasAccount } from '../models/NylasAccount';
import { createCalendarEventForGrant } from '../nylas-multi-user.service';

// ==========================================
// Types
// ==========================================

interface Attendee {
  name: string;
  email: string;
  status?: 'noreply' | 'yes' | 'no' | 'maybe';
}

interface RecurrenceConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  count?: number;
  until?: string;
}

interface OrganizerData {
  profileId: string;
  label: string;
  email: string;
  grantId: string;
  calendarId: string;
}

// ==========================================
// Pure Functions: Time Handling
// ==========================================

const parseTime = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
};

const combineDateTimeTimezone = (
  date: string,
  time: string,
  timezone: string
): Date => {
  const { hours, minutes } = parseTime(time);
  const dateObj = new Date(date);
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
};

const toUnixTimestamp = (date: Date): number => Math.floor(date.getTime() / 1000);

const addMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() + minutes * 60 * 1000);

// ==========================================
// Pure Functions: RRULE Generation
// ==========================================

const buildRRule = (config: RecurrenceConfig): string => {
  const parts: string[] = [];

  parts.push(`FREQ=${config.frequency.toUpperCase()}`);

  if (config.interval && config.interval > 1) {
    parts.push(`INTERVAL=${config.interval}`);
  }

  if (config.count) {
    parts.push(`COUNT=${config.count}`);
  } else if (config.until) {
    const untilDate = new Date(config.until);
    const formatted = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${formatted}`);
  }

  return `RRULE:${parts.join(';')}`;
};

// ==========================================
// Data Resolution (Compose Queries)
// ==========================================

const resolveOrganizer = async (
  companyId: string,
  profileId: string
): Promise<OrganizerData | null> => {
  const profile = await EmailProfile.findOne({
    _id: new Types.ObjectId(profileId),
    companyId: new Types.ObjectId(companyId),
    isActive: true,
  }).populate<{ nylasAccountId: any }>('nylasAccountId');

  if (!profile || profile.nylasAccountId?.status !== 'active') {
    return null;
  }

  return {
    profileId: profile._id.toString(),
    label: profile.label,
    email: profile.fromEmail,
    grantId: profile.nylasAccountId.nylasGrantId,
    calendarId: profile.defaultCalendarId || profile.nylasAccountId.defaultCalendarId || 'primary',
  };
};

const resolveTeamAttendees = async (
  companyId: string,
  teamIds: string[]
): Promise<Attendee[]> => {
  const teams = await Team.find({
    _id: { $in: teamIds.map((id) => new Types.ObjectId(id)) },
    companyId: new Types.ObjectId(companyId),
    isActive: true,
  });

  if (teams.length === 0) return [];

  const members = await TeamMember.find({
    teamId: { $in: teams.map((t) => t._id) },
    isActive: true,
  }).populate<{ emailProfileId: any }>({
    path: 'emailProfileId',
    populate: { path: 'nylasAccountId' },
  });

  return members
    .filter((m) => m.emailProfileId?.nylasAccountId?.status === 'active')
    .map((m) => ({
      name: m.emailProfileId.label,
      email: m.emailProfileId.fromEmail,
      status: 'noreply' as const,
    }));
};

const resolveExternalAttendees = (
  contacts: { name: string; email: string }[]
): Attendee[] =>
  contacts.map((c) => ({
    name: c.name,
    email: c.email,
    status: 'noreply' as const,
  }));

// ==========================================
// Attendee Deduplication (Functional)
// ==========================================

const deduplicateAttendees = (attendees: Attendee[]): Attendee[] => {
  const seen = new Set<string>();

  return attendees.filter((a) => {
    const key = a.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ==========================================
// Main Service Functions
// ==========================================

export interface CreateTeamMeetingInput {
  companyId: string;
  organizerProfileId: string;
  teamIds?: string[];
  externalContacts?: { name: string; email: string }[];
  meetingDetails: {
    title: string;
    description?: string;
    location?: string;
    startDate: string;
    startTime: string;
    durationMinutes: number;
    timezone: string;
  };
  recurrence?: RecurrenceConfig;
}

export interface CreateTeamMeetingOutput {
  success: boolean;
  data?: {
    eventId: string;
    organizerEmail: string;
    calendarId: string;
    attendees: Attendee[];
    startTime: string;
    endTime: string;
    recurrenceRule?: string;
  };
  error?: string;
}

export const createTeamMeeting = async (
  input: CreateTeamMeetingInput
): Promise<CreateTeamMeetingOutput> => {
  const {
    companyId,
    organizerProfileId,
    teamIds = [],
    externalContacts = [],
    meetingDetails,
    recurrence,
  } = input;

  // 1. Resolve organizer (single query)
  const organizer = await resolveOrganizer(companyId, organizerProfileId);

  if (!organizer) {
    return {
      success: false,
      error: 'Organizer profile not found or inactive',
    };
  }

  // 2. Resolve attendees (parallel)
  const [teamAttendees, externalAttendees] = await Promise.all([
    resolveTeamAttendees(companyId, teamIds),
    Promise.resolve(resolveExternalAttendees(externalContacts)),
  ]);

  // 3. Deduplicate and exclude organizer
  const allAttendees = deduplicateAttendees([...teamAttendees, ...externalAttendees])
    .filter((a) => a.email.toLowerCase() !== organizer.email.toLowerCase());

  // 4. Calculate times (pure functions)
  const startDateTime = combineDateTimeTimezone(
    meetingDetails.startDate,
    meetingDetails.startTime,
    meetingDetails.timezone
  );

  const endDateTime = addMinutes(startDateTime, meetingDetails.durationMinutes);

  // 5. Build recurrence rule (if provided)
  const recurrenceRule = recurrence ? buildRRule(recurrence) : undefined;

  // 6. Create event via Nylas
  try {
    const event = await createCalendarEventForGrant(organizer.grantId, {
      calendarId: organizer.calendarId,
      title: meetingDetails.title,
      description: meetingDetails.description,
      location: meetingDetails.location,
      when: {
        start_time: toUnixTimestamp(startDateTime),
        end_time: toUnixTimestamp(endDateTime),
        timezone: meetingDetails.timezone,
      },
      participants: allAttendees.map((a) => ({
        name: a.name,
        email: a.email,
        status: a.status,
      })),
      recurrence: recurrenceRule ? [recurrenceRule] : undefined,
    });

    return {
      success: true,
      data: {
        eventId: event.id,
        organizerEmail: organizer.email,
        calendarId: organizer.calendarId,
        attendees: allAttendees,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        recurrenceRule,
      },
    };
  } catch (error: any) {
    console.error('[TEAM MEETING] Error creating event:', error);
    return {
      success: false,
      error: error.message || 'Failed to create meeting',
    };
  }
};

// ==========================================
// Helper: Create Recurring Series
// ==========================================

export const createWeeklyTeamMeeting = (
  input: Omit<CreateTeamMeetingInput, 'recurrence'> & { weeks: number }
): Promise<CreateTeamMeetingOutput> =>
  createTeamMeeting({
    ...input,
    recurrence: {
      frequency: 'weekly',
      interval: 1,
      count: input.weeks,
    },
  });

export const createDailyTeamMeeting = (
  input: Omit<CreateTeamMeetingInput, 'recurrence'> & { days: number }
): Promise<CreateTeamMeetingOutput> =>
  createTeamMeeting({
    ...input,
    recurrence: {
      frequency: 'daily',
      interval: 1,
      count: input.days,
    },
  });

// ==========================================
// Helper: Find Best Time and Create
// ==========================================

export interface CreateOptimalMeetingInput extends CreateTeamMeetingInput {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  timeRange?: {
    startTime: string;
    endTime: string;
  };
}

export const createOptimalTeamMeeting = async (
  input: CreateOptimalMeetingInput
): Promise<CreateTeamMeetingOutput> => {
  // This would integrate with getTeamAvailability to find optimal slot
  // For now, just create at specified time
  // TODO: Implement slot finding algorithm

  return createTeamMeeting(input);
};
