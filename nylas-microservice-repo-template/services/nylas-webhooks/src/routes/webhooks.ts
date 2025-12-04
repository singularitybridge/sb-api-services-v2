/**
 * Webhook Routes - Fastify Implementation
 *
 * Routes:
 * - POST /webhooks        - Receive Nylas webhooks
 * - GET  /webhooks/verify - Webhook verification (Nylas setup)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  processWebhookEvent,
  processBatchWebhooks,
  verifyWebhookSignature,
  WebhookPayload,
} from '../services/webhook-processor.service.js';
import { config } from '../config.js';

// ==========================================
// Type Definitions
// ==========================================

interface WebhookRequest {
  Body: WebhookPayload;
  Headers: {
    'x-nylas-signature'?: string;
  };
}

interface VerifyRequest {
  Querystring: {
    challenge?: string;
  };
}

// ==========================================
// Routes Registration
// ==========================================

export default async function webhooksRoutes(fastify: FastifyInstance) {
  // ==========================================
  // Webhook Verification (GET)
  // ==========================================

  /**
   * GET /webhooks/verify
   * Nylas webhook verification endpoint
   * Returns challenge parameter for webhook setup
   */
  fastify.get<{ Querystring: { challenge?: string } }>(
    '/verify',
    async (
      request: FastifyRequest<{ Querystring: { challenge?: string } }>,
      reply: FastifyReply
    ) => {
      const { challenge } = request.query;

      if (!challenge) {
        return reply.status(400).send({
          success: false,
          error: 'Missing challenge parameter',
        });
      }

      fastify.log.info({
        msg: 'Webhook verification request',
        challenge,
      });

      // Return challenge for verification
      return reply.send({
        challenge,
      });
    }
  );

  // ==========================================
  // Receive Webhooks (POST)
  // ==========================================

  /**
   * POST /webhooks
   * Main webhook receiver endpoint
   * Processes Nylas webhook events
   */
  fastify.post<WebhookRequest>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            deltas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                  specversion: { type: 'string' },
                  source: { type: 'string' },
                  time: { type: 'string' },
                  data: { type: 'object' },
                },
                required: ['id', 'type', 'data'],
              },
            },
          },
          required: ['deltas'],
        },
      },
    },
    async (request: FastifyRequest<WebhookRequest>, reply: FastifyReply) => {
      const startTime = Date.now();

      try {
        // Get raw body for signature verification
        const rawBody = JSON.stringify(request.body);
        const signature = request.headers['x-nylas-signature'];

        // Verify webhook signature
        const isValid = verifyWebhookSignature(
          rawBody,
          signature,
          config.webhookSecret
        );

        if (!isValid) {
          fastify.log.warn({
            msg: 'Invalid webhook signature',
            signature,
          });

          return reply.status(401).send({
            success: false,
            error: 'Invalid webhook signature',
          });
        }

        const payload = request.body;

        fastify.log.info({
          msg: 'Webhook received',
          eventCount: payload.deltas.length,
          types: payload.deltas.map((d) => d.type),
        });

        // Process webhook events
        const results = await processBatchWebhooks(payload);

        const duration = Date.now() - startTime;

        fastify.log.info({
          msg: 'Webhook processing complete',
          processed: results.processed,
          failed: results.failed,
          duration,
        });

        // Return success even if some events failed
        // Nylas will retry failed webhooks
        return reply.send({
          success: true,
          processed: results.processed,
          failed: results.failed,
          errors: results.errors,
          duration,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;

        fastify.log.error({
          err: error,
          msg: 'Webhook processing error',
          duration,
        });

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to process webhook',
          duration,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // Test Endpoint (Development Only)
  // ==========================================

  /**
   * POST /webhooks/test
   * Test endpoint for simulating webhooks
   * Only available in development
   */
  if (process.env.NODE_ENV !== 'production') {
    fastify.post(
      '/test',
      async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        try {
          const body = request.body as any;
          const testEvent = {
            id: `test-${Date.now()}`,
            type: body.type || 'message.created',
            specversion: '1.0',
            source: 'test',
            time: new Date().toISOString(),
            data: body.data || { object: { id: 'test-123' } },
          };

          await processWebhookEvent(testEvent);

          return reply.send({
            success: true,
            message: 'Test webhook processed',
            event: testEvent,
          });
        } catch (error: any) {
          return reply.status(500).send({
            success: false,
            error: error.message,
          });
        }
      }
    );
  }
}
