/**
 * Fastify JSON Schemas for Email endpoints
 */

const participantSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
};

const attachmentSchema = {
  type: 'object',
  properties: {
    filename: { type: 'string' },
    content_type: { type: 'string' },
    content: { type: 'string' }, // base64
  },
  required: ['filename', 'content_type', 'content'],
};

export const sendEmailBodySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    to: { type: 'array', items: participantSchema, minItems: 1 },
    subject: { type: 'string', minLength: 1 },
    body: { type: 'string', minLength: 1 },
    cc: { type: 'array', items: participantSchema },
    bcc: { type: 'array', items: participantSchema },
    reply_to: { type: 'array', items: participantSchema },
    attachments: { type: 'array', items: attachmentSchema },
  },
  required: ['grantId', 'to', 'subject', 'body'],
} as const;

export const searchEmailsQuerySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    query: { type: 'string' },
    from: { type: 'string', format: 'email' },
    to: { type: 'string', format: 'email' },
    subject: { type: 'string' },
    unread: { type: 'boolean' },
    starred: { type: 'boolean' },
    limit: { type: 'number', minimum: 1, maximum: 100 },
    offset: { type: 'number', minimum: 0 },
  },
  required: ['grantId'],
} as const;

export const getEmailParamsSchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    messageId: { type: 'string' },
  },
  required: ['grantId', 'messageId'],
} as const;

export const updateEmailBodySchema = {
  type: 'object',
  properties: {
    unread: { type: 'boolean' },
    starred: { type: 'boolean' },
    folders: { type: 'array', items: { type: 'string' } },
    labels: { type: 'array', items: { type: 'string' } },
  },
} as const;
