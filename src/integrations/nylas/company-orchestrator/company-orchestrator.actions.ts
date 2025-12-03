/**
 * Company-Wide Calendar Admin Actions
 *
 * High-level AI actions that leverage the three-agent architecture
 * (Contacts, Calendar, Email) for company-wide meeting coordination.
 *
 * Multi-Grant Admin Pattern:
 * - Each employee OAuth connects their calendar
 * - AI queries all grants in parallel
 * - Acts "on behalf of" using individual grants
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../../actions/types';
import { executeAction } from '../../actions/executor';
import { ActionValidationError } from '../../../utils/actionErrors';
import {
  scheduleMeetingSafe,
  findAvailabilityAndScheduleSafe,
  type Result,
} from '../services/meeting-orchestrator.service';
import {
  getCompanyScheduleSnapshot,
  getConnectionStats,
} from '../services/company-calendar.service';
import { checkAvailabilityForUsers } from '../agents/calendar-agent.service';
import type { MeetingPayload } from '../agents/calendar-agent.service';

const SERVICE_NAME = 'nylasCompanyOrchestrator';

// ==========================================
// Type Definitions
// ==========================================

interface ScheduleMeetingParams {
  participantEmails: string[];
  subject: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  locationType?: 'video' | 'physical' | 'phone';
  videoProvider?: 'google_meet' | 'zoom' | 'teams';
  physicalAddress?: string;
  dialIn?: string;
}

interface CompanyScheduleSnapshot {
  date: string;
  employees: Array<{
    email: string;
    name: string;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      status: string;
    }>;
    utilization: number;
  }>;
  companyUtilization: number;
}

interface AvailableEmployeesResult {
  available_employees: string[];
  total_checked: number;
  time_range: {
    start: string;
    end: string;
  };
}

// ==========================================
// Helper Functions
// ==========================================

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateISODateTime = (dateTime: string): boolean => {
  const date = new Date(dateTime);
  return !isNaN(date.getTime());
};

// ==========================================
// Actions
// ==========================================

export const createCompanyOrchestratorActions = (
  context: ActionContext
): FunctionFactory => ({
  /**
   * Schedule meeting with multiple participants (company-wide admin)
   * Uses three-agent architecture: Contacts → Calendar → Email
   */
  nylasScheduleMeetingWithTeam: {
    description:
      'Schedule a meeting with multiple participants (2-50 people) using company-wide calendar admin. ' +
      'Automatically enriches with contact data, creates calendar event, and sends email invitations. ' +
      'Organizer must have their calendar connected. Supports video conferencing with auto-generated join URLs.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        participantEmails: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Email addresses of all participants (2-50 people recommended)',
        },
        subject: {
          type: 'string',
          description: 'Meeting subject/title (e.g., "Q4 Planning Meeting")',
        },
        description: {
          type: 'string',
          description: 'Meeting agenda or description (optional)',
        },
        startTime: {
          type: 'string',
          description: 'Meeting start time in ISO 8601 format (e.g., "2024-12-15T14:00:00Z")',
        },
        endTime: {
          type: 'string',
          description: 'Meeting end time in ISO 8601 format (e.g., "2024-12-15T15:00:00Z")',
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone (e.g., "America/New_York", "Europe/London"). Default: UTC',
        },
        locationType: {
          type: 'string',
          enum: ['video', 'physical', 'phone'],
          description: 'Meeting location type. Default: video',
        },
        videoProvider: {
          type: 'string',
          enum: ['google_meet', 'zoom', 'teams'],
          description: 'Video conference provider (for video meetings). Default: google_meet',
        },
        physicalAddress: {
          type: 'string',
          description: 'Physical address (for in-person meetings)',
        },
        dialIn: {
          type: 'string',
          description: 'Dial-in number (for phone meetings)',
        },
      },
      required: ['participantEmails', 'subject', 'startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (
      args: ScheduleMeetingParams
    ): Promise<StandardActionResult<MeetingPayload>> => {
      const {
        participantEmails,
        subject,
        description,
        startTime,
        endTime,
        timezone = 'UTC',
        locationType = 'video',
        videoProvider = 'google_meet',
        physicalAddress,
        dialIn,
      } = args;

      // Validation
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context');
      }

      if (!context.userEmail) {
        throw new ActionValidationError('User email is missing from context (organizer email required)');
      }

      if (participantEmails.length === 0) {
        throw new ActionValidationError('At least one participant email is required');
      }

      if (participantEmails.length > 100) {
        throw new ActionValidationError('Maximum 100 participants allowed (Nylas API limit)');
      }

      // Validate emails
      const invalidEmails = participantEmails.filter((email) => !validateEmail(email));
      if (invalidEmails.length > 0) {
        throw new ActionValidationError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Validate datetime
      if (!validateISODateTime(startTime) || !validateISODateTime(endTime)) {
        throw new ActionValidationError('Invalid datetime format. Use ISO 8601 format.');
      }

      return executeAction(
        'nylasScheduleMeetingWithTeam',
        async () => {
          const result = await scheduleMeetingSafe({
            companyId: context.companyId!,
            organizer: {
              name: context.userName || 'Meeting Organizer',
              email: context.userEmail!,
            },
            participants: participantEmails.map((email) => ({
              name: email.split('@')[0], // Fallback name from email
              email,
            })),
            subject,
            description,
            time: { start: startTime, end: endTime, timezone },
            location: {
              type: locationType,
              provider: videoProvider,
              physical_address: physicalAddress,
              dial_in: dialIn,
            },
          });

          if (!result.ok) {
            const err = (result as { ok: false; error: Error }).error;
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
              success: false,
              error: errorMsg,
              description: `Failed to schedule meeting: ${errorMsg}`,
            };
          }

          return {
            success: true,
            data: result.value,
            description: `Successfully scheduled meeting "${subject}" with ${participantEmails.length} participants. ` +
              `Event ID: ${result.value.calendar?.calendar_event_id || 'pending'}, ` +
              `Email sent: ${result.value.email?.message_id ? 'Yes' : 'No'}`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  /**
   * Find available time slots and schedule meeting automatically
   */
  nylasFindAvailabilityAndSchedule: {
    description:
      'Find available time slots for multiple participants and automatically schedule the first available slot. ' +
      'Checks availability across all participants in parallel. Returns available slots even if scheduling fails.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        participantEmails: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses of all participants',
        },
        subject: {
          type: 'string',
          description: 'Meeting subject/title',
        },
        description: {
          type: 'string',
          description: 'Meeting agenda or description (optional)',
        },
        durationMinutes: {
          type: 'number',
          description: 'Meeting duration in minutes (e.g., 30, 60, 90)',
        },
        searchStartTime: {
          type: 'string',
          description: 'Start of time range to search (ISO 8601)',
        },
        searchEndTime: {
          type: 'string',
          description: 'End of time range to search (ISO 8601)',
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone (e.g., "America/New_York"). Default: UTC',
        },
        locationType: {
          type: 'string',
          enum: ['video', 'physical', 'phone'],
          description: 'Meeting location type. Default: video',
        },
        videoProvider: {
          type: 'string',
          enum: ['google_meet', 'zoom', 'teams'],
          description: 'Video conference provider. Default: google_meet',
        },
      },
      required: [
        'participantEmails',
        'subject',
        'durationMinutes',
        'searchStartTime',
        'searchEndTime',
      ],
      additionalProperties: false,
    },
    function: async (args: {
      participantEmails: string[];
      subject: string;
      description?: string;
      durationMinutes: number;
      searchStartTime: string;
      searchEndTime: string;
      timezone?: string;
      locationType?: string;
      videoProvider?: string;
    }): Promise<StandardActionResult<any>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context');
      }

      if (!context.userEmail) {
        throw new ActionValidationError('User email is missing from context');
      }

      return executeAction(
        'nylasFindAvailabilityAndSchedule',
        async () => {
          const result = await findAvailabilityAndScheduleSafe({
            companyId: context.companyId!,
            organizer: {
              name: context.userName || 'Meeting Organizer',
              email: context.userEmail!,
            },
            participantEmails: args.participantEmails,
            duration_minutes: args.durationMinutes,
            date_preferences: [
              { start: args.searchStartTime, end: args.searchEndTime },
            ],
            timezone: args.timezone || 'UTC',
            subject: args.subject,
            description: args.description,
            location: {
              type: args.locationType || 'video',
              provider: args.videoProvider || 'google_meet',
            },
          });

          if (!result.ok) {
            const err = (result as { ok: false; error: Error }).error;
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
              success: false,
              error: errorMsg,
              description: `Failed to find availability: ${errorMsg}`,
            };
          }

          const { available_slots, scheduled_meeting } = result.value;

          if (scheduled_meeting) {
            return {
              success: true,
              data: {
                available_slots,
                scheduled_meeting,
                slot_selected: {
                  start: scheduled_meeting.time.start,
                  end: scheduled_meeting.time.end,
                },
              },
              description: `Found ${available_slots.length} available slots. ` +
                `Scheduled meeting "${args.subject}" at ${scheduled_meeting.time.start}.`,
            };
          } else {
            return {
              success: true,
              data: {
                available_slots,
                scheduled_meeting: null,
              },
              description: `Found ${available_slots.length} available slots but did not schedule meeting.`,
            };
          }
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  /**
   * Get full company calendar snapshot for specific date
   */
  nylasGetCompanySchedule: {
    description:
      'Get full company calendar snapshot for a specific date. Shows all employees, their events, ' +
      'and utilization metrics. Useful for understanding company-wide availability and meeting load.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (e.g., "2024-12-15")',
        },
      },
      required: ['date'],
      additionalProperties: false,
    },
    function: async (args: {
      date: string;
    }): Promise<StandardActionResult<CompanyScheduleSnapshot>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context');
      }

      return executeAction(
        'nylasGetCompanySchedule',
        async () => {
          const snapshot = await getCompanyScheduleSnapshot(
            context.companyId!,
            args.date
          );

          return {
            success: true,
            data: snapshot,
            description: `Company schedule for ${args.date}: ${snapshot.employees.length} employees, ` +
              `${snapshot.companyUtilization}% average utilization.`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  /**
   * Find which employees are available during specific time range
   */
  nylasFindAvailableEmployees: {
    description:
      'Find which employees are available (not busy) during a specific time range. ' +
      'Queries all company calendars in parallel. Useful for finding who can attend an ad-hoc meeting.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        startTime: {
          type: 'string',
          description: 'Start time (ISO 8601 format)',
        },
        endTime: {
          type: 'string',
          description: 'End time (ISO 8601 format)',
        },
      },
      required: ['startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      startTime: string;
      endTime: string;
    }): Promise<StandardActionResult<AvailableEmployeesResult>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context');
      }

      return executeAction(
        'nylasFindAvailableEmployees',
        async () => {
          // Get all company employees
          const { NylasAccount } = await import('../models/NylasAccount');
          const accounts = await NylasAccount.find({
            companyId: context.companyId,
            status: 'active',
          });

          if (accounts.length === 0) {
            return {
              success: true,
              data: {
                available_employees: [],
                total_checked: 0,
                time_range: { start: args.startTime, end: args.endTime },
              },
              description: 'No employees have connected their calendars yet.',
            };
          }

          // Calculate duration for availability check
          const durationMs =
            new Date(args.endTime).getTime() -
            new Date(args.startTime).getTime();
          const durationMinutes = Math.floor(durationMs / 60000);

          // Check availability
          const availableSlots = await checkAvailabilityForUsers({
            companyId: context.companyId!,
            userEmails: accounts.map((a) => a.emailAddress),
            duration_minutes: durationMinutes,
            start_time: args.startTime,
            end_time: args.endTime,
          });

          // Get employees available for the ENTIRE duration
          const availableEmployees =
            availableSlots.length > 0 && availableSlots[0].all_available
              ? availableSlots[0].available_participants
              : [];

          return {
            success: true,
            data: {
              available_employees: availableEmployees,
              total_checked: accounts.length,
              time_range: { start: args.startTime, end: args.endTime },
            },
            description: `Found ${availableEmployees.length}/${accounts.length} employees available ` +
              `from ${args.startTime} to ${args.endTime}.`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },

  /**
   * Get company calendar connection statistics
   */
  nylasGetConnectionStats: {
    description:
      'Get statistics about how many employees have connected their calendars. ' +
      'Shows total employees, connected, disconnected, and connection rate percentage.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<any>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context');
      }

      return executeAction(
        'nylasGetConnectionStats',
        async () => {
          const stats = await getConnectionStats(context.companyId!);

          return {
            success: true,
            data: stats,
            description: `${stats.connected}/${stats.total_employees} employees connected (${stats.connection_rate}%). ` +
              `${stats.disconnected} employees need to connect their calendars.`,
          };
        },
        { serviceName: SERVICE_NAME }
      );
    },
  },
});
