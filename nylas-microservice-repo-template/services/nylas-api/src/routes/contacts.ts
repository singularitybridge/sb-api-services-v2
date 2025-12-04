/**
 * Contacts Routes - Fastify Implementation
 *
 * Routes:
 * - GET  /contacts/search          - Search contacts
 * - GET  /contacts/list            - List all contacts
 * - GET  /contacts/:grantId/:contactId    - Get specific contact
 * - POST /contacts                 - Create contact
 * - PUT  /contacts/:grantId/:contactId    - Update contact
 * - DELETE /contacts/:grantId/:contactId  - Delete contact
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  searchContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  listContacts,
} from '../services/contacts.service.js';
import {
  searchContactsQuerySchema,
  getContactParamsSchema,
  createContactBodySchema,
  updateContactBodySchema,
  listContactsQuerySchema,
} from '../schemas/contacts.schemas.js';
import { errorResponseSchema } from '../schemas/oauth.schemas.js';

// ==========================================
// Type Definitions
// ==========================================

interface SearchContactsQuery {
  grantId: string;
  query?: string;
  email?: string;
  phone?: string;
  limit?: number;
  offset?: number;
}

interface ContactParams {
  grantId: string;
  contactId: string;
}

interface CreateContactBody {
  grantId: string;
  given_name?: string;
  middle_name?: string;
  surname?: string;
  nickname?: string;
  company_name?: string;
  job_title?: string;
  manager_name?: string;
  office_location?: string;
  notes?: string;
  emails?: Array<{ type?: string; email: string }>;
  phone_numbers?: Array<{ type?: string; number: string }>;
  physical_addresses?: Array<any>;
  web_pages?: Array<{ type?: string; url: string }>;
}

interface ListContactsQuery {
  grantId: string;
  limit?: number;
  offset?: number;
}

// ==========================================
// Routes Registration
// ==========================================

export default async function contactsRoutes(fastify: FastifyInstance) {
  // ==========================================
  // Search Contacts
  // ==========================================

  /**
   * GET /contacts/search
   * Search contacts by query, email, or phone
   */
  fastify.get<{ Querystring: SearchContactsQuery }>(
    '/search',
    {
      schema: {
        querystring: searchContactsQuerySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: SearchContactsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { grantId, query, email, phone, limit, offset } = request.query;

        const contacts = await searchContacts({
          grantId,
          query,
          email,
          phone,
          limit,
          offset,
        });

        fastify.log.info({
          msg: 'Contacts searched successfully',
          grantId,
          resultCount: contacts.length,
        });

        return reply.send({
          success: true,
          data: contacts,
          count: contacts.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Search contacts error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to search contacts',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // List All Contacts
  // ==========================================

  /**
   * GET /contacts/list
   * List all contacts for a grant
   */
  fastify.get<{ Querystring: ListContactsQuery }>(
    '/list',
    {
      schema: {
        querystring: listContactsQuerySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ListContactsQuery }>, reply: FastifyReply) => {
      try {
        const { grantId, limit, offset } = request.query;

        const contacts = await listContacts(grantId, { limit, offset });

        fastify.log.info({
          msg: 'Contacts listed successfully',
          grantId,
          contactCount: contacts.length,
        });

        return reply.send({
          success: true,
          data: contacts,
          count: contacts.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'List contacts error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to list contacts',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Get Specific Contact
  // ==========================================

  /**
   * GET /contacts/:grantId/:contactId
   * Get details of a specific contact
   */
  fastify.get<{ Params: ContactParams }>(
    '/:grantId/:contactId',
    {
      schema: {
        params: getContactParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: ContactParams }>, reply: FastifyReply) => {
      try {
        const { grantId, contactId } = request.params;

        const contact = await getContact(grantId, contactId);

        fastify.log.info({
          msg: 'Contact retrieved successfully',
          contactId,
          grantId,
        });

        return reply.send({
          success: true,
          data: contact,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Get contact error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get contact',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Create Contact
  // ==========================================

  /**
   * POST /contacts
   * Create a new contact
   */
  fastify.post<{ Body: CreateContactBody }>(
    '/',
    {
      schema: {
        body: createContactBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateContactBody }>, reply: FastifyReply) => {
      try {
        const contact = await createContact(request.body);

        fastify.log.info({
          msg: 'Contact created successfully',
          contactId: contact.id,
          grantId: request.body.grantId,
        });

        return reply.send({
          success: true,
          data: contact,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Create contact error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to create contact',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Update Contact
  // ==========================================

  /**
   * PUT /contacts/:grantId/:contactId
   * Update an existing contact
   */
  fastify.put<{ Params: ContactParams; Body: Partial<CreateContactBody> }>(
    '/:grantId/:contactId',
    {
      schema: {
        params: getContactParamsSchema,
        body: updateContactBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ContactParams; Body: Partial<CreateContactBody> }>,
      reply: FastifyReply
    ) => {
      try {
        const { grantId, contactId } = request.params;

        const contact = await updateContact(grantId, contactId, request.body);

        fastify.log.info({
          msg: 'Contact updated successfully',
          contactId,
          grantId,
        });

        return reply.send({
          success: true,
          data: contact,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Update contact error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to update contact',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Delete Contact
  // ==========================================

  /**
   * DELETE /contacts/:grantId/:contactId
   * Delete a contact
   */
  fastify.delete<{ Params: ContactParams }>(
    '/:grantId/:contactId',
    {
      schema: {
        params: getContactParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: ContactParams }>, reply: FastifyReply) => {
      try {
        const { grantId, contactId } = request.params;

        await deleteContact(grantId, contactId);

        fastify.log.info({
          msg: 'Contact deleted successfully',
          contactId,
          grantId,
        });

        return reply.send({
          success: true,
          message: 'Contact deleted successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Delete contact error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to delete contact',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
