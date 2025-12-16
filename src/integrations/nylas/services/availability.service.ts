/**
 * Nylas Availability Service
 *
 * Intelligent scheduling and availability detection
 */

import axios from 'axios';
import { FreeBusyData, FreeBusySlot, AvailableSlot, NylasEvent, ConflictCheck } from '../types';
import { resolveGrantId } from '../utils/grant-resolver';
import { getCalendarEvents } from './calendar.service';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

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

  console.log('[NYLAS AVAILABILITY] Getting free/busy via V3:', { emails, startTime, endTime, grantId: grantId.substring(0, 8) + '...' });

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
    console.error('[NYLAS AVAILABILITY ERROR] getFreeBusy:', error.response?.data || error.message);
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
