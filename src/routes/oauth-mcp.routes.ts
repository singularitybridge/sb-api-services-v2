/**
 * OAuth 2.1 Routes for MCP Server
 *
 * Provides OAuth endpoints for MCP client authentication
 */

import { Router, Request, Response } from 'express';
import {
  getProtectedResourceMetadata,
  getAuthorizationServerMetadata,
  registerClient,
  handleAuthorization,
  handleTokenRequest,
} from '../services/oauth-mcp.service';

const router = Router();

/**
 * GET /.well-known/oauth-protected-resource
 * OAuth Protected Resource Metadata (RFC 9728)
 * Required by MCP June 2025 specification
 * Public endpoint - no auth required
 */
router.get(
  '/.well-known/oauth-protected-resource',
  (req: Request, res: Response) => {
    res.json(getProtectedResourceMetadata());
  },
);

/**
 * GET /.well-known/oauth-authorization-server
 * OAuth Authorization Server Metadata (RFC 8414)
 * Public endpoint - no auth required
 */
router.get(
  '/.well-known/oauth-authorization-server',
  (req: Request, res: Response) => {
    res.json(getAuthorizationServerMetadata());
  },
);

/**
 * POST /oauth/register
 * Dynamic Client Registration (RFC 7591)
 * Public endpoint - no auth required
 */
router.post('/oauth/register', (req: Request, res: Response) => {
  try {
    const clientInfo = registerClient(req);
    res.status(201).json(clientInfo);
  } catch (error) {
    console.error('Client registration error:', error);
    res.status(400).json({
      error: 'invalid_client_metadata',
      error_description:
        error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

/**
 * GET /oauth/authorize
 * Authorization endpoint
 * Public endpoint - handles authorization flow
 */
router.get('/oauth/authorize', handleAuthorization);

/**
 * POST /oauth/token
 * Token endpoint
 * Public endpoint - exchanges code/credentials for token
 */
router.post('/oauth/token', (req: Request, res: Response) => {
  handleTokenRequest(req, res);
});

export default router;
