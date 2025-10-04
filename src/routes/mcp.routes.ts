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
 * GET /api/mcp/info
 * Get MCP server information
 */
router.get('/info', (req: Request, res: Response) => {
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
