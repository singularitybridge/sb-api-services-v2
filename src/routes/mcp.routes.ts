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
 * Per MCP spec: servers that don't need to initiate messages may return 405
 * But for compatibility with Claude.ai, we'll accept and keep connection open
 */
router.get('/', (req: Request, res: Response) => {
  // Check Accept header
  const acceptHeader = req.headers.accept || '';
  const acceptsSSE = acceptHeader.includes('text/event-stream');

  if (!acceptsSSE) {
    // Per spec: if client doesn't accept SSE, return 405
    return res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'GET requests must accept text/event-stream',
      },
      id: null,
    });
  }

  // Set SSE headers - include all headers that help bypass CDN buffering
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Generate session ID if not provided
  const sessionId =
    (req.headers['mcp-session-id'] as string) ||
    `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  res.setHeader('Mcp-Session-Id', sessionId);

  // Disable Nagle's algorithm for immediate sending
  if (req.socket) {
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
  }

  // Write status and flush headers
  res.status(200);
  res.flushHeaders();

  // Send retry directive and initial padding to trigger CDN streaming
  // Cloudflare may buffer until it sees enough data
  const padding = ' '.repeat(2048); // 2KB padding
  res.write(`:${padding}\n`);
  res.write('retry: 3000\n\n');

  // Send initial connection event
  res.write(`event: open\ndata: {"sessionId":"${sessionId}"}\n\n`);

  // Keep connection alive with periodic heartbeats
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000); // More frequent heartbeats

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
  });

  // Note: For now we don't send server-initiated messages
  // This just keeps the SSE channel open for compatibility
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
