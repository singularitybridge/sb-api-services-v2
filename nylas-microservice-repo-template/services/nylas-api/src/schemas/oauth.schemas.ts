/**
 * Fastify JSON Schemas for OAuth endpoints
 */

export const authInitiateQuerySchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    companyId: { type: 'string' },
    provider: { type: 'string', enum: ['google', 'microsoft'] },
    redirect: { type: 'string' },
  },
  required: ['userId', 'companyId'],
} as const;

export const authInitiateResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    authUrl: { type: 'string' },
    state: { type: 'string' },
    provider: { type: 'string' },
  },
} as const;

export const callbackQuerySchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    state: { type: 'string' },
    error: { type: 'string' },
    error_description: { type: 'string' },
  },
} as const;

export const statusQuerySchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    companyId: { type: 'string' },
  },
  required: ['userId', 'companyId'],
} as const;

export const statusResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    connected: { type: 'boolean' },
    email: { type: 'string' },
    provider: { type: 'string' },
    lastValidated: { type: 'string' },
  },
} as const;

export const disconnectBodySchema = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    companyId: { type: 'string' },
    grantId: { type: 'string' },
  },
  required: ['userId', 'companyId'],
} as const;

export const disconnectResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
  },
} as const;

export const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
    statusCode: { type: 'number' },
    timestamp: { type: 'string' },
  },
} as const;
