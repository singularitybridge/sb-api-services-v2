/**
 * MCP Server Configuration
 *
 * Configuration for the MCP HTTP server integration.
 * When using HTTP transport, authentication is handled by Express middleware,
 * so the API client gets the auth from the request context.
 */

export interface MCPConfig {
  apiBaseUrl: string;
  apiKey?: string; // Optional, provided by request context in HTTP mode
}

/**
 * Load configuration for HTTP-integrated MCP server
 * The API key will be extracted from the request Authorization header by Express middleware
 */
export function loadConfig(): MCPConfig {
  // For HTTP mode, we connect to localhost since we're part of the same app
  const apiBaseUrl = 'http://localhost:3000';

  return {
    apiBaseUrl,
  };
}
