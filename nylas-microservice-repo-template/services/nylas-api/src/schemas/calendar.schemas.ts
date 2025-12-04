/**
 * Fastify JSON Schemas for Calendar endpoints
 */

export const availabilityQuerySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    emails: { type: 'array', items: { type: 'string', format: 'email' } },
    duration: { type: 'number', minimum: 1 },
  },
  required: ['grantId', 'startTime', 'endTime'],
} as const;

export const createEventBodySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    calendarId: { type: 'string' },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    timezone: { type: 'string' },
    location: { type: 'string' },
    participants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
        },
        required: ['email'],
      },
    },
    busy: { type: 'boolean' },
  },
  required: ['grantId', 'title', 'startTime', 'endTime'],
} as const;

export const updateEventBodySchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    timezone: { type: 'string' },
    location: { type: 'string' },
    participants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
        },
        required: ['email'],
      },
    },
    busy: { type: 'boolean' },
  },
} as const;

export const eventParamsSchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    eventId: { type: 'string' },
  },
  required: ['grantId', 'eventId'],
} as const;

export const listEventsQuerySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    calendarId: { type: 'string' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    limit: { type: 'number', minimum: 1, maximum: 100 },
  },
  required: ['grantId'],
} as const;
