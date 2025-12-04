/**
 * Nylas Service - Fastify Microservice
 *
 * Handles all Nylas operations (OAuth, Calendar, Contacts, Email)
 * Called by main Express app via HTTP
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config, validateConfig } from './config.js';
import oauthRoutes from './routes/oauth.js';
import calendarRoutes from './routes/calendar.js';
import contactsRoutes from './routes/contacts.js';
import emailRoutes from './routes/email.js';

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
});

// Register plugins
await fastify.register(cors, {
  origin: true, // Allow all origins (internal service)
  credentials: true,
});

await fastify.register(helmet, {
  contentSecurityPolicy: false, // Not serving HTML
});

await fastify.register(rateLimit, {
  max: 1000, // Generous limit for internal service
  timeWindow: '1 minute',
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'nylas-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  };
});

// Service info endpoint
fastify.get('/info', async (request, reply) => {
  return {
    name: 'Nylas Service',
    version: '1.0.0',
    description: 'Fastify microservice for Nylas integration',
    endpoints: [
      '/oauth/authorize',
      '/oauth/callback',
      '/calendar/availability',
      '/calendar/schedule',
      '/calendar/find-slot',
      '/contacts/find',
      '/contacts/get',
      '/contacts/create',
      '/contacts/update',
      '/contacts/delete',
      '/email/send',
      '/email/find',
      '/email/get',
      '/email/mark-read',
    ],
  };
});

// Register routes
await fastify.register(oauthRoutes, { prefix: '/oauth' });
await fastify.register(calendarRoutes, { prefix: '/calendar' });
await fastify.register(contactsRoutes, { prefix: '/contacts' });
await fastify.register(emailRoutes, { prefix: '/email' });

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

    const port = config.port || 3001;
    const host = config.host || '127.0.0.1'; // Internal only by default

    await fastify.listen({ port, host });

    fastify.log.info(`🚀 Nylas Service listening on ${host}:${port}`);
    fastify.log.info(`📊 Health check: http://${host}:${port}/health`);
    fastify.log.info(`ℹ️  Service info: http://${host}:${port}/info`);
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
