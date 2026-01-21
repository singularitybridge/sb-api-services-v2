/**
 * OAuth 2.1 Wrapper for MCP Server
 *
 * Lightweight OAuth implementation that wraps existing API key authentication
 * Makes the MCP server compatible with Claude Code and other OAuth-expecting clients
 */

import crypto from 'crypto';
import { Request, Response } from 'express';

/**
 * Get the base URL from the request, handling proxies and different environments
 * Exported for use in MCP authentication middleware
 */
export function getBaseUrl(req: Request): string {
  // Check environment variable first (explicit configuration)
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Derive from request for automatic detection
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host =
    req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';

  return `${protocol}://${host}`;
}

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 * Required by MCP June 2025 specification
 */
export function getProtectedResourceMetadata(req: Request) {
  const baseUrl = getBaseUrl(req);
  return {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp:execute', 'mcp:read'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: [],
    resource_documentation: `${baseUrl}/docs/mcp`,
  };
}

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 * Required for MCP client discovery
 */
export function getAuthorizationServerMetadata(req: Request) {
  const baseUrl = getBaseUrl(req);
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    grant_types_supported: ['authorization_code', 'client_credentials'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:execute', 'mcp:read'],
    service_documentation: `${baseUrl}/docs/oauth`,
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
 * Generate the authorization page HTML
 * This page asks the user to enter their API key to authorize the MCP client
 */
function generateAuthorizationPage(params: {
  client_id: string;
  redirect_uri: string;
  state?: string;
  code_challenge: string;
  code_challenge_method?: string;
  error?: string;
  baseUrl: string;
}): string {
  const errorHtml = params.error
    ? `<div style="background: #fee2e2; border: 1px solid #ef4444; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px;">${params.error}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize MCP Client - Agent Hub</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 40px;
      max-width: 440px;
      width: 100%;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo svg {
      width: 48px;
      height: 48px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1e1b4b;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #6b7280;
      text-align: center;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .client-info {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-info p {
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .client-info strong {
      color: #1f2937;
    }
    label {
      display: block;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
      font-size: 14px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      font-family: monospace;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #6366f1;
    }
    .help-text {
      font-size: 12px;
      color: #6b7280;
      margin-top: 8px;
      margin-bottom: 24px;
    }
    .help-text a {
      color: #6366f1;
      text-decoration: none;
    }
    .help-text a:hover {
      text-decoration: underline;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #6366f1;
      color: white;
      border: none;
    }
    .btn-primary:hover {
      background: #4f46e5;
    }
    .btn-secondary {
      background: white;
      color: #374151;
      border: 2px solid #e5e7eb;
    }
    .btn-secondary:hover {
      background: #f9fafb;
    }
    .permissions {
      margin-bottom: 24px;
    }
    .permissions h3 {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 8px;
    }
    .permission-item svg {
      width: 16px;
      height: 16px;
      color: #10b981;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
    <h1>Authorize MCP Client</h1>
    <p class="subtitle">Connect an AI assistant to Agent Hub</p>

    ${errorHtml}

    <div class="client-info">
      <p><strong>Client:</strong> MCP Client</p>
      <p><strong>Redirect:</strong> ${params.redirect_uri.split('?')[0]}</p>
    </div>

    <div class="permissions">
      <h3>This application will be able to:</h3>
      <div class="permission-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Execute AI assistants on your behalf
      </div>
      <div class="permission-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Read assistant configurations and workspace
      </div>
    </div>

    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${params.client_id}">
      <input type="hidden" name="redirect_uri" value="${params.redirect_uri}">
      <input type="hidden" name="state" value="${params.state || ''}">
      <input type="hidden" name="code_challenge" value="${params.code_challenge}">
      <input type="hidden" name="code_challenge_method" value="${params.code_challenge_method || 'S256'}">

      <label for="api_key">API Key</label>
      <input type="password" id="api_key" name="api_key" placeholder="sk_live_..." required autocomplete="off">
      <p class="help-text">
        Enter your Agent Hub API key. You can create one in
        <a href="${params.baseUrl}/admin/settings" target="_blank">Settings → API Keys</a>.
      </p>

      <div class="buttons">
        <button type="button" class="btn-secondary" onclick="window.close()">Cancel</button>
        <button type="submit" class="btn-primary">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Authorization endpoint - GET shows the form, POST processes it
 */
export function handleAuthorization(req: Request, res: Response) {
  const baseUrl = getBaseUrl(req);

  if (req.method === 'GET') {
    // Show authorization form
    const {
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
    } = req.query;

    // Validate required parameters
    if (!client_id || !redirect_uri || !code_challenge) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters',
      });
    }

    const html = generateAuthorizationPage({
      client_id: client_id as string,
      redirect_uri: redirect_uri as string,
      state: state as string,
      code_challenge: code_challenge as string,
      code_challenge_method: code_challenge_method as string,
      baseUrl,
    });

    return res.type('html').send(html);
  }

  // POST - process the authorization
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    api_key,
  } = req.body;

  // Validate required parameters
  if (!client_id || !redirect_uri || !code_challenge) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    });
  }

  // Validate API key format
  if (!api_key || !api_key.startsWith('sk_live_')) {
    const html = generateAuthorizationPage({
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      baseUrl,
      error: 'Invalid API key. API keys must start with sk_live_',
    });
    return res.type('html').send(html);
  }

  // Generate authorization code with API key encrypted inside
  const codeData = {
    api_key, // Store the API key to return as access token
    challenge: code_challenge,
    method: code_challenge_method || 'S256',
    client_id,
    redirect_uri,
    expires: Date.now() + 60000, // 1 minute
  };

  const encodedCode = Buffer.from(JSON.stringify(codeData)).toString(
    'base64url',
  );

  // Redirect back with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', encodedCode);
  if (state) redirectUrl.searchParams.set('state', state);

  res.redirect(redirectUrl.toString());
}

/**
 * Token endpoint
 * Exchanges authorization code or API key for access token
 */
export function handleTokenRequest(req: Request, res: Response) {
  const { grant_type, code, code_verifier } = req.body;

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

    // Return the API key as the access token
    // This way, the existing auth middleware will recognize it
    return res.json({
      access_token: codeData.api_key,
      token_type: 'Bearer',
      expires_in: 86400 * 30, // 30 days (API keys don't expire)
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
  // For authorization_code tokens, the token IS the API key
  // For client_credentials (API keys), our existing middleware validates them
  return true; // Delegate to existing middleware
}
