/**
 * MCP HTTP Server Integration
 *
 * HTTP transport for the MCP server, integrated with Express
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  McpError,
  ErrorCode,
  LATEST_PROTOCOL_VERSION
} from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  executeAssistantTool,
  executeAssistantSchema,
  executeAssistantDirect,
  type ExecuteAssistantInput
} from './tools/execute-assistant-direct';

/**
 * MCP Server for HTTP transport
 */
export class MCPHttpServer {
  private server: Server;

  constructor() {
    // Create MCP server
    this.server = new Server(
      {
        name: 'singularity-bridge',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle initialization
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => ({
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        logging: {}
      },
      serverInfo: {
        name: 'singularity-bridge',
        version: '1.0.0'
      }
    }));

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: executeAssistantTool.name,
          description: executeAssistantTool.description,
          inputSchema: executeAssistantSchema
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute_assistant': {
          // Validate input
          const parseResult = executeAssistantSchema.safeParse(args);
          if (!parseResult.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid parameters: ${parseResult.error.message}`
            );
          }

          // Get user context from request (set by auth middleware)
          // This will be passed through the request context
          throw new McpError(
            ErrorCode.InvalidRequest,
            'User context required. This should be called through the HTTP endpoint with auth.'
          );
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    });
  }

  /**
   * Handle HTTP request/response for MCP protocol
   */
  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      // Get the JSON-RPC request from the body
      const jsonRpcRequest = req.body;

      // Get user context from Express middleware
      const companyId = (req as any).company?.id;
      const userId = (req as any).user?.id;

      // Handle initialize (no auth required for capability negotiation)
      if (jsonRpcRequest.method === 'initialize') {
        // Use the client's requested protocol version for compatibility
        const requestedVersion = jsonRpcRequest.params?.protocolVersion || '2024-11-05';

        res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: requestedVersion,
            capabilities: {
              tools: {},
              logging: {}
            },
            serverInfo: {
              name: 'singularity-bridge',
              version: '1.0.0'
            }
          },
          id: jsonRpcRequest.id
        });
        return;
      }

      // Handle initialized notification (no auth required, no response needed)
      if (jsonRpcRequest.method === 'notifications/initialized') {
        res.status(204).send(); // No Content
        return;
      }

      // Handle tools/list (no auth required for capability discovery)
      if (jsonRpcRequest.method === 'tools/list') {
        // Convert schema to inline format (no $ref) for MCP compatibility
        const schema = zodToJsonSchema(executeAssistantSchema, {
          $refStrategy: 'none'
        });

        res.json({
          jsonrpc: '2.0',
          result: {
            tools: [
              {
                name: executeAssistantTool.name,
                description: executeAssistantTool.description,
                inputSchema: schema
              }
            ]
          },
          id: jsonRpcRequest.id
        });
        return;
      }

      // All other methods require authentication
      if (!companyId || !userId) {
        // Return 401 with WWW-Authenticate header per RFC 9728
        res.status(401)
          .header('WWW-Authenticate', 'Bearer realm="MCP", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"')
          .json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Authentication required'
            },
            id: jsonRpcRequest.id
          });
        return;
      }

      // Handle tool calls with user context
      if (jsonRpcRequest.method === 'tools/call' && jsonRpcRequest.params?.name === 'execute_assistant') {
        const parseResult = executeAssistantSchema.safeParse(jsonRpcRequest.params.arguments);
        if (!parseResult.success) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: `Invalid parameters: ${parseResult.error.message}`
            },
            id: jsonRpcRequest.id
          });
          return;
        }

        const result = await executeAssistantDirect(
          parseResult.data as ExecuteAssistantInput,
          companyId,
          userId
        );

        res.json({
          jsonrpc: '2.0',
          result,
          id: jsonRpcRequest.id
        });
        return;
      }

      // Unknown method
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${jsonRpcRequest.method}`
        },
        id: jsonRpcRequest.id
      });
    } catch (error) {
      console.error('MCP request error:', error);

      // Send error response in JSON-RPC format
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: req.body?.id || null
      });
    }
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): Server {
    return this.server;
  }
}
