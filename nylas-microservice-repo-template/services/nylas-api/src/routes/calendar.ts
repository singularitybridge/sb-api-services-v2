/**
 * Calendar Routes - Fastify Implementation
 *
 * Routes:
 * - GET  /calendar/availability  - Check free/busy
 * - POST /calendar/events        - Create event
 * - GET  /calendar/events        - List events
 * - GET  /calendar/events/:grantId/:eventId    - Get specific event
 * - PUT  /calendar/events/:grantId/:eventId    - Update event
 * - DELETE /calendar/events/:grantId/:eventId  - Delete event
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getFreeBusy,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  listEvents,
} from '../services/calendar.service.js';
import {
  availabilityQuerySchema,
  createEventBodySchema,
  updateEventBodySchema,
  eventParamsSchema,
  listEventsQuerySchema,
} from '../schemas/calendar.schemas.js';
import { errorResponseSchema } from '../schemas/oauth.schemas.js';

// ==========================================
// Type Definitions
// ==========================================

interface AvailabilityQuery {
  grantId: string;
  startTime: string;
  endTime: string;
  emails?: string[];
  duration?: number;
}

interface CreateEventBody {
  grantId: string;
  calendarId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  location?: string;
  participants?: Array<{
    email: string;
    name?: string;
  }>;
  busy?: boolean;
}

interface EventParams {
  grantId: string;
  eventId: string;
}

interface ListEventsQuery {
  grantId: string;
  calendarId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

// ==========================================
// Routes Registration
// ==========================================

export default async function calendarRoutes(fastify: FastifyInstance) {
  // ==========================================
  // Check Availability
  // ==========================================

  /**
   * GET /calendar/availability
   * Check free/busy for one or more users
   */
  fastify.get<{ Querystring: AvailabilityQuery }>(
    '/availability',
    {
      schema: {
        querystring: availabilityQuerySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: AvailabilityQuery }>, reply: FastifyReply) => {
      try {
        const { grantId, startTime, endTime, emails, duration } = request.query;

        const result = await getFreeBusy({
          grantId,
          startTime,
          endTime,
          emails,
          duration,
        });

        fastify.log.info({
          msg: 'Free/busy retrieved successfully',
          grantId,
          emailCount: emails?.length || 0,
        });

        return reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Availability check error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to check availability',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Create Event
  // ==========================================

  /**
   * POST /calendar/events
   * Create a new calendar event
   */
  fastify.post<{ Body: CreateEventBody }>(
    '/events',
    {
      schema: {
        body: createEventBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateEventBody }>, reply: FastifyReply) => {
      try {
        const event = await createEvent(request.body);

        fastify.log.info({
          msg: 'Event created successfully',
          eventId: event.id,
          grantId: request.body.grantId,
        });

        return reply.send({
          success: true,
          data: event,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Event creation error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to create event',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // List Events
  // ==========================================

  /**
   * GET /calendar/events
   * List calendar events with optional filters
   */
  fastify.get<{ Querystring: ListEventsQuery }>(
    '/events',
    {
      schema: {
        querystring: listEventsQuerySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListEventsQuery }>, reply: FastifyReply) => {
      try {
        const { grantId, calendarId, startTime, endTime, limit } = request.query;

        const events = await listEvents(grantId, {
          calendarId,
          startTime,
          endTime,
          limit,
        });

        fastify.log.info({
          msg: 'Events listed successfully',
          grantId,
          eventCount: events.length,
        });

        return reply.send({
          success: true,
          data: events,
          count: events.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'List events error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to list events',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Get Specific Event
  // ==========================================

  /**
   * GET /calendar/events/:grantId/:eventId
   * Get details of a specific event
   */
  fastify.get<{ Params: EventParams }>(
    '/events/:grantId/:eventId',
    {
      schema: {
        params: eventParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: EventParams }>, reply: FastifyReply) => {
      try {
        const { grantId, eventId } = request.params;

        const event = await getEvent(grantId, eventId);

        fastify.log.info({
          msg: 'Event retrieved successfully',
          eventId,
          grantId,
        });

        return reply.send({
          success: true,
          data: event,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Get event error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get event',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Update Event
  // ==========================================

  /**
   * PUT /calendar/events/:grantId/:eventId
   * Update an existing event
   */
  fastify.put<{ Params: EventParams; Body: Partial<CreateEventBody> }>(
    '/events/:grantId/:eventId',
    {
      schema: {
        params: eventParamsSchema,
        body: updateEventBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: EventParams; Body: Partial<CreateEventBody> }>,
      reply: FastifyReply
    ) => {
      try {
        const { grantId, eventId } = request.params;

        const event = await updateEvent(grantId, eventId, request.body);

        fastify.log.info({
          msg: 'Event updated successfully',
          eventId,
          grantId,
        });

        return reply.send({
          success: true,
          data: event,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Update event error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to update event',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Delete Event
  // ==========================================

  /**
   * DELETE /calendar/events/:grantId/:eventId
   * Delete an event
   */
  fastify.delete<{ Params: EventParams }>(
    '/events/:grantId/:eventId',
    {
      schema: {
        params: eventParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: EventParams }>, reply: FastifyReply) => {
      try {
        const { grantId, eventId } = request.params;

        await deleteEvent(grantId, eventId);

        fastify.log.info({
          msg: 'Event deleted successfully',
          eventId,
          grantId,
        });

        return reply.send({
          success: true,
          message: 'Event deleted successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Delete event error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to delete event',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
