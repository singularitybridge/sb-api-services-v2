/**
 * Team Availability Actions
 *
 * AI-callable actions for multi-user availability checking
 * Functional composition over imperative code
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../../actions/types';
import {
  getTeamAvailability,
  findOptimalSlots,
  groupSlotsByDate,
  GetTeamAvailabilityOutput,
} from '../services/multi-user-availability.service';
import { executeAction } from '../../actions/executor';
import { ActionValidationError } from '../../../utils/actionErrors';
import { Team } from '../../../models/Team';
import { Types } from 'mongoose';

const SERVICE_NAME = 'teamOrchestrationService';

// ==========================================
// Types
// ==========================================

interface AvailabilitySlot {
  startIso: string;
  endIso: string;
  availability: { [profileId: string]: string };
}

interface ServiceResponse<T> {
  success: boolean;
  data: T;
  description?: string;
}

// ==========================================
// Pure Functional Helpers
// ==========================================

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const summarizeSlot = (slot: AvailabilitySlot) => {
  const statuses = Object.values(slot.availability);
  const freeCount = statuses.filter((s) => s === 'free').length;
  const total = statuses.length;

  return {
    date: formatDate(slot.startIso),
    time: formatTime(slot.startIso),
    freeCount,
    totalCount: total,
    allFree: freeCount === total,
    percentFree: Math.round((freeCount / total) * 100),
  };
};

// ==========================================
// Team Name Resolution
// ==========================================

const resolveTeamIds = async (
  companyId: string,
  teamNames: string[]
): Promise<string[]> => {
  const teams = await Team.find({
    companyId: new Types.ObjectId(companyId),
    name: { $in: teamNames },
    isActive: true,
  });

  if (teams.length === 0) {
    throw new ActionValidationError(
      `No active teams found with names: ${teamNames.join(', ')}`
    );
  }

  return teams.map((t) => t._id.toString());
};

// ==========================================
// Actions
// ==========================================

export const createTeamAvailabilityActions = (
  context: ActionContext
): FunctionFactory => ({
  // ==========================================
  // Action: Get Team Availability
  // ==========================================
  nylasGetTeamAvailability: {
    description:
      'Check availability for multiple teams within a date range. Returns time slots showing when team members are free or busy.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        teamNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of teams to check (e.g., ["Regulatory", "Design"])',
        },
        dateRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              description: 'Start date in ISO format (e.g., "2025-01-06")',
            },
            end: {
              type: 'string',
              description: 'End date in ISO format (e.g., "2025-01-10")',
            },
          },
          required: ['start', 'end'],
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              description: 'Start time in HH:MM format (e.g., "09:00")',
            },
            end: {
              type: 'string',
              description: 'End time in HH:MM format (e.g., "17:00")',
            },
          },
          description: 'Optional time range to filter results within each day',
        },
        slotDurationMinutes: {
          type: 'number',
          description: 'Duration of each time slot in minutes (default: 30)',
        },
      },
      required: ['teamNames', 'dateRange'],
      additionalProperties: false,
    },
    function: async (args: {
      teamNames: string[];
      dateRange: { start: string; end: string };
      timeRange?: { start: string; end: string };
      slotDurationMinutes?: number;
    }): Promise<StandardActionResult<GetTeamAvailabilityOutput>> => {
      const { teamNames, dateRange, timeRange, slotDurationMinutes = 30 } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<
        GetTeamAvailabilityOutput,
        ServiceResponse<GetTeamAvailabilityOutput>
      >(
        'nylasGetTeamAvailability',
        async () => {
          // 1. Resolve team names to IDs
          const teamIds = await resolveTeamIds(context.companyId!, teamNames);

          // 2. Build ISO timestamps
          let startIso = `${dateRange.start}T00:00:00Z`;
          let endIso = `${dateRange.end}T23:59:59Z`;

          if (timeRange) {
            startIso = `${dateRange.start}T${timeRange.start}:00Z`;
            endIso = `${dateRange.end}T${timeRange.end}:00Z`;
          }

          // 3. Get availability
          const result = await getTeamAvailability({
            companyId: context.companyId!,
            teamIds,
            startIso,
            endIso,
            slotDurationMinutes,
          });

          return {
            success: true,
            data: result,
            description: `Checked availability for ${teamNames.join(', ')}`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  // ==========================================
  // Action: Find Optimal Meeting Slots
  // ==========================================
  nylasFindOptimalSlots: {
    description:
      'Find the best meeting times when all or most team members are available.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        teamNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of teams to include',
        },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO)' },
            end: { type: 'string', description: 'End date (ISO)' },
          },
          required: ['start', 'end'],
        },
        requireAllFree: {
          type: 'boolean',
          description: 'If true, only return slots where everyone is free (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of slots to return (default: 10)',
        },
      },
      required: ['teamNames', 'dateRange'],
      additionalProperties: false,
    },
    function: async (args: {
      teamNames: string[];
      dateRange: { start: string; end: string };
      requireAllFree?: boolean;
      limit?: number;
    }): Promise<
      StandardActionResult<{
        success: boolean;
        optimalSlots: any[];
        summary: string;
      }>
    > => {
      const {
        teamNames,
        dateRange,
        requireAllFree = true,
        limit = 10,
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'nylasFindOptimalSlots',
        async () => {
          // 1. Get full availability
          const teamIds = await resolveTeamIds(context.companyId!, teamNames);

          const availability = await getTeamAvailability({
            companyId: context.companyId!,
            teamIds,
            startIso: `${dateRange.start}T00:00:00Z`,
            endIso: `${dateRange.end}T23:59:59Z`,
            slotDurationMinutes: 30,
          });

          if (!availability.success) {
            return {
              success: false,
              data: {
                success: false,
                optimalSlots: [],
                summary: 'Failed to retrieve availability',
              },
            };
          }

          // 2. Find optimal slots
          const optimalSlots = findOptimalSlots(
            availability.data.slots,
            { requireAllFree, limit }
          ).map(summarizeSlot);

          // 3. Build summary
          const summary = optimalSlots.length > 0
            ? `Found ${optimalSlots.length} slots where ${requireAllFree ? 'everyone' : 'most people'} are free`
            : 'No available slots found';

          return {
            success: true,
            data: {
              success: true,
              optimalSlots,
              summary,
            },
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },
});
