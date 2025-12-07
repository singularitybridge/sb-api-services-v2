#!/usr/bin/env node
/**
 * Singularity Bridge MCP Server
 *
 * Model Context Protocol server for integrating with Claude Code.
 * Exposes AI assistant execution capabilities through MCP tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { APIClient } from './api-client.js';
import {
  executeAssistantTool,
  executeAssistantSchema,
  executeAssistant,
  type ExecuteAssistantInput,
} from './tools/execute-assistant.js';

/**
 * Main server class
 */
class SingularityBridgeMCPServer {
  private server: Server;
  private apiClient: APIClient;

  constructor() {
    // Load configuration
    const config = loadConfig();
    this.apiClient = new APIClient(config);

    // Create MCP server
    this.server = new Server(
      {
        name: 'singularity-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: executeAssistantTool.name,
          description: executeAssistantTool.description,
          inputSchema: executeAssistantSchema,
        },
      ],
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
              `Invalid parameters: ${parseResult.error.message}`,
            );
          }

          // Execute the tool
          return executeAssistant(
            this.apiClient,
            parseResult.data as ExecuteAssistantInput,
          );
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to stderr (stdout is used for MCP protocol)
    console.error('Singularity Bridge MCP Server started');
    console.error(
      'API Base URL:',
      process.env.SB_API_BASE_URL || 'http://localhost:3000',
    );
  }
}

/**
 * Entry point
 */
async function main(): Promise<void> {
  try {
    const server = new SingularityBridgeMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
