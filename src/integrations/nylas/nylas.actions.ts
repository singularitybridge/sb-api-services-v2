import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  getEmails as getEmailsService,
  getEmailById as getEmailByIdService,
  sendEmail as sendEmailService,
  getCalendarEvents as getCalendarEventsService,
  createCalendarEvent as createCalendarEventService,
  getGrants as getGrantsService,
  // Advanced calendar management
  getEventById as getEventByIdService,
  updateCalendarEvent as updateCalendarEventService,
  deleteCalendarEvent as deleteCalendarEventService,
  getFreeBusy as getFreeBusyService,
  findAvailableSlots as findAvailableSlotsService,
  createMultipleEvents as createMultipleEventsService,
  checkEventConflicts as checkEventConflictsService,
} from './nylas.service';
import { createContactActions } from './contacts/contacts.actions';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

const SERVICE_NAME = 'nylasService';

// Response interfaces
interface EmailData {
  id: string;
  from: { email: string; name?: string }[];
  to: { email: string; name?: string }[];
  subject: string;
  body?: string;
  snippet?: string;
  date: number;
  unread: boolean;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime: number;
  participants?: { email: string }[];
}

interface GrantData {
  id: string;
  provider: string;
  email: string;
}

interface ServiceCallLambdaResponse<T> {
  success: boolean;
  data: T;
  description?: string;
}

export const createNylasActions = (
  context: ActionContext,
): FunctionFactory => ({
  // Get emails
  nylasGetEmails: {
    description:
      'Retrieve emails from a team member\'s connected email account. Specify userEmail to access a specific user\'s mailbox.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose emails to access. If not provided, uses company default.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 10)',
        },
        unread: {
          type: 'boolean',
          description: 'Filter to only return unread emails',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      limit?: number;
      unread?: boolean;
    }): Promise<StandardActionResult<EmailData[]>> => {
      const { userEmail, limit = 10, unread = false } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<EmailData[], ServiceCallLambdaResponse<EmailData[]>>(
        'nylasGetEmails',
        async () => {
          const emails = await getEmailsService(context.companyId!, {
            limit,
            unread,
            userEmail,
          });
          return {
            success: true,
            data: emails.map((e) => ({
              id: e.id,
              from: e.from,
              to: e.to,
              subject: e.subject,
              snippet: e.snippet,
              date: e.date,
              unread: e.unread,
            })),
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get single email by ID
  nylasGetEmail: {
    description:
      'Retrieve a specific email by its ID, including the full body content. Specify userEmail to access a specific user\'s mailbox.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email message to retrieve',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose mailbox to access. If not provided, uses company default.',
        },
      },
      required: ['messageId'],
      additionalProperties: false,
    },
    function: async (args: {
      messageId: string;
      userEmail?: string;
    }): Promise<StandardActionResult<EmailData>> => {
      const { messageId, userEmail } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!messageId || typeof messageId !== 'string') {
        throw new ActionValidationError('messageId is required');
      }

      return executeAction<EmailData, ServiceCallLambdaResponse<EmailData>>(
        'nylasGetEmail',
        async () => {
          const email = await getEmailByIdService(
            context.companyId!,
            messageId,
            userEmail,
          );
          return {
            success: true,
            data: {
              id: email.id,
              from: email.from,
              to: email.to,
              subject: email.subject,
              body: email.body,
              snippet: email.snippet,
              date: email.date,
              unread: email.unread,
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Send email
  nylasSendEmail: {
    description: 'Send an email using a team member\'s connected email account. Specify userEmail to send from a specific user\'s mailbox.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose account to send from. If not provided, uses company default.',
        },
        to: {
          type: 'string',
          description:
            'Recipient email address. For multiple recipients, use comma-separated values.',
        },
        subject: {
          type: 'string',
          description: 'The subject of the email',
        },
        body: {
          type: 'string',
          description: 'The body content of the email (can be HTML)',
        },
        cc: {
          type: 'string',
          description:
            'CC recipients (optional). For multiple, use comma-separated values.',
        },
        bcc: {
          type: 'string',
          description:
            'BCC recipients (optional). For multiple, use comma-separated values.',
        },
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }): Promise<StandardActionResult<{ id: string; thread_id: string }>> => {
      const { userEmail, to, subject, body, cc, bcc } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const toEmails = to.split(',').map((e) => e.trim());
      for (const email of toEmails) {
        if (!emailRegex.test(email)) {
          throw new ActionValidationError(`Invalid email address: ${email}`);
        }
      }

      if (!subject || typeof subject !== 'string' || subject.trim() === '') {
        throw new ActionValidationError('Subject is required');
      }

      if (!body || typeof body !== 'string' || body.trim() === '') {
        throw new ActionValidationError('Body is required');
      }

      return executeAction<
        { id: string; thread_id: string },
        ServiceCallLambdaResponse<{ id: string; thread_id: string }>
      >(
        'nylasSendEmail',
        async () => {
          const result = await sendEmailService(context.companyId!, {
            to: toEmails,
            subject,
            body,
            cc: cc ? cc.split(',').map((e) => e.trim()) : undefined,
            bcc: bcc ? bcc.split(',').map((e) => e.trim()) : undefined,
            userEmail,
          });
          return { success: true, data: result };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get calendar events
  nylasGetCalendarEvents: {
    description:
      'Retrieve calendar events from a team member\'s connected calendar. Specify userEmail to access a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to access. If not provided, uses company default.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (default: 20)',
        },
        start: {
          type: 'number',
          description:
            'Start time as Unix timestamp to filter events (optional)',
        },
        end: {
          type: 'number',
          description: 'End time as Unix timestamp to filter events (optional)',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      limit?: number;
      start?: number;
      end?: number;
    }): Promise<StandardActionResult<EventData[]>> => {
      const { userEmail, limit = 20, start, end } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<EventData[], ServiceCallLambdaResponse<EventData[]>>(
        'nylasGetCalendarEvents',
        async () => {
          const events = await getCalendarEventsService(context.companyId!, {
            limit,
            start,
            end,
            userEmail,
          });
          return {
            success: true,
            data: events.map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description,
              location: e.location,
              startTime: e.when.start_time,
              endTime: e.when.end_time,
              participants: e.participants,
            })),
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Create calendar event
  nylasCreateCalendarEvent: {
    description: 'Create a new calendar event on a team member\'s connected calendar. Specify userEmail to create on a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to create the event on. If not provided, uses company default.',
        },
        title: {
          type: 'string',
          description: 'The title of the event',
        },
        description: {
          type: 'string',
          description: 'Description or notes for the event (optional)',
        },
        startTime: {
          type: 'string',
          description:
            'Start time in ISO 8601 format (e.g., "2024-01-15T10:00:00Z")',
        },
        endTime: {
          type: 'string',
          description:
            'End time in ISO 8601 format (e.g., "2024-01-15T11:00:00Z")',
        },
        participants: {
          type: 'string',
          description:
            'Comma-separated email addresses of participants (optional)',
        },
        location: {
          type: 'string',
          description: 'Location of the event (optional)',
        },
      },
      required: ['title', 'startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      participants?: string;
      location?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { userEmail, title, description, startTime, endTime, participants, location } =
        args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new ActionValidationError('Title is required');
      }

      if (!startTime || !endTime) {
        throw new ActionValidationError('Start time and end time are required');
      }

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasCreateCalendarEvent',
        async () => {
          const event = await createCalendarEventService(context.companyId!, {
            title,
            description,
            startTime,
            endTime,
            participants: participants
              ? participants.split(',').map((e) => e.trim())
              : undefined,
            location,
            userEmail,
          });
          return {
            success: true,
            data: {
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              startTime: event.when.start_time,
              endTime: event.when.end_time,
              participants: event.participants,
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get connected grants (accounts)
  nylasGetGrants: {
    description: 'Get list of connected email/calendar accounts (grants).',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<GrantData[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<GrantData[], ServiceCallLambdaResponse<GrantData[]>>(
        'nylasGetGrants',
        async () => {
          const grants = await getGrantsService(context.companyId!);
          return { success: true, data: grants };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // ADVANCED CALENDAR MANAGEMENT ACTIONS
  // ==========================================

  // Get specific event by ID
  nylasGetEvent: {
    description:
      'Retrieve a specific calendar event by its ID with full details. Specify userEmail to access a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the calendar event to retrieve',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to access. If not provided, uses company default.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      userEmail?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { eventId, userEmail } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!eventId || typeof eventId !== 'string') {
        throw new ActionValidationError('eventId is required');
      }

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasGetEvent',
        async () => {
          const event = await getEventByIdService(context.companyId!, eventId, userEmail);
          return {
            success: true,
            data: {
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              startTime: event.when.start_time,
              endTime: event.when.end_time,
              participants: event.participants,
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Update existing event
  nylasUpdateEvent: {
    description:
      'Update an existing calendar event (move, reschedule, or modify details). Specify userEmail to access a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to update',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to access. If not provided, uses company default.',
        },
        title: {
          type: 'string',
          description: 'New title for the event (optional)',
        },
        description: {
          type: 'string',
          description: 'New description (optional)',
        },
        location: {
          type: 'string',
          description: 'New location (optional)',
        },
        startTime: {
          type: 'string',
          description: 'New start time in ISO 8601 format (optional)',
        },
        endTime: {
          type: 'string',
          description: 'New end time in ISO 8601 format (optional)',
        },
        participants: {
          type: 'string',
          description: 'Comma-separated emails of new participants (optional)',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      userEmail?: string;
      title?: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      participants?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const {
        eventId,
        userEmail,
        title,
        description,
        location,
        startTime,
        endTime,
        participants,
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasUpdateEvent',
        async () => {
          const event = await updateCalendarEventService(
            context.companyId!,
            eventId,
            {
              title,
              description,
              location,
              startTime,
              endTime,
              participants: participants
                ? participants.split(',').map((e) => e.trim())
                : undefined,
              userEmail,
            },
          );
          return {
            success: true,
            data: {
              id: event.id,
              title: event.title,
              description: event.description,
              location: event.location,
              startTime: event.when.start_time,
              endTime: event.when.end_time,
              participants: event.participants,
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Delete event
  nylasDeleteEvent: {
    description: 'Delete a calendar event permanently. Specify userEmail to access a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to delete',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to access. If not provided, uses company default.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      userEmail?: string;
    }): Promise<StandardActionResult<{ deleted: boolean }>> => {
      const { eventId, userEmail } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      return executeAction<
        { deleted: boolean },
        ServiceCallLambdaResponse<{ deleted: boolean }>
      >(
        'nylasDeleteEvent',
        async () => {
          await deleteCalendarEventService(context.companyId!, eventId, userEmail);
          return { success: true, data: { deleted: true } };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Find available time slots
  nylasFindAvailableSlots: {
    description:
      'Intelligently find available time slots for a meeting. Returns ranked slots based on optimal scheduling (morning priority, good spacing, mid-week preference). Specify userEmail to check a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to check. If not provided, uses company default.',
        },
        durationMinutes: {
          type: 'number',
          description: 'Meeting duration in minutes',
        },
        dateRangeStart: {
          type: 'string',
          description:
            'Start date for search in ISO 8601 format (e.g., "2024-01-15T00:00:00Z")',
        },
        dateRangeEnd: {
          type: 'string',
          description: 'End date for search in ISO 8601 format',
        },
        preferredTimeStart: {
          type: 'string',
          description:
            'Preferred start time of day in HH:MM format (default: "09:00")',
        },
        preferredTimeEnd: {
          type: 'string',
          description:
            'Preferred end time of day in HH:MM format (default: "17:00")',
        },
        participants: {
          type: 'string',
          description:
            'Comma-separated email addresses to check availability (optional)',
        },
        bufferMinutes: {
          type: 'number',
          description: 'Buffer time between meetings in minutes (default: 15)',
        },
      },
      required: ['durationMinutes', 'dateRangeStart', 'dateRangeEnd'],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      durationMinutes: number;
      dateRangeStart: string;
      dateRangeEnd: string;
      preferredTimeStart?: string;
      preferredTimeEnd?: string;
      participants?: string;
      bufferMinutes?: number;
    }): Promise<StandardActionResult<any[]>> => {
      const {
        userEmail,
        durationMinutes,
        dateRangeStart,
        dateRangeEnd,
        preferredTimeStart,
        preferredTimeEnd,
        participants,
        bufferMinutes,
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!durationMinutes || durationMinutes <= 0) {
        throw new ActionValidationError('durationMinutes must be positive');
      }

      return executeAction<any[], ServiceCallLambdaResponse<any[]>>(
        'nylasFindAvailableSlots',
        async () => {
          const startTimestamp = Math.floor(
            new Date(dateRangeStart).getTime() / 1000,
          );
          const endTimestamp = Math.floor(
            new Date(dateRangeEnd).getTime() / 1000,
          );

          const slots = await findAvailableSlotsService(context.companyId!, {
            durationMinutes,
            dateRangeStart: startTimestamp,
            dateRangeEnd: endTimestamp,
            preferredTimeStart,
            preferredTimeEnd,
            participants: participants
              ? participants.split(',').map((e) => e.trim())
              : undefined,
            bufferMinutes,
            userEmail,
          });

          // Convert timestamps back to ISO strings for better readability
          const formattedSlots = slots.map((slot) => ({
            startTime: new Date(slot.start_time * 1000).toISOString(),
            endTime: new Date(slot.end_time * 1000).toISOString(),
            score: slot.score,
            reason: slot.reason,
          }));

          return { success: true, data: formattedSlots };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get free/busy information
  nylasGetFreeBusy: {
    description:
      'Check availability for one or more participants during a specific time range. Returns busy/free time slots. Specify userEmail to use a specific user\'s calendar context.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar context to use. If not provided, uses company default.',
        },
        emails: {
          type: 'string',
          description: 'Comma-separated email addresses to check',
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          description: 'End time in ISO 8601 format',
        },
      },
      required: ['emails', 'startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      emails: string;
      startTime: string;
      endTime: string;
    }): Promise<StandardActionResult<any[]>> => {
      const { userEmail, emails, startTime, endTime } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!emails) {
        throw new ActionValidationError('emails is required');
      }

      return executeAction<any[], ServiceCallLambdaResponse<any[]>>(
        'nylasGetFreeBusy',
        async () => {
          const emailList = emails.split(',').map((e) => e.trim());
          const startTimestamp = Math.floor(
            new Date(startTime).getTime() / 1000,
          );
          const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

          const freeBusyData = await getFreeBusyService(
            context.companyId!,
            emailList,
            startTimestamp,
            endTimestamp,
            userEmail,
          );

          // Format for readability
          const formatted = freeBusyData.map((data) => ({
            email: data.email,
            timeSlots: data.timeSlots.map((slot) => ({
              startTime: new Date(slot.start_time * 1000).toISOString(),
              endTime: new Date(slot.end_time * 1000).toISOString(),
              status: slot.status,
            })),
          }));

          return { success: true, data: formatted };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Check for conflicts
  nylasCheckConflicts: {
    description:
      'Check if a proposed meeting time conflicts with existing events. Suggests alternative times if conflicts are found. Specify userEmail to check a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to check. If not provided, uses company default.',
        },
        startTime: {
          type: 'string',
          description: 'Proposed start time in ISO 8601 format',
        },
        endTime: {
          type: 'string',
          description: 'Proposed end time in ISO 8601 format',
        },
        participants: {
          type: 'string',
          description: 'Comma-separated participant emails to check (optional)',
        },
      },
      required: ['startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      userEmail?: string;
      startTime: string;
      endTime: string;
      participants?: string;
    }): Promise<StandardActionResult<any>> => {
      const { userEmail, startTime, endTime, participants } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasCheckConflicts',
        async () => {
          const startTimestamp = Math.floor(
            new Date(startTime).getTime() / 1000,
          );
          const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

          const result = await checkEventConflictsService(
            context.companyId!,
            startTimestamp,
            endTimestamp,
            participants
              ? participants.split(',').map((e) => e.trim())
              : undefined,
            userEmail,
          );

          // Format response
          const formatted = {
            hasConflict: result.hasConflict,
            conflicts: result.conflicts.map((event) => ({
              id: event.id,
              title: event.title,
              startTime: new Date(event.when.start_time * 1000).toISOString(),
              endTime: new Date(event.when.end_time * 1000).toISOString(),
            })),
            alternatives: result.alternativeSlots?.map((slot) => ({
              startTime: new Date(slot.start_time * 1000).toISOString(),
              endTime: new Date(slot.end_time * 1000).toISOString(),
              score: slot.score,
              reason: slot.reason,
            })),
          };

          return { success: true, data: formatted };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Batch create events
  nylasBatchCreateEvents: {
    description:
      'Create multiple calendar events in one operation. Useful for recurring meetings or batch scheduling.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        events: {
          type: 'string',
          description:
            'JSON array of event objects. Each object should have: title, startTime, endTime, and optionally description, location, participants',
        },
      },
      required: ['events'],
      additionalProperties: false,
    },
    function: async (args: {
      events: string;
    }): Promise<StandardActionResult<any>> => {
      const { events } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!events) {
        throw new ActionValidationError('events is required');
      }

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasBatchCreateEvents',
        async () => {
          const eventList = JSON.parse(events);

          if (!Array.isArray(eventList)) {
            throw new Error('events must be a JSON array');
          }

          const result = await createMultipleEventsService(
            context.companyId!,
            eventList,
          );

          // Format response
          const formatted = {
            success: result.success,
            created: result.created.map((event) => ({
              id: event.id,
              title: event.title,
              startTime: new Date(event.when.start_time * 1000).toISOString(),
              endTime: new Date(event.when.end_time * 1000).toISOString(),
            })),
            failed: result.failed,
            summary: `Created ${result.created.length}/${eventList.length} events. ${result.failed.length} failed.`,
          };

          return { success: true, data: formatted };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Move event (convenience wrapper)
  nylasMoveEvent: {
    description:
      'Move a calendar event to a new time. Optionally checks for conflicts before moving. Specify userEmail to access a specific user\'s calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to move',
        },
        userEmail: {
          type: 'string',
          description: 'Email of the team member whose calendar to access. If not provided, uses company default.',
        },
        newStartTime: {
          type: 'string',
          description: 'New start time in ISO 8601 format',
        },
        newEndTime: {
          type: 'string',
          description: 'New end time in ISO 8601 format',
        },
        checkConflicts: {
          type: 'boolean',
          description:
            'Whether to check for conflicts before moving (default: true)',
        },
      },
      required: ['eventId', 'newStartTime', 'newEndTime'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      userEmail?: string;
      newStartTime: string;
      newEndTime: string;
      checkConflicts?: boolean;
    }): Promise<StandardActionResult<any>> => {
      const { eventId, userEmail, newStartTime, newEndTime, checkConflicts = true } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasMoveEvent',
        async () => {
          // Check for conflicts if requested
          if (checkConflicts) {
            const startTimestamp = Math.floor(
              new Date(newStartTime).getTime() / 1000,
            );
            const endTimestamp = Math.floor(
              new Date(newEndTime).getTime() / 1000,
            );

            const conflictCheck = await checkEventConflictsService(
              context.companyId!,
              startTimestamp,
              endTimestamp,
              undefined,
              userEmail,
            );

            if (conflictCheck.hasConflict) {
              const conflictDetails = {
                hasConflict: true,
                conflicts: conflictCheck.conflicts.map((event) => ({
                  id: event.id,
                  title: event.title,
                  startTime: new Date(
                    event.when.start_time * 1000,
                  ).toISOString(),
                  endTime: new Date(event.when.end_time * 1000).toISOString(),
                })),
                alternatives: conflictCheck.alternativeSlots?.map((slot) => ({
                  startTime: new Date(slot.start_time * 1000).toISOString(),
                  endTime: new Date(slot.end_time * 1000).toISOString(),
                  score: slot.score,
                  reason: slot.reason,
                })),
                message:
                  'The proposed time conflicts with existing events. See alternatives.',
              };
              return { success: true, data: conflictDetails };
            }
          }

          // No conflicts or check disabled, proceed with move
          const event = await updateCalendarEventService(
            context.companyId!,
            eventId,
            {
              startTime: newStartTime,
              endTime: newEndTime,
              userEmail,
            },
          );

          return {
            success: true,
            data: {
              moved: true,
              event: {
                id: event.id,
                title: event.title,
                startTime: new Date(event.when.start_time * 1000).toISOString(),
                endTime: new Date(event.when.end_time * 1000).toISOString(),
              },
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // CONTACT MANAGEMENT ACTIONS
  // ==========================================
  ...createContactActions(context),
});
