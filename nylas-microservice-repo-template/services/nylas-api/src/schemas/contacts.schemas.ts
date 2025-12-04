/**
 * Fastify JSON Schemas for Contacts endpoints
 */

const emailSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['work', 'personal', 'other'] },
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
};

const phoneNumberSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['work', 'mobile', 'home', 'other'] },
    number: { type: 'string' },
  },
  required: ['number'],
};

const addressSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['work', 'home', 'other'] },
    street_address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postal_code: { type: 'string' },
    country: { type: 'string' },
  },
};

const webPageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    url: { type: 'string', format: 'uri' },
  },
  required: ['url'],
};

export const searchContactsQuerySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    query: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string' },
    limit: { type: 'number', minimum: 1, maximum: 100 },
    offset: { type: 'number', minimum: 0 },
  },
  required: ['grantId'],
} as const;

export const getContactParamsSchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    contactId: { type: 'string' },
  },
  required: ['grantId', 'contactId'],
} as const;

export const createContactBodySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    given_name: { type: 'string' },
    middle_name: { type: 'string' },
    surname: { type: 'string' },
    nickname: { type: 'string' },
    company_name: { type: 'string' },
    job_title: { type: 'string' },
    manager_name: { type: 'string' },
    office_location: { type: 'string' },
    notes: { type: 'string' },
    emails: { type: 'array', items: emailSchema },
    phone_numbers: { type: 'array', items: phoneNumberSchema },
    physical_addresses: { type: 'array', items: addressSchema },
    web_pages: { type: 'array', items: webPageSchema },
  },
  required: ['grantId'],
} as const;

export const updateContactBodySchema = {
  type: 'object',
  properties: {
    given_name: { type: 'string' },
    middle_name: { type: 'string' },
    surname: { type: 'string' },
    nickname: { type: 'string' },
    company_name: { type: 'string' },
    job_title: { type: 'string' },
    manager_name: { type: 'string' },
    office_location: { type: 'string' },
    notes: { type: 'string' },
    emails: { type: 'array', items: emailSchema },
    phone_numbers: { type: 'array', items: phoneNumberSchema },
    physical_addresses: { type: 'array', items: addressSchema },
    web_pages: { type: 'array', items: webPageSchema },
  },
} as const;

export const listContactsQuerySchema = {
  type: 'object',
  properties: {
    grantId: { type: 'string' },
    limit: { type: 'number', minimum: 1, maximum: 100 },
    offset: { type: 'number', minimum: 0 },
  },
  required: ['grantId'],
} as const;
