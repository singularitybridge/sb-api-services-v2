/**
 * MCP Routes
 *
 * HTTP endpoints for Model Context Protocol (MCP) integration
 */

import { Router, Request, Response } from 'express';
import { MCPHttpServer } from '../mcp/http-server';

const router = Router();

// Initialize MCP server (singleton)
let mcpServer: MCPHttpServer | null = null;

function getMCPServer(): MCPHttpServer {
  if (!mcpServer) {
    mcpServer = new MCPHttpServer();
  }
  return mcpServer;
}

/**
 * POST /api/mcp
 * Handle MCP JSON-RPC requests
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const server = getMCPServer();
    await server.handleRequest(req, res);
  } catch (error) {
    console.error('MCP endpoint error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
      },
      id: null,
    });
  }
});

/**
 * GET /api/mcp
 * Handle MCP SSE stream for server-to-client messages (Streamable HTTP transport)
 * Claude.ai requires an active SSE connection to mark the server as connected
 */
router.get('/', (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || '';
  const acceptsSSE = acceptHeader.includes('text/event-stream');

  if (!acceptsSSE) {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'GET requests must accept text/event-stream',
      },
      id: null,
    });
  }

  // SSE is just a notification channel - don't require or create sessions here
  // Sessions are managed by POST requests (initialize creates, others validate)
  // Don't echo back session IDs - let Claude use the one from initialize

  // Set SSE headers with aggressive anti-buffering for Cloudflare
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'no-cache, no-store, no-transform, must-revalidate, private',
  );
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Disable socket buffering
  if (req.socket) {
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 10000);
  }

  // Flush headers immediately
  res.flushHeaders();

  // Send a simple comment to confirm connection
  // Note: removed 4KB padding - testing if it was causing issues
  res.write(': ok\n\n');

  // Keep connection alive with heartbeats
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000); // Every 30 seconds

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

/**
 * GET /api/mcp/info
 * Get MCP server information
 */
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'singularity-bridge-mcp',
    version: '1.0.0',
    description:
      'Model Context Protocol server for Singularity Bridge AI Agent Hub',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
    tools: [
      {
        name: 'execute_assistant',
        description: 'Execute an AI assistant with a prompt',
      },
    ],
  });
});

export default router;
