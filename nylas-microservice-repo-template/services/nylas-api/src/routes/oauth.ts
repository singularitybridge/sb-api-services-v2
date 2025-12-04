/**
 * Nylas OAuth Routes - Fastify Implementation
 *
 * Routes:
 * - GET  /oauth/authorize   - Initiate OAuth (get authorization URL)
 * - GET  /oauth/callback    - Handle OAuth callback from Nylas
 * - GET  /oauth/status      - Check connection status
 * - POST /oauth/disconnect  - Disconnect account
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getAuthorizationUrl,
  exchangeCodeForGrant,
  parseState,
  revokeGrant,
} from '../services/oauth.service.js';
import {
  authInitiateQuerySchema,
  authInitiateResponseSchema,
  callbackQuerySchema,
  statusQuerySchema,
  statusResponseSchema,
  disconnectBodySchema,
  disconnectResponseSchema,
  errorResponseSchema,
} from '../schemas/oauth.schemas.js';
import { config } from '../config.js';

// ==========================================
// Type Definitions
// ==========================================

interface AuthInitiateQuery {
  userId: string;
  companyId: string;
  provider?: 'google' | 'microsoft';
  redirect?: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

interface StatusQuery {
  userId: string;
  companyId: string;
}

interface DisconnectBody {
  userId: string;
  companyId: string;
  grantId?: string;
}

// ==========================================
// Routes Registration
// ==========================================

export default async function oauthRoutes(fastify: FastifyInstance) {
  // ==========================================
  // OAuth Initiation
  // ==========================================

  /**
   * GET /oauth/authorize
   * Generate OAuth authorization URL for user to connect their account
   */
  fastify.get<{ Querystring: AuthInitiateQuery }>(
    '/authorize',
    {
      schema: {
        querystring: authInitiateQuerySchema,
        response: {
          200: authInitiateResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: AuthInitiateQuery }>, reply: FastifyReply) => {
      try {
        const { userId, companyId, provider = 'google', redirect: customRedirect } = request.query;

        if (!userId || !companyId) {
          return reply.status(400).send({
            success: false,
            error: 'userId and companyId are required',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        // Generate authorization URL
        const { url, state } = await getAuthorizationUrl({
          userId,
          companyId,
          provider,
          customState: customRedirect,
        });

        fastify.log.info({
          msg: 'Generated OAuth authorization URL',
          userId,
          provider,
        });

        // Check if this is a browser request (redirect) or API request (JSON)
        const acceptHeader = request.headers.accept || '';
        const isBrowserRequest = acceptHeader.includes('text/html');

        if (isBrowserRequest) {
          // Direct browser access - redirect to OAuth
          return reply.redirect(url);
        } else {
          // API request - return JSON
          return reply.send({
            success: true,
            authUrl: url,
            state,
            provider,
          });
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, 'OAuth initiation error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to generate authorization URL',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // ==========================================
  // OAuth Callback
  // ==========================================

  /**
   * GET /oauth/callback
   * Handle OAuth callback from Nylas
   * Exchanges authorization code for grant and stores it
   */
  fastify.get<{ Querystring: CallbackQuery }>(
    '/callback',
    {
      schema: {
        querystring: callbackQuerySchema,
      },
    },
    async (request: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => {
      try {
        const { code, state, error, error_description } = request.query;

        // Check for OAuth errors
        if (error) {
          fastify.log.error({ error, error_description }, 'OAuth authorization failed');
          return reply.redirect(
            `${config.frontend.errorRedirect}&reason=${encodeURIComponent(error)}`
          );
        }

        // Validate required parameters
        if (!code || !state) {
          return reply.status(400).send({
            success: false,
            error: 'Missing code or state parameter',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        // Parse and validate state
        let parsedState;
        try {
          parsedState = parseState(state);
        } catch (error: any) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid or expired state',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        const { userId, companyId, custom: customRedirect } = parsedState;

        fastify.log.info({
          msg: 'Processing OAuth callback',
          userId,
          companyId,
        });

        // Exchange code for grant
        const grantInfo = await exchangeCodeForGrant(code);

        fastify.log.info({
          msg: 'Grant obtained successfully',
          grantId: grantInfo.id,
          email: grantInfo.email,
          provider: grantInfo.provider,
        });

        // Return grant info to main app for storage
        // Main app will handle database operations
        const successUrl = new URL(
          customRedirect || config.frontend.successRedirect
        );
        successUrl.searchParams.set('email', grantInfo.email);
        successUrl.searchParams.set('grantId', grantInfo.id);
        successUrl.searchParams.set('provider', grantInfo.provider);
        successUrl.searchParams.set('userId', userId);
        successUrl.searchParams.set('companyId', companyId);

        return reply.redirect(successUrl.toString());
      } catch (error: any) {
        fastify.log.error({ err: error }, 'OAuth callback error');

        return reply.redirect(
          `${config.frontend.errorRedirect}&message=${encodeURIComponent(error.message)}`
        );
      }
    }
  );

  // ==========================================
  // Connection Status
  // ==========================================

  /**
   * GET /oauth/status
   * Check if user has connected Nylas account
   * Note: This is a passthrough - main app handles database lookup
   */
  fastify.get<{ Querystring: StatusQuery }>(
    '/status',
    {
      schema: {
        querystring: statusQuerySchema,
        response: {
          200: statusResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: StatusQuery }>, reply: FastifyReply) => {
      const { userId, companyId } = request.query;

      if (!userId || !companyId) {
        return reply.status(400).send({
          success: false,
          error: 'userId and companyId are required',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // This is a passthrough endpoint
      // Main app should query its database and return status
      // This microservice doesn't have direct database access
      return reply.send({
        success: true,
        connected: false,
        message: 'Status check should be handled by main app',
      });
    }
  );

  // ==========================================
  // Disconnect Account
  // ==========================================

  /**
   * POST /oauth/disconnect
   * Revoke Nylas grant (API call only)
   * Main app handles database cleanup
   */
  fastify.post<{ Body: DisconnectBody }>(
    '/disconnect',
    {
      schema: {
        body: disconnectBodySchema,
        response: {
          200: disconnectResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: FastifyRequest<{ Body: DisconnectBody }>, reply: FastifyReply) => {
      try {
        const { userId, companyId, grantId } = request.body;

        if (!userId || !companyId) {
          return reply.status(400).send({
            success: false,
            error: 'userId and companyId are required',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
        }

        // Revoke grant via Nylas API if grantId provided
        if (grantId) {
          await revokeGrant(grantId);
          fastify.log.info({
            msg: 'Grant revoked successfully',
            userId,
            grantId,
          });
        }

        return reply.send({
          success: true,
          message: 'Grant revoked successfully',
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Disconnect error');

        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to disconnect account',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
