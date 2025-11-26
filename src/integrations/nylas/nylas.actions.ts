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
} from './nylas.service';
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

export const createNylasActions = (context: ActionContext): FunctionFactory => ({
  // Get emails
  nylasGetEmails: {
    description:
      'Retrieve emails from the connected email account. Returns a list of emails with subject, sender, and preview.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
      limit?: number;
      unread?: boolean;
    }): Promise<StandardActionResult<EmailData[]>> => {
      const { limit = 10, unread = false } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<EmailData[], ServiceCallLambdaResponse<EmailData[]>>(
        'nylasGetEmails',
        async () => {
          const emails = await getEmailsService(context.companyId!, {
            limit,
            unread,
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
      'Retrieve a specific email by its ID, including the full body content.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email message to retrieve',
        },
      },
      required: ['messageId'],
      additionalProperties: false,
    },
    function: async (args: {
      messageId: string;
    }): Promise<StandardActionResult<EmailData>> => {
      const { messageId } = args;

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
    description: 'Send an email using the connected email account.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
    }): Promise<StandardActionResult<{ id: string; thread_id: string }>> => {
      const { to, subject, body, cc, bcc } = args;

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
      'Retrieve calendar events from the connected calendar account.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
      limit?: number;
      start?: number;
      end?: number;
    }): Promise<StandardActionResult<EventData[]>> => {
      const { limit = 20, start, end } = args;

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
    description: 'Create a new calendar event on the connected calendar.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
      title: string;
      description?: string;
      startTime: string;
      endTime: string;
      participants?: string;
      location?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { title, description, startTime, endTime, participants, location } =
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
});
