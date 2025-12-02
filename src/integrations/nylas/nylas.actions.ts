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
import {
  safeDisconnectWithBackup,
  cleanupRelatedData,
  verifyDeletionSafety,
  rollbackDeletion,
  listBackups,
} from '../../services/nylas-oauth.service';
import { createContactActions } from './contacts/contacts.actions';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { resolveTargetUserGrant } from '../../services/nylas-grant-resolution.service';
import {
  withAdminAudit,
  buildAuditContext,
  shouldSkipAudit,
} from '../../middleware/admin-audit.middleware';
import { validateDateRange, validateEventDate, logDateValidation } from '../../utils/date-validation';

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

export const createNylasActions = (context: ActionContext): FunctionFactory => {
  const actions: FunctionFactory = {
  // Get emails
  nylasGetEmails: {
    description:
      'Retrieve emails from the connected email account. Returns a list of emails with subject, sender, and preview. Admins can access other users\' emails by providing targetEmail.',
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose emails to retrieve (admin only). If not provided, retrieves your own emails.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      unread?: boolean;
      targetEmail?: string;
    }): Promise<StandardActionResult<EmailData[]>> => {
      const { limit = 10, unread = false, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EmailData[], ServiceCallLambdaResponse<EmailData[]>>(
        'nylasGetEmails',
        async () => {
          // Wrap in audit logging if cross-user access
          const fetchEmails = async () => {
            const emails = await getEmailsService(context.companyId!, {
              limit,
              unread,
              grantId,
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
          };

          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetEmails',
              requestParams: { limit, unread, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, fetchEmails);
          }

          return await fetchEmails();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get single email by ID
  nylasGetEmail: {
    description:
      'Retrieve a specific email by its ID, including the full body content. Admins can access other users\' emails by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email message to retrieve',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose email to retrieve (admin only). If not provided, retrieves your own email.',
        },
      },
      required: ['messageId'],
      additionalProperties: false,
    },
    function: async (args: {
      messageId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<EmailData>> => {
      const { messageId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!messageId || typeof messageId !== 'string') {
        throw new ActionValidationError('messageId is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EmailData, ServiceCallLambdaResponse<EmailData>>(
        'nylasGetEmail',
        async () => {
          // Wrap in audit logging if cross-user access
          const fetchEmail = async () => {
            const email = await getEmailByIdService(
              context.companyId!,
              messageId,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetEmail',
              requestParams: { messageId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: messageId,
            });
            return await withAdminAudit(auditContext, fetchEmail);
          }

          return await fetchEmail();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Send email
  nylasSendEmail: {
    description: 'Send an email using the connected email account. Admins can send emails on behalf of other users by providing targetEmail.',
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose account to send from (admin only). If not provided, sends from your own account.',
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
      targetEmail?: string;
    }): Promise<StandardActionResult<{ id: string; thread_id: string }>> => {
      const { to, subject, body, cc, bcc, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
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

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<
        { id: string; thread_id: string },
        ServiceCallLambdaResponse<{ id: string; thread_id: string }>
      >(
        'nylasSendEmail',
        async () => {
          // Wrap in audit logging if cross-user access
          const sendEmail = async () => {
            const result = await sendEmailService(context.companyId!, {
              to: toEmails,
              subject,
              body,
              cc: cc ? cc.split(',').map((e) => e.trim()) : undefined,
              bcc: bcc ? bcc.split(',').map((e) => e.trim()) : undefined,
              grantId,
            });
            return { success: true, data: result };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasSendEmail',
              requestParams: { to, subject, body, cc, bcc, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, sendEmail);
          }

          return await sendEmail();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get calendar events
  nylasGetCalendarEvents: {
    description:
      'Retrieve calendar events from the connected calendar account. Admins can view other users\' calendars by providing targetEmail.',
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to view (admin only). If not provided, views your own calendar.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      start?: number;
      end?: number;
      targetEmail?: string;
    }): Promise<StandardActionResult<EventData[]>> => {
      const { limit = 20, start, end, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EventData[], ServiceCallLambdaResponse<EventData[]>>(
        'nylasGetCalendarEvents',
        async () => {
          // Wrap in audit logging if cross-user access
          const fetchEvents = async () => {
            const events = await getCalendarEventsService(context.companyId!, {
              limit,
              start,
              end,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetCalendarEvents',
              requestParams: { limit, start, end, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, fetchEvents);
          }

          return await fetchEvents();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Create calendar event
  nylasCreateCalendarEvent: {
    description: 'Create a new calendar event on the connected calendar. Admins can create events on other users\' calendars by providing targetEmail.',
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
            'Start time in ISO 8601 format with timezone. MUST be a FUTURE date. Use current year or later. Example: "2025-12-03T13:00:00+02:00"',
        },
        endTime: {
          type: 'string',
          description:
            'End time in ISO 8601 format with timezone. MUST be after startTime. Example: "2025-12-03T14:00:00+02:00"',
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to use (admin only). If not provided, creates on your own calendar.',
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
      targetEmail?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { title, description, startTime, endTime, participants, location, targetEmail } =
        args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new ActionValidationError('Title is required');
      }

      if (!startTime || !endTime) {
        throw new ActionValidationError('Start time and end time are required');
      }

      // Validate dates to prevent AI from creating events with incorrect dates
      const dateValidation = validateDateRange(startTime, endTime);
      logDateValidation('nylasCreateCalendarEvent', startTime, dateValidation);

      if (!dateValidation.isValid) {
        throw new ActionValidationError(dateValidation.error!);
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasCreateCalendarEvent',
        async () => {
          // Wrap in audit logging if cross-user access
          const createEvent = async () => {
            const event = await createCalendarEventService(context.companyId!, {
              title,
              description,
              startTime,
              endTime,
              participants: participants
                ? participants.split(',').map((e) => e.trim())
                : undefined,
              location,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasCreateCalendarEvent',
              requestParams: { title, description, startTime, endTime, participants, location, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, createEvent);
          }

          return await createEvent();
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
    description: 'Retrieve a specific calendar event by its ID with full details. Admins can view other users\' events by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the calendar event to retrieve',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose event to retrieve (admin only). If not provided, retrieves your own event.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { eventId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!eventId || typeof eventId !== 'string') {
        throw new ActionValidationError('eventId is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasGetEvent',
        async () => {
          // Wrap in audit logging if cross-user access
          const fetchEvent = async () => {
            const event = await getEventByIdService(context.companyId!, eventId, grantId);
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetEvent',
              requestParams: { eventId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: eventId,
            });
            return await withAdminAudit(auditContext, fetchEvent);
          }

          return await fetchEvent();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Update existing event
  nylasUpdateEvent: {
    description: 'Update an existing calendar event (move, reschedule, or modify details). Admins can update other users\' events by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to update',
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose event to update (admin only). If not provided, updates your own event.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      title?: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      participants?: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<EventData>> => {
      const { eventId, title, description, location, startTime, endTime, participants, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      // Validate dates if being updated
      if (startTime || endTime) {
        // If only one is provided, we can't fully validate the range
        // but we can still validate the individual date
        if (startTime && endTime) {
          const dateValidation = validateDateRange(startTime, endTime);
          logDateValidation('nylasUpdateEvent', startTime, dateValidation);

          if (!dateValidation.isValid) {
            throw new ActionValidationError(dateValidation.error!);
          }
        } else if (startTime) {
          const dateValidation = validateEventDate(startTime);
          logDateValidation('nylasUpdateEvent (start only)', startTime, dateValidation);

          if (!dateValidation.isValid) {
            throw new ActionValidationError(dateValidation.error!);
          }
        } else if (endTime) {
          const dateValidation = validateEventDate(endTime, { allowPastDates: true });
          logDateValidation('nylasUpdateEvent (end only)', endTime, dateValidation);

          if (!dateValidation.isValid) {
            throw new ActionValidationError(dateValidation.error!);
          }
        }
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<EventData, ServiceCallLambdaResponse<EventData>>(
        'nylasUpdateEvent',
        async () => {
          // Wrap in audit logging if cross-user access
          const updateEvent = async () => {
            const event = await updateCalendarEventService(context.companyId!, eventId, {
              title,
              description,
              location,
              startTime,
              endTime,
              participants: participants ? participants.split(',').map((e) => e.trim()) : undefined,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasUpdateEvent',
              requestParams: { eventId, title, description, location, startTime, endTime, participants, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: eventId,
            });
            return await withAdminAudit(auditContext, updateEvent);
          }

          return await updateEvent();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Delete event
  nylasDeleteEvent: {
    description: 'Delete a calendar event permanently. Admins can delete other users\' events by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to delete',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose event to delete (admin only). If not provided, deletes your own event.',
        },
      },
      required: ['eventId'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<{ deleted: boolean }>> => {
      const { eventId, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<{ deleted: boolean }, ServiceCallLambdaResponse<{ deleted: boolean }>>(
        'nylasDeleteEvent',
        async () => {
          // Wrap in audit logging if cross-user access
          const deleteEvent = async () => {
            await deleteCalendarEventService(context.companyId!, eventId, grantId);
            return { success: true, data: { deleted: true } };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasDeleteEvent',
              requestParams: { eventId, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: eventId,
            });
            return await withAdminAudit(auditContext, deleteEvent);
          }

          return await deleteEvent();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Find available time slots
  nylasFindAvailableSlots: {
    description:
      'Intelligently find available time slots for a meeting. Returns ranked slots based on optimal scheduling (morning priority, good spacing, mid-week preference). Admins can find slots for other users by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        durationMinutes: {
          type: 'number',
          description: 'Meeting duration in minutes',
        },
        dateRangeStart: {
          type: 'string',
          description: 'Start date for search in ISO 8601 format (e.g., "2024-01-15T00:00:00Z")',
        },
        dateRangeEnd: {
          type: 'string',
          description: 'End date for search in ISO 8601 format',
        },
        preferredTimeStart: {
          type: 'string',
          description: 'Preferred start time of day in HH:MM format (default: "09:00")',
        },
        preferredTimeEnd: {
          type: 'string',
          description: 'Preferred end time of day in HH:MM format (default: "17:00")',
        },
        participants: {
          type: 'string',
          description: 'Comma-separated email addresses to check availability (optional)',
        },
        bufferMinutes: {
          type: 'number',
          description: 'Buffer time between meetings in minutes (default: 15)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to check (admin only). If not provided, checks your own calendar.',
        },
      },
      required: ['durationMinutes', 'dateRangeStart', 'dateRangeEnd'],
      additionalProperties: false,
    },
    function: async (args: {
      durationMinutes: number;
      dateRangeStart: string;
      dateRangeEnd: string;
      preferredTimeStart?: string;
      preferredTimeEnd?: string;
      participants?: string;
      bufferMinutes?: number;
      targetEmail?: string;
    }): Promise<StandardActionResult<any[]>> => {
      const {
        durationMinutes,
        dateRangeStart,
        dateRangeEnd,
        preferredTimeStart,
        preferredTimeEnd,
        participants,
        bufferMinutes,
        targetEmail,
      } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!durationMinutes || durationMinutes <= 0) {
        throw new ActionValidationError('durationMinutes must be positive');
      }

      // Validate the date range
      const dateValidation = validateDateRange(dateRangeStart, dateRangeEnd, { allowPastDates: true });
      logDateValidation('nylasFindAvailableSlots', dateRangeStart, dateValidation);

      if (!dateValidation.isValid) {
        throw new ActionValidationError(dateValidation.error!);
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<any[], ServiceCallLambdaResponse<any[]>>(
        'nylasFindAvailableSlots',
        async () => {
          // Wrap in audit logging if cross-user access
          const findSlots = async () => {
            const startTimestamp = Math.floor(new Date(dateRangeStart).getTime() / 1000);
            const endTimestamp = Math.floor(new Date(dateRangeEnd).getTime() / 1000);

            const slots = await findAvailableSlotsService(context.companyId!, {
              durationMinutes,
              dateRangeStart: startTimestamp,
              dateRangeEnd: endTimestamp,
              preferredTimeStart,
              preferredTimeEnd,
              participants: participants ? participants.split(',').map((e) => e.trim()) : undefined,
              bufferMinutes,
              grantId,
            });

            // Convert timestamps back to ISO strings for better readability
            const formattedSlots = slots.map((slot) => ({
              startTime: new Date(slot.start_time * 1000).toISOString(),
              endTime: new Date(slot.end_time * 1000).toISOString(),
              score: slot.score,
              reason: slot.reason,
            }));

            return { success: true, data: formattedSlots };
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasFindAvailableSlots',
              requestParams: { durationMinutes, dateRangeStart, dateRangeEnd, preferredTimeStart, preferredTimeEnd, participants, bufferMinutes, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, findSlots);
          }

          return await findSlots();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Get free/busy information
  nylasGetFreeBusy: {
    description:
      'Check availability for one or more participants during a specific time range. Returns busy/free time slots. Admins can check other users\' calendars by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to check from (admin only). If not provided, checks from your own calendar.',
        },
      },
      required: ['emails', 'startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      emails: string;
      startTime: string;
      endTime: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<any[]>> => {
      const { emails, startTime, endTime, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!emails) {
        throw new ActionValidationError('emails is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<any[], ServiceCallLambdaResponse<any[]>>(
        'nylasGetFreeBusy',
        async () => {
          // Wrap in audit logging if cross-user access
          const getFreeBusy = async () => {
            const emailList = emails.split(',').map((e) => e.trim());
            const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
            const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

            const freeBusyData = await getFreeBusyService(
              context.companyId!,
              emailList,
              startTimestamp,
              endTimestamp,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasGetFreeBusy',
              requestParams: { emails, startTime, endTime, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, getFreeBusy);
          }

          return await getFreeBusy();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Check for conflicts
  nylasCheckConflicts: {
    description:
      'Check if a proposed meeting time conflicts with existing events. Suggests alternative times if conflicts are found. Admins can check other users\' calendars by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
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
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to check (admin only). If not provided, checks your own calendar.',
        },
      },
      required: ['startTime', 'endTime'],
      additionalProperties: false,
    },
    function: async (args: {
      startTime: string;
      endTime: string;
      participants?: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<any>> => {
      const { startTime, endTime, participants, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasCheckConflicts',
        async () => {
          // Wrap in audit logging if cross-user access
          const checkConflicts = async () => {
            const startTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
            const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);

            const result = await checkEventConflictsService(
              context.companyId!,
              startTimestamp,
              endTimestamp,
              participants ? participants.split(',').map((e) => e.trim()) : undefined,
              grantId,
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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasCheckConflicts',
              requestParams: { startTime, endTime, participants, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, checkConflicts);
          }

          return await checkConflicts();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Batch create events
  nylasBatchCreateEvents: {
    description:
      'Create multiple calendar events in one operation. Useful for recurring meetings or batch scheduling. Admins can create events on other users\' calendars by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        events: {
          type: 'string',
          description:
            'JSON array of event objects. Each object should have: title, startTime, endTime, and optionally description, location, participants',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose calendar to use (admin only). If not provided, creates on your own calendar.',
        },
      },
      required: ['events'],
      additionalProperties: false,
    },
    function: async (args: {
      events: string;
      targetEmail?: string;
    }): Promise<StandardActionResult<any>> => {
      const { events, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!events) {
        throw new ActionValidationError('events is required');
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasBatchCreateEvents',
        async () => {
          // Wrap in audit logging if cross-user access
          const batchCreate = async () => {
            const eventList = JSON.parse(events);

            if (!Array.isArray(eventList)) {
              throw new Error('events must be a JSON array');
            }

            // Validate dates for all events before creating any
            const validationErrors: string[] = [];
            eventList.forEach((event, index) => {
              if (event.startTime && event.endTime) {
                const validation = validateDateRange(event.startTime, event.endTime);
                if (!validation.isValid) {
                  validationErrors.push(`Event ${index + 1} (${event.title || 'Untitled'}): ${validation.error}`);
                }
              }
            });

            if (validationErrors.length > 0) {
              throw new ActionValidationError(
                `Date validation failed for ${validationErrors.length} event(s):\n${validationErrors.join('\n')}`
              );
            }

            const result = await createMultipleEventsService(context.companyId!, eventList, grantId);

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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasBatchCreateEvents',
              requestParams: { events, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
            });
            return await withAdminAudit(auditContext, batchCreate);
          }

          return await batchCreate();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // Move event (convenience wrapper)
  nylasMoveEvent: {
    description:
      'Move a calendar event to a new time. Optionally checks for conflicts before moving. Admins can move other users\' events by providing targetEmail.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to move',
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
          description: 'Whether to check for conflicts before moving (default: true)',
        },
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose event to move (admin only). If not provided, moves your own event.',
        },
      },
      required: ['eventId', 'newStartTime', 'newEndTime'],
      additionalProperties: false,
    },
    function: async (args: {
      eventId: string;
      newStartTime: string;
      newEndTime: string;
      checkConflicts?: boolean;
      targetEmail?: string;
    }): Promise<StandardActionResult<any>> => {
      const { eventId, newStartTime, newEndTime, checkConflicts = true, targetEmail } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      if (!eventId) {
        throw new ActionValidationError('eventId is required');
      }

      // Validate the new date range
      const dateValidation = validateDateRange(newStartTime, newEndTime);
      logDateValidation('nylasMoveEvent', newStartTime, dateValidation);

      if (!dateValidation.isValid) {
        throw new ActionValidationError(dateValidation.error!);
      }

      // Resolve target user grant (handles admin cross-user access)
      const { grantId, targetUserId, isAdminAccess } = await resolveTargetUserGrant(
        targetEmail,
        context.userId,
        context.companyId
      );

      return executeAction<any, ServiceCallLambdaResponse<any>>(
        'nylasMoveEvent',
        async () => {
          // Wrap in audit logging if cross-user access
          const moveEvent = async () => {
            // Check for conflicts if requested
            if (checkConflicts) {
              const startTimestamp = Math.floor(new Date(newStartTime).getTime() / 1000);
              const endTimestamp = Math.floor(new Date(newEndTime).getTime() / 1000);

              const conflictCheck = await checkEventConflictsService(
                context.companyId!,
                startTimestamp,
                endTimestamp,
                undefined,
                grantId,
              );

              if (conflictCheck.hasConflict) {
                const conflictDetails = {
                  hasConflict: true,
                  conflicts: conflictCheck.conflicts.map((event) => ({
                    id: event.id,
                    title: event.title,
                    startTime: new Date(event.when.start_time * 1000).toISOString(),
                    endTime: new Date(event.when.end_time * 1000).toISOString(),
                  })),
                  alternatives: conflictCheck.alternativeSlots?.map((slot) => ({
                    startTime: new Date(slot.start_time * 1000).toISOString(),
                    endTime: new Date(slot.end_time * 1000).toISOString(),
                    score: slot.score,
                    reason: slot.reason,
                  })),
                  message: 'The proposed time conflicts with existing events. See alternatives.',
                };
                return { success: true, data: conflictDetails };
              }
            }

            // No conflicts or check disabled, proceed with move
            const event = await updateCalendarEventService(context.companyId!, eventId, {
              startTime: newStartTime,
              endTime: newEndTime,
              grantId,
            });

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
          };

          // Audit logging for admin access
          if (isAdminAccess && !shouldSkipAudit(context.userId!, targetUserId)) {
            const auditContext = buildAuditContext({
              adminUserId: context.userId!,
              targetUserId,
              companyId: context.companyId!,
              actionName: 'nylasMoveEvent',
              requestParams: { eventId, newStartTime, newEndTime, checkConflicts, targetEmail },
              sessionId: context.sessionId,
              assistantId: context.assistantId,
              targetEmail,
              resourceId: eventId,
            });
            return await withAdminAudit(auditContext, moveEvent);
          }

          return await moveEvent();
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // TEAM INVITATION ACTION
  // ==========================================
  nylasSendTeamInvitation: {
    description:
      'Send a team invitation email to a new user. Creates platform invite and sends email with OAuth connection link via admin\'s Gmail account through Nylas.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address of the person to invite (required)',
        },
        name: {
          type: 'string',
          description: 'Name of the person to invite (optional)',
        },
        role: {
          type: 'string',
          enum: ['Admin', 'CompanyUser'],
          description: 'Role to assign to the invitee (default: CompanyUser)',
        },
        personalMessage: {
          type: 'string',
          description: 'Personal message to include in the invitation email (optional)',
        },
      },
      required: ['email'],
      additionalProperties: false,
    },
    function: async (args: {
      email: string;
      name?: string;
      role?: 'Admin' | 'CompanyUser';
      personalMessage?: string;
    }): Promise<StandardActionResult<any>> => {
      const { email, name, role, personalMessage } = args;

      if (!context.companyId || !context.userId) {
        throw new ActionValidationError('Company ID or User ID is missing from context.');
      }

      return await executeAction(
        'nylasSendTeamInvitation',
        async () => {
          const { InviteService } = await import('../../services/invite.service');
          const { getAuthorizationUrl } = await import('../../services/nylas-oauth.service');
          const { User } = await import('../../models/User');
          const { Company } = await import('../../models/Company');
          const { generateInviteEmailContent } = await import('./invitation/invitation-email-template');

          // Get inviter details
          const inviter = await User.findById(context.userId).lean();
          if (!inviter) {
            throw new ActionValidationError('Inviter not found');
          }

          // Get company details
          const company = await Company.findById(context.companyId).lean();
          if (!company) {
            throw new ActionValidationError('Company not found');
          }

          // Create invite record
          const invite = await InviteService.createInvite(
            email,
            context.companyId!,
            context.userId!,
            name,
            role || 'CompanyUser',
            {
              source: 'api' as any,
              userAgent: 'AI Agent',
              ipAddress: 'internal',
            },
          );

          // Generate OAuth URL with invite token in state
          const authUrl = await getAuthorizationUrl({
            companyId: context.companyId!,
            userId: context.userId!,
            state: JSON.stringify({
              inviteToken: invite.inviteToken,
              email: email,
              returnUrl: '/dashboard',
            }),
          });

          // Generate email content
          const emailContent = generateInviteEmailContent({
            invitee: {
              email,
              name,
            },
            inviter: {
              name: inviter.name || inviter.email,
              email: inviter.email,
            },
            company: {
              name: company.name || 'Our Company',
            },
            oauthUrl: authUrl.url,
            inviteToken: invite.inviteToken,
            expiresAt: invite.expiresAt,
            personalMessage,
          });

          // Send email using admin's Nylas account
          await sendEmailService(context.companyId!, {
            to: email,
            subject: emailContent.subject,
            body: emailContent.html,
          });

          return {
            success: true,
            message: `Invitation sent successfully to ${email}`,
            data: {
              inviteId: invite._id.toString(),
              email: invite.email,
              name: invite.name,
              role: invite.role,
              status: invite.status,
              expiresAt: invite.expiresAt,
              oauthUrl: authUrl.url,
            },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  // ==========================================
  // OAUTH MANAGEMENT ACTIONS (Admin Only)
  // ==========================================

  nylasDisconnectOAuth: {
    description:
      'Safely disconnect OAuth access for a user. Creates backup before disconnection. Admin only. Use targetEmail to specify which user to disconnect. Set removeUser to true to also remove the user from the team.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose OAuth to disconnect (required)',
        },
        removeUser: {
          type: 'boolean',
          description: 'If true, also deactivates the user account and removes them from the team (default: false)',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for disconnection',
        },
      },
      required: ['targetEmail'],
    },
    function: async ({ targetEmail, removeUser = false, reason }: { targetEmail: string; removeUser?: boolean; reason?: string }) => {
      return executeAction(
        'nylasDisconnectOAuth',
        async () => {
          const companyId = context.companyId!;

          // Resolve target user
          const User = (await import('../../models/User')).User;
          const targetUser = await User.findOne({
            email: targetEmail,
            companyId,
          });

          if (!targetUser) {
            throw new ActionValidationError(`User not found: ${targetEmail}`);
          }

          // Prevent admin from removing themselves
          if (removeUser && targetUser._id.toString() === context.userId) {
            throw new ActionValidationError('Cannot remove yourself from the team');
          }

          // Perform safe disconnection
          const result = await safeDisconnectWithBackup(
            targetUser._id.toString(),
            companyId
          );

          // TODO: User deactivation feature - requires extending User model
          // If removeUser flag is set, we would deactivate the user account here
          // For now, we just disconnect OAuth and delete the user record
          let userRemoved = false;
          if (removeUser) {
            await targetUser.deleteOne();
            userRemoved = true;

            console.log(`[OAUTH DISCONNECT] User ${targetEmail} removed from team`);
          }

          return {
            success: true,
            data: {
              ...result,
              userRemoved,
              userDeleted: userRemoved,
            },
            description: userRemoved
              ? `OAuth disconnected for ${targetEmail} and user removed from team. Backup created at ${result.backupFile}.`
              : `OAuth disconnected for ${targetEmail}. User account kept active. Backup created at ${result.backupFile}.`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasCleanupOAuthData: {
    description:
      'Clean up related data after OAuth disconnection (EmailProfiles, cache). Admin only.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        targetEmail: {
          type: 'string',
          description: 'Email address of the user whose data to clean up (required)',
        },
      },
      required: ['targetEmail'],
    },
    function: async ({ targetEmail }: { targetEmail: string }) => {
      return executeAction(
        'nylasCleanupOAuthData',
        async () => {
          const companyId = context.companyId!;

          // Resolve target user
          const User = (await import('../../models/User')).User;
          const targetUser = await User.findOne({
            email: targetEmail,
            companyId,
          });

          if (!targetUser) {
            throw new ActionValidationError(`User not found: ${targetEmail}`);
          }

          // Perform cleanup
          const result = await cleanupRelatedData(
            targetUser._id.toString(),
            companyId
          );

          return {
            success: true,
            data: result,
            description: `Cleaned up ${result.profilesDeactivated} EmailProfiles and ${result.cacheDeleted} cached events for ${targetEmail}.`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasVerifyOAuthDeletion: {
    description:
      'Verify that OAuth disconnection was safe and complete. Admin only.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        targetEmail: {
          type: 'string',
          description: 'Email address of the user to verify (required)',
        },
      },
      required: ['targetEmail'],
    },
    function: async ({ targetEmail }: { targetEmail: string }) => {
      return executeAction(
        'nylasVerifyOAuthDeletion',
        async () => {
          const companyId = context.companyId!;

          // Resolve target user
          const User = (await import('../../models/User')).User;
          const targetUser = await User.findOne({
            email: targetEmail,
            companyId,
          });

          if (!targetUser) {
            throw new ActionValidationError(`User not found: ${targetEmail}`);
          }

          // Verify deletion safety
          const result = await verifyDeletionSafety(
            targetUser._id.toString(),
            companyId
          );

          const allPassed = Object.values(result).every(
            v => v === true || (Array.isArray(v) && v.length === 0)
          );

          return {
            success: allPassed,
            data: result,
            description: allPassed
              ? `✅ All verification checks passed for ${targetEmail}`
              : `⚠️ Verification found issues for ${targetEmail}: ${result.errors.join(', ')}`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasRollbackOAuth: {
    description:
      'Rollback OAuth disconnection using a backup file. Admin only. Use this if disconnection needs to be reversed. Also reactivates user if they were removed.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        targetEmail: {
          type: 'string',
          description: 'Email address of the user to rollback (required)',
        },
        backupFile: {
          type: 'string',
          description: 'Name of the backup file to restore from (optional - uses latest if not provided)',
        },
      },
      required: ['targetEmail'],
    },
    function: async ({ targetEmail, backupFile }: { targetEmail: string; backupFile?: string }) => {
      return executeAction(
        'nylasRollbackOAuth',
        async () => {
          const companyId = context.companyId!;

          // Resolve target user (include inactive users for rollback)
          const User = (await import('../../models/User')).User;
          const targetUser = await User.findOne({
            email: targetEmail,
            companyId,
          });

          if (!targetUser) {
            throw new ActionValidationError(`User not found: ${targetEmail}`);
          }

          // If no backup file specified, get the latest one
          let backupToUse = backupFile;
          if (!backupToUse) {
            const backups = await listBackups(targetUser._id.toString());
            if (backups.length === 0) {
              throw new ActionValidationError(`No backups found for ${targetEmail}`);
            }
            backupToUse = backups[backups.length - 1].fileName;
          }

          // Perform rollback
          const result = await rollbackDeletion(
            targetUser._id.toString(),
            companyId,
            backupToUse
          );

          // NOTE: User reactivation removed - if user was deleted during disconnect,
          // they need to be manually re-invited to the team.
          // We only restore the OAuth connection and NylasAccount data.

          return {
            success: true,
            data: {
              ...result,
            },
            description: `OAuth connection restored for ${targetEmail} from backup ${backupToUse}. ${result.restored} items restored. Note: If user was removed from team during disconnect, they need to be re-invited.`,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  nylasListOAuthBackups: {
    description:
      'List available OAuth backup files for a user. Admin only.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        targetEmail: {
          type: 'string',
          description: 'Email address of the user (required)',
        },
      },
      required: ['targetEmail'],
    },
    function: async ({ targetEmail }: { targetEmail: string }) => {
      return executeAction(
        'nylasListOAuthBackups',
        async () => {
          const companyId = context.companyId!;

          // Resolve target user
          const User = (await import('../../models/User')).User;
          const targetUser = await User.findOne({
            email: targetEmail,
            companyId,
          });

          if (!targetUser) {
            throw new ActionValidationError(`User not found: ${targetEmail}`);
          }

          // List backups
          const backups = await listBackups(targetUser._id.toString());

          return {
            success: true,
            data: { backups, count: backups.length },
            description: `Found ${backups.length} backup(s) for ${targetEmail}.`,
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
  };

  console.log(`[DEBUG NYLAS ACTIONS] Created ${Object.keys(actions).length} actions from nylas.actions.ts`);

  return actions;
};
