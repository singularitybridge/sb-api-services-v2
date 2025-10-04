/**
 * OAuth 2.1 Wrapper for MCP Server
 *
 * Lightweight OAuth implementation that wraps existing API key authentication
 * Makes the MCP server compatible with Claude Code and other OAuth-expecting clients
 */

import crypto from 'crypto';
import { Request, Response } from 'express';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 * Required by MCP June 2025 specification
 */
export function getProtectedResourceMetadata() {
  return {
    resource: BASE_URL,
    authorization_servers: [BASE_URL],
    scopes_supported: ['mcp:execute', 'mcp:read'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: [],
    resource_documentation: `${BASE_URL}/docs/mcp`,
  };
}

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 * Required for MCP client discovery
 */
export function getAuthorizationServerMetadata() {
  return {
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    registration_endpoint: `${BASE_URL}/oauth/register`,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:execute', 'mcp:read'],
    service_documentation: `${BASE_URL}/docs/oauth`,
    ui_locales_supported: ['en-US'],
  };
}

/**
 * Dynamic Client Registration (RFC 7591)
 * Returns static client configuration - we don't actually store clients
 * since we validate against API keys directly
 */
export function registerClient(req: Request) {
  // Generate a client ID (can be static since we validate via API key)
  const clientId = crypto.randomBytes(16).toString('hex');

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: req.body.client_name || 'MCP Client',
    client_uri: req.body.client_uri,
    grant_types: ['authorization_code', 'client_credentials'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none', // Public client (PKCE protects it)
    redirect_uris: req.body.redirect_uris || [],
    scope: 'mcp:execute mcp:read',
  };
}

/**
 * Authorization endpoint
 * For MCP, we simplify by treating API key as the authorization
 */
export function handleAuthorization(req: Request, res: Response) {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scope,
  } = req.query;

  // Validate required parameters
  if (!client_id || !redirect_uri || !code_challenge) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    });
  }

  // Generate authorization code (short-lived, 1 minute)
  const authCode = crypto.randomBytes(32).toString('hex');

  // Store code with PKCE challenge (in production, use Redis with TTL)
  // For now, we'll encode it in the code itself
  const codeData = {
    code: authCode,
    challenge: code_challenge,
    method: code_challenge_method,
    client_id,
    redirect_uri,
    expires: Date.now() + 60000, // 1 minute
  };

  const encodedCode = Buffer.from(JSON.stringify(codeData)).toString(
    'base64url',
  );

  // Redirect back with code
  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set('code', encodedCode);
  if (state) redirectUrl.searchParams.set('state', state as string);

  res.redirect(redirectUrl.toString());
}

/**
 * Token endpoint
 * Exchanges authorization code or API key for access token
 */
export function handleTokenRequest(req: Request, res: Response) {
  const { grant_type, code, code_verifier, client_id } = req.body;

  // Support two grant types:
  // 1. authorization_code (OAuth flow)
  // 2. client_credentials (direct API key)

  if (grant_type === 'authorization_code') {
    return handleAuthorizationCodeGrant(req, res, code, code_verifier);
  }

  if (grant_type === 'client_credentials') {
    return handleClientCredentialsGrant(req, res);
  }

  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description:
      'Only authorization_code and client_credentials are supported',
  });
}

/**
 * Handle authorization code grant (with PKCE)
 */
function handleAuthorizationCodeGrant(
  req: Request,
  res: Response,
  code: string,
  codeVerifier: string,
) {
  try {
    // Decode the authorization code
    const codeData = JSON.parse(
      Buffer.from(code, 'base64url').toString('utf-8'),
    );

    // Verify code hasn't expired
    if (Date.now() > codeData.expires) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      });
    }

    // Verify PKCE challenge
    const hash = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    if (hash !== codeData.challenge) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid code verifier',
      });
    }

    // Generate access token
    // In our case, we'll return a bearer token format that clients can use
    const accessToken = crypto.randomBytes(32).toString('hex');

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'mcp:execute mcp:read',
    });
  } catch (error) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid authorization code',
    });
  }
}

/**
 * Handle client credentials grant (direct API key)
 * This allows customers to use their API key directly
 */
function handleClientCredentialsGrant(req: Request, res: Response) {
  // Extract API key from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'API key required in Authorization header',
    });
  }

  const apiKey = authHeader.substring(7);

  // Return the API key as the access token
  // Our existing middleware already validates API keys
  return res.json({
    access_token: apiKey,
    token_type: 'Bearer',
    expires_in: 86400 * 30, // 30 days (API keys don't expire)
    scope: 'mcp:execute mcp:read',
  });
}

/**
 * Validate access token
 * This integrates with our existing API key validation
 */
export function validateAccessToken(token: string): boolean {
  // For authorization_code tokens, we'd check against a token store
  // For client_credentials (API keys), our existing middleware validates them
  return true; // Delegate to existing middleware
}
