/**
 * Team Meeting Actions
 *
 * AI-callable actions for creating multi-user meetings
 * Compact functional style with composition
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../../actions/types';
import {
  createTeamMeeting,
  createWeeklyTeamMeeting,
  CreateTeamMeetingOutput,
} from '../services/team-meeting.service';
import { executeAction } from '../../actions/executor';
import { ActionValidationError } from '../../../utils/actionErrors';
import { Team } from '../../../models/Team';
import { EmailProfile } from '../models/EmailProfile';
import { Types } from 'mongoose';

const SERVICE_NAME = 'teamOrchestrationService';

// ==========================================
// Types
// ==========================================

interface ServiceResponse<T> {
  success: boolean;
  data: T;
  description?: string;
}

// ==========================================
// Resolution Helpers (Functional)
// ==========================================

const resolveTeamIds = async (
  companyId: string,
  teamNames: string[]
): Promise<string[]> =>
  Team.find({
    companyId: new Types.ObjectId(companyId),
    name: { $in: teamNames },
    isActive: true,
  }).then((teams) => {
    if (teams.length === 0) {
      throw new ActionValidationError(
        `No active teams found: ${teamNames.join(', ')}`
      );
    }
    return teams.map((t) => t._id.toString());
  });

const resolveOrganizerProfileId = async (
  companyId: string,
  profileLabel: string
): Promise<string> =>
  EmailProfile.findOne({
    companyId: new Types.ObjectId(companyId),
    label: profileLabel,
    isActive: true,
  }).then((profile) => {
    if (!profile) {
      throw new ActionValidationError(
        `Email profile not found: ${profileLabel}`
      );
    }
    return profile._id.toString();
  });

// ==========================================
// Recurrence Mapping
// ==========================================

const mapRecurrenceToConfig = (
  frequency: string,
  occurrences?: number
) => {
  const freqMap: { [key: string]: 'daily' | 'weekly' | 'monthly' } = {
    daily: 'daily',
    weekly: 'weekly',
    biweekly: 'weekly',
    monthly: 'monthly',
  };

  const mapped = freqMap[frequency.toLowerCase()] || 'weekly';

  return {
    frequency: mapped,
    interval: frequency.toLowerCase() === 'biweekly' ? 2 : 1,
    count: occurrences,
  };
};

// ==========================================
// Actions
// ==========================================

export const createTeamMeetingActions = (
  context: ActionContext
): FunctionFactory => ({
  // ==========================================
  // Action: Create Team Meeting
  // ==========================================
  nylasCreateTeamMeeting: {
    description:
      'Schedule a meeting with multiple teams and external contacts. Supports recurring meetings.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        organizerProfile: {
          type: 'string',
          description: 'Label of email profile to use as organizer (e.g., "Regulatory Team IL")',
        },
        teams: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of teams to invite (e.g., ["Regulatory", "Design"])',
        },
        externalContacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['name', 'email'],
          },
          description: 'External contacts to invite',
        },
        meetingDetails: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Meeting title',
            },
            description: {
              type: 'string',
              description: 'Meeting description/agenda',
            },
            location: {
              type: 'string',
              description: 'Meeting location or video link',
            },
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            startTime: {
              type: 'string',
              description: 'Start time in HH:MM format (24-hour)',
            },
            durationMinutes: {
              type: 'number',
              description: 'Meeting duration in minutes',
            },
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., "Europe/Berlin", "America/New_York")',
            },
          },
          required: [
            'title',
            'startDate',
            'startTime',
            'durationMinutes',
            'timezone',
          ],
        },
        recurrence: {
          type: 'object',
          properties: {
            frequency: {
              type: 'string',
              enum: ['daily', 'weekly', 'biweekly', 'monthly'],
              description: 'How often the meeting repeats',
            },
            occurrences: {
              type: 'number',
              description: 'Number of times to repeat (e.g., 12 for 12 weeks)',
            },
          },
          description: 'Optional recurrence configuration',
        },
      },
      required: ['organizerProfile', 'meetingDetails'],
      additionalProperties: false,
    },
    function: async (args: {
      organizerProfile: string;
      teams?: string[];
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
      recurrence?: {
        frequency: string;
        occurrences?: number;
      };
    }): Promise<StandardActionResult<CreateTeamMeetingOutput>> => {
      const {
        organizerProfile,
        teams = [],
        externalContacts = [],
        meetingDetails,
        recurrence,
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<
        CreateTeamMeetingOutput,
        ServiceResponse<CreateTeamMeetingOutput>
      >(
        'nylasCreateTeamMeeting',
        async () => {
          // 1. Resolve organizer profile ID
          const organizerProfileId = await resolveOrganizerProfileId(
            context.companyId!,
            organizerProfile
          );

          // 2. Resolve team IDs (if any)
          const teamIds =
            teams.length > 0
              ? await resolveTeamIds(context.companyId!, teams)
              : [];

          // 3. Build recurrence config (if provided)
          const recurrenceConfig = recurrence
            ? mapRecurrenceToConfig(recurrence.frequency, recurrence.occurrences)
            : undefined;

          // 4. Create meeting
          const result = await createTeamMeeting({
            companyId: context.companyId!,
            organizerProfileId,
            teamIds,
            externalContacts,
            meetingDetails,
            recurrence: recurrenceConfig,
          });

          if (!result.success) {
            return {
              success: false,
              data: result,
              description: result.error || 'Failed to create meeting',
            };
          }

          // 5. Build description
          const attendeeCount =
            (result.data?.attendees.length || 0) +
            1; // +1 for organizer
          const recurrenceDesc = recurrence
            ? ` (${recurrence.frequency}, ${recurrence.occurrences} times)`
            : '';

          return {
            success: true,
            data: result,
            description: `Created meeting "${meetingDetails.title}" with ${attendeeCount} attendees${recurrenceDesc}`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  // ==========================================
  // Action: Quick Weekly Team Sync
  // ==========================================
  nylasCreateWeeklyTeamSync: {
    description:
      'Quickly create a recurring weekly sync for team(s). Simplified version of nylasCreateTeamMeeting.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        organizerProfile: {
          type: 'string',
          description: 'Email profile label for organizer',
        },
        teams: {
          type: 'array',
          items: { type: 'string' },
          description: 'Team names to invite',
        },
        title: {
          type: 'string',
          description: 'Meeting title',
        },
        dayOfWeek: {
          type: 'string',
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          description: 'Day of week for the meeting',
        },
        startTime: {
          type: 'string',
          description: 'Start time in HH:MM format',
        },
        durationMinutes: {
          type: 'number',
          description: 'Meeting duration in minutes',
        },
        weeks: {
          type: 'number',
          description: 'Number of weeks to repeat',
        },
        timezone: {
          type: 'string',
          description: 'Timezone',
        },
      },
      required: [
        'organizerProfile',
        'teams',
        'title',
        'dayOfWeek',
        'startTime',
        'durationMinutes',
        'weeks',
        'timezone',
      ],
      additionalProperties: false,
    },
    function: async (args: {
      organizerProfile: string;
      teams: string[];
      title: string;
      dayOfWeek: string;
      startTime: string;
      durationMinutes: number;
      weeks: number;
      timezone: string;
    }): Promise<StandardActionResult<CreateTeamMeetingOutput>> => {
      const {
        organizerProfile,
        teams,
        title,
        dayOfWeek,
        startTime,
        durationMinutes,
        weeks,
        timezone,
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction(
        'nylasCreateWeeklyTeamSync',
        async () => {
          // 1. Calculate next occurrence of dayOfWeek
          const dayMap: { [key: string]: number } = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
          };

          const targetDay = dayMap[dayOfWeek];
          const today = new Date();
          const currentDay = today.getDay();
          const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;

          const startDate = new Date(today);
          startDate.setDate(today.getDate() + daysUntilTarget);
          const startDateStr = startDate.toISOString().split('T')[0];

          // 2. Resolve IDs
          const organizerProfileId = await resolveOrganizerProfileId(
            context.companyId!,
            organizerProfile
          );

          const teamIds = await resolveTeamIds(context.companyId!, teams);

          // 3. Create weekly meeting
          const result = await createWeeklyTeamMeeting({
            companyId: context.companyId!,
            organizerProfileId,
            teamIds,
            meetingDetails: {
              title,
              startDate: startDateStr,
              startTime,
              durationMinutes,
              timezone,
            },
            weeks,
          });

          return {
            success: true,
            data: result,
            description: `Created weekly "${title}" on ${dayOfWeek}s for ${weeks} weeks`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },
});
