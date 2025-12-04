/**
 * Email Routes - Fastify Implementation
 *
 * Routes:
 * - POST /email/send                     - Send email
 * - GET  /email/search                   - Search emails
 * - GET  /email/:grantId/:messageId      - Get specific email
 * - PUT  /email/:grantId/:messageId      - Update email (mark read, star, etc.)
 * - DELETE /email/:grantId/:messageId    - Trash email
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  sendEmail,
  searchEmails,
  getEmail,
  updateEmail,
  trashEmail,
} from '../services/email.service.js';
import {
  sendEmailBodySchema,
  searchEmailsQuerySchema,
  getEmailParamsSchema,
  updateEmailBodySchema,
} from '../schemas/email.schemas.js';
import { errorResponseSchema } from '../schemas/oauth.schemas.js';

// ==========================================
// Type Definitions
// ==========================================

interface EmailParticipant {
  name?: string;
  email: string;
}

interface SendEmailBody {
  grantId: string;
  to: EmailParticipant[];
  subject: string;
  body: string;
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  reply_to?: EmailParticipant[];
  attachments?: Array<{
    filename: string;
    content_type: string;
    content: string;
  }>;
}

interface SearchEmailsQuery {
  grantId: string;
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  unread?: boolean;
  starred?: boolean;
  limit?: number;
  offset?: number;
}

interface EmailParams {
  grantId: string;
  messageId: string;
}

interface UpdateEmailBody {
  unread?: boolean;
  starred?: boolean;
  folders?: string[];
  labels?: string[];
}

// ==========================================
// Routes Registration
// ==========================================

export default async function emailRoutes(fastify: FastifyInstance) {
  // ==========================================
  // Send Email
  // ==========================================

  /**
   * POST /email/send
   * Send an email
   */
  fastify.post<{ Body: SendEmailBody }>(
    '/send',
    {
      schema: {
        body: sendEmailBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: SendEmailBody }>, reply: FastifyReply) => {
      try {
        const message = await sendEmail(request.body);

        fastify.log.info({
          msg: 'Email sent successfully',
          messageId: message.id,
          grantId: request.body.grantId,
        });

        return reply.send({
          success: true,
          data: message,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Send email error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to send email',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Search Emails
  // ==========================================

  /**
   * GET /email/search
   * Search or list emails
   */
  fastify.get<{ Querystring: SearchEmailsQuery }>(
    '/search',
    {
      schema: {
        querystring: searchEmailsQuerySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: SearchEmailsQuery }>, reply: FastifyReply) => {
      try {
        const { grantId, query, from, to, subject, unread, starred, limit, offset } =
          request.query;

        const messages = await searchEmails({
          grantId,
          query,
          from,
          to,
          subject,
          unread,
          starred,
          limit,
          offset,
        });

        fastify.log.info({
          msg: 'Emails searched successfully',
          grantId,
          resultCount: messages.length,
        });

        return reply.send({
          success: true,
          data: messages,
          count: messages.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Search emails error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to search emails',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Get Specific Email
  // ==========================================

  /**
   * GET /email/:grantId/:messageId
   * Get details of a specific email
   */
  fastify.get<{ Params: EmailParams }>(
    '/:grantId/:messageId',
    {
      schema: {
        params: getEmailParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: EmailParams }>, reply: FastifyReply) => {
      try {
        const { grantId, messageId } = request.params;

        const message = await getEmail(grantId, messageId);

        fastify.log.info({
          msg: 'Email retrieved successfully',
          messageId,
          grantId,
        });

        return reply.send({
          success: true,
          data: message,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Get email error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get email',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Update Email
  // ==========================================

  /**
   * PUT /email/:grantId/:messageId
   * Update email properties (read status, starred, folders, labels)
   */
  fastify.put<{ Params: EmailParams; Body: UpdateEmailBody }>(
    '/:grantId/:messageId',
    {
      schema: {
        params: getEmailParamsSchema,
        body: updateEmailBodySchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: EmailParams; Body: UpdateEmailBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { grantId, messageId } = request.params;

        const message = await updateEmail(grantId, messageId, request.body);

        fastify.log.info({
          msg: 'Email updated successfully',
          messageId,
          grantId,
        });

        return reply.send({
          success: true,
          data: message,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Update email error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to update email',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Trash Email
  // ==========================================

  /**
   * DELETE /email/:grantId/:messageId
   * Move email to trash
   */
  fastify.delete<{ Params: EmailParams }>(
    '/:grantId/:messageId',
    {
      schema: {
        params: getEmailParamsSchema,
        response: {
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Params: EmailParams }>, reply: FastifyReply) => {
      try {
        const { grantId, messageId } = request.params;

        await trashEmail(grantId, messageId);

        fastify.log.info({
          msg: 'Email trashed successfully',
          messageId,
          grantId,
        });

        return reply.send({
          success: true,
          message: 'Email trashed successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Trash email error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to trash email',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
