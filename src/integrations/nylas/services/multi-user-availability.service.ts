/**
 * Multi-User Availability Service
 *
 * Functional, composable utilities for querying availability across multiple calendars
 * Uses compact functional programming patterns: pipe, map, filter, reduce
 */

import { Types } from 'mongoose';
import { Team } from '../../../models/Team';
import { TeamMember } from '../models/TeamMember';
import { EmailProfile } from '../models/EmailProfile';
import { NylasAccount } from '../models/NylasAccount';
import {
  getCalendarEventsForGrant,
  NylasEventMultiUser,
} from '../nylas-multi-user.service';

// ==========================================
// Types
// ==========================================

interface TimeSlot {
  startIso: string;
  endIso: string;
}

interface AvailabilityMap {
  [profileId: string]: 'free' | 'busy' | 'unknown';
}

interface AvailabilitySlot extends TimeSlot {
  availability: AvailabilityMap;
}

interface ProfileCalendarData {
  profileId: string;
  profileLabel: string;
  email: string;
  grantId: string;
  calendarId: string;
}

interface CalendarEvent {
  id: string;
  startTime: number;
  endTime: number;
}

// ==========================================
// Pure Functional Utilities
// ==========================================

const toTimestamp = (isoString: string): number => new Date(isoString).getTime();
const toIsoString = (timestamp: number): string => new Date(timestamp).toISOString();

const createTimeSlot = (start: number, end: number): TimeSlot => ({
  startIso: toIsoString(start),
  endIso: toIsoString(end),
});

const isWithinRange = (event: CalendarEvent, start: number, end: number): boolean =>
  event.startTime < end && event.endTime > start;

const overlapsSlot = (event: CalendarEvent, slot: TimeSlot): boolean => {
  const slotStart = toTimestamp(slot.startIso);
  const slotEnd = toTimestamp(slot.endIso);
  return isWithinRange(event, slotStart, slotEnd);
};

// ==========================================
// Time Grid Generation
// ==========================================

const generateTimeSlots = (
  startIso: string,
  endIso: string,
  slotDurationMinutes: number = 30
): TimeSlot[] => {
  const start = toTimestamp(startIso);
  const end = toTimestamp(endIso);
  const slotMs = slotDurationMinutes * 60 * 1000;

  return Array.from(
    { length: Math.ceil((end - start) / slotMs) },
    (_, i) => createTimeSlot(start + i * slotMs, start + (i + 1) * slotMs)
  );
};

// ==========================================
// Profile Resolution (Compose Queries)
// ==========================================

const resolveTeamProfiles = async (
  companyId: string,
  teamIds: string[]
): Promise<ProfileCalendarData[]> => {
  const teams = await Team.find({
    _id: { $in: teamIds.map((id) => new Types.ObjectId(id)) },
    companyId: new Types.ObjectId(companyId),
    isActive: true,
  });

  if (teams.length === 0) return [];

  const members = await TeamMember.find({
    teamId: { $in: teams.map((t) => t._id) },
    isActive: true,
  }).populate<{ emailProfileId: any }>('emailProfileId');

  const profileIds = members
    .map((m) => m.emailProfileId?._id)
    .filter(Boolean);

  const profiles = await EmailProfile.find({
    _id: { $in: profileIds },
    isActive: true,
  }).populate<{ nylasAccountId: any }>('nylasAccountId');

  return profiles
    .filter((p) => p.nylasAccountId?.status === 'active')
    .map((p) => ({
      profileId: p._id.toString(),
      profileLabel: p.label,
      email: p.fromEmail,
      grantId: p.nylasAccountId.nylasGrantId,
      calendarId: p.defaultCalendarId || p.nylasAccountId.defaultCalendarId || 'primary',
    }));
};

// ==========================================
// Event Fetching (Parallel)
// ==========================================

const fetchEventsForProfile = async (
  profile: ProfileCalendarData,
  startIso: string,
  endIso: string
): Promise<{ profileId: string; events: CalendarEvent[] }> => {
  try {
    const events = await getCalendarEventsForGrant(
      profile.grantId,
      {
        calendarId: profile.calendarId,
        start: Math.floor(toTimestamp(startIso) / 1000),
        end: Math.floor(toTimestamp(endIso) / 1000),
        limit: 1000,
      }
    );

    return {
      profileId: profile.profileId,
      events: events.map((e) => ({
        id: e.id,
        startTime: e.when.start_time * 1000,
        endTime: e.when.end_time * 1000,
      })),
    };
  } catch (error) {
    console.error(`[AVAILABILITY] Error fetching events for ${profile.email}:`, error);
    return { profileId: profile.profileId, events: [] };
  }
};

const fetchAllEvents = (
  profiles: ProfileCalendarData[],
  startIso: string,
  endIso: string
) => Promise.all(profiles.map((p) => fetchEventsForProfile(p, startIso, endIso)));

// ==========================================
// Availability Calculation (Map/Reduce)
// ==========================================

const calculateSlotAvailability = (
  slot: TimeSlot,
  eventsByProfile: Map<string, CalendarEvent[]>
): AvailabilityMap =>
  Array.from(eventsByProfile.entries()).reduce(
    (acc, [profileId, events]) => ({
      ...acc,
      [profileId]: events.some((e) => overlapsSlot(e, slot)) ? 'busy' : 'free',
    }),
    {} as AvailabilityMap
  );

const buildAvailabilityMatrix = (
  slots: TimeSlot[],
  eventsByProfile: Map<string, CalendarEvent[]>
): AvailabilitySlot[] =>
  slots.map((slot) => ({
    ...slot,
    availability: calculateSlotAvailability(slot, eventsByProfile),
  }));

// ==========================================
// Main Service Functions
// ==========================================

export interface GetTeamAvailabilityInput {
  companyId: string;
  teamIds: string[];
  startIso: string;
  endIso: string;
  slotDurationMinutes?: number;
}

export interface GetTeamAvailabilityOutput {
  success: boolean;
  data: {
    profiles: {
      profileId: string;
      label: string;
      email: string;
    }[];
    slots: AvailabilitySlot[];
    summary: {
      totalSlots: number;
      allFreeSlots: number;
      someFreeSlots: number;
      allBusySlots: number;
    };
  };
}

export const getTeamAvailability = async (
  input: GetTeamAvailabilityInput
): Promise<GetTeamAvailabilityOutput> => {
  const { companyId, teamIds, startIso, endIso, slotDurationMinutes = 30 } = input;

  // 1. Resolve profiles (compose queries)
  const profiles = await resolveTeamProfiles(companyId, teamIds);

  if (profiles.length === 0) {
    return {
      success: false,
      data: {
        profiles: [],
        slots: [],
        summary: { totalSlots: 0, allFreeSlots: 0, someFreeSlots: 0, allBusySlots: 0 },
      },
    };
  }

  // 2. Generate time grid
  const slots = generateTimeSlots(startIso, endIso, slotDurationMinutes);

  // 3. Fetch events in parallel
  const eventsData = await fetchAllEvents(profiles, startIso, endIso);

  // 4. Build event map (profileId → events)
  const eventsByProfile = new Map(
    eventsData.map((d) => [d.profileId, d.events])
  );

  // 5. Calculate availability matrix
  const availabilitySlots = buildAvailabilityMatrix(slots, eventsByProfile);

  // 6. Compute summary (functional reduce)
  const summary = availabilitySlots.reduce(
    (acc, slot) => {
      const statuses = Object.values(slot.availability);
      const allFree = statuses.every((s) => s === 'free');
      const allBusy = statuses.every((s) => s === 'busy');

      return {
        totalSlots: acc.totalSlots + 1,
        allFreeSlots: acc.allFreeSlots + (allFree ? 1 : 0),
        someFreeSlots: acc.someFreeSlots + (!allFree && !allBusy ? 1 : 0),
        allBusySlots: acc.allBusySlots + (allBusy ? 1 : 0),
      };
    },
    { totalSlots: 0, allFreeSlots: 0, someFreeSlots: 0, allBusySlots: 0 }
  );

  return {
    success: true,
    data: {
      profiles: profiles.map((p) => ({
        profileId: p.profileId,
        label: p.profileLabel,
        email: p.email,
      })),
      slots: availabilitySlots,
      summary,
    },
  };
};

// ==========================================
// Helper: Find Optimal Slots
// ==========================================

export const findOptimalSlots = (
  slots: AvailabilitySlot[],
  options: {
    requireAllFree?: boolean;
    minFreeCount?: number;
    limit?: number;
  } = {}
): AvailabilitySlot[] => {
  const { requireAllFree = true, minFreeCount = 1, limit = 10 } = options;

  return slots
    .filter((slot) => {
      const freeCount = Object.values(slot.availability).filter(
        (s) => s === 'free'
      ).length;

      return requireAllFree
        ? freeCount === Object.keys(slot.availability).length
        : freeCount >= minFreeCount;
    })
    .slice(0, limit);
};

// ==========================================
// Helper: Group Slots by Date
// ==========================================

export const groupSlotsByDate = (
  slots: AvailabilitySlot[]
): Map<string, AvailabilitySlot[]> =>
  slots.reduce((acc, slot) => {
    const date = slot.startIso.split('T')[0];
    const existing = acc.get(date) || [];
    acc.set(date, [...existing, slot]);
    return acc;
  }, new Map<string, AvailabilitySlot[]>());
