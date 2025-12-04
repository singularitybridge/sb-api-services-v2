/**
 * Nylas Webhooks Service - Fastify Microservice
 *
 * Handles all Nylas webhook events
 * Processes and forwards to main Express app
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config, validateConfig } from './config.js';
import webhooksRoutes from './routes/webhooks.js';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  // Preserve raw body for signature verification
  bodyLimit: 1048576, // 1MB limit for webhooks
});

// Register plugins
await fastify.register(cors, {
  origin: true, // Allow all origins (Nylas will send webhooks)
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false, // Not serving HTML
});

await fastify.register(rateLimit, {
  max: 1000, // Generous limit for webhooks
  timeWindow: '1 minute',
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'nylas-webhooks',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  };
});

// Service info endpoint
fastify.get('/info', async (request, reply) => {
  return {
    name: 'Nylas Webhooks Service',
    version: '1.0.0',
    description: 'Fastify microservice for Nylas webhook processing',
    endpoints: [
      '/webhooks',
      '/webhooks/verify',
      '/webhooks/test (dev only)',
    ],
    supportedEvents: [
      'message.created',
      'message.updated',
      'thread.created',
      'event.created',
      'event.updated',
      'event.deleted',
      'contact.created',
      'contact.updated',
      'grant.expired',
    ],
  };
});

// Register webhook routes
await fastify.register(webhooksRoutes, { prefix: '/webhooks' });

// Error handler
fastify.setErrorHandler((error: any, request, reply) => {
  fastify.log.error(error);

  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message || 'Internal server error',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: request.url,
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    error: 'Route not found',
    statusCode: 404,
    path: request.url,
  });
});

// Start server
const start = async () => {
  try {
    // Validate configuration
    validateConfig();

    const port = config.port || 3002;
    const host = config.host || '127.0.0.1'; // Internal only by default

    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Webhooks Service listening on ${host}:${port}`);
    fastify.log.info(`📊 Health check: http://${host}:${port}/health`);
    fastify.log.info(`ℹ️  Service info: http://${host}:${port}/info`);
    fastify.log.info(`🔗 Webhook URL: http://${host}:${port}/webhooks`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, closing server gracefully...`);
    await fastify.close();
    process.exit(0);
  });
}

start();

export default fastify;
