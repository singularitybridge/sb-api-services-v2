/**
 * Nylas Batch Operations Service
 *
 * Handles batch operations for creating multiple events
 */

import { BatchEventCreate, BatchCreateResult, NylasEvent } from '../types';
import { createCalendarEvent } from './calendar.service';

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
