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
  LATEST_PROTOCOL_VERSION,
} from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  executeTool,
  executeSchema,
  execute,
  type ExecuteInput,
} from './tools/execute';

import {
  listAgentsTool,
  listAgentsSchema,
  listAgents,
  type ListAgentsInput,
} from './tools/list-agents';

import {
  listAgentsByTeamTool,
  listAgentsByTeamSchema,
  listAgentsByTeam,
  type ListAgentsByTeamInput,
} from './tools/list-agents-by-team';

import {
  getAgentPromptTool,
  getAgentPromptSchema,
  getAgentPrompt,
  type GetAgentPromptInput,
} from './tools/get-agent-prompt';

import {
  updateAgentPromptTool,
  updateAgentPromptSchema,
  updateAgentPrompt,
  type UpdateAgentPromptInput,
} from './tools/update-agent-prompt';

import {
  updateAgentTool,
  updateAgentSchema,
  updateAgent,
  type UpdateAgentInput,
} from './tools/update-agent';

import {
  listWorkspaceItemsTool,
  listWorkspaceItemsSchema,
  listWorkspaceItems,
  type ListWorkspaceItemsInput,
} from './tools/list-workspace-items';

import {
  getWorkspaceItemTool,
  getWorkspaceItemSchema,
  getWorkspaceItem,
  type GetWorkspaceItemInput,
} from './tools/get-workspace-item';

import {
  getAgentInfoTool,
  getAgentInfoSchema,
  getAgentInfo,
  type GetAgentInfoInput,
} from './tools/get-agent-info';

import {
  listTeamsTool,
  listTeamsSchema,
  listTeams,
  type ListTeamsInput,
} from './tools/list-teams';

import {
  createAgentTool,
  createAgentSchema,
  createAgent,
  type CreateAgentInput,
} from './tools/create-agent';

import {
  assignAgentToTeamTool,
  assignAgentToTeamSchema,
  assignAgentToTeam,
  type AssignAgentToTeamInput,
} from './tools/assign-agent-to-team';

import {
  addWorkspaceItemTool,
  addWorkspaceItemSchema,
  addWorkspaceItem,
  type AddWorkspaceItemInput,
} from './tools/add-workspace-item';

import {
  deleteWorkspaceItemTool,
  deleteWorkspaceItemSchema,
  deleteWorkspaceItem,
  type DeleteWorkspaceItemInput,
} from './tools/delete-workspace-item';

/**
 * MCP Server for HTTP transport
 */
export class MCPHttpServer {
  private server: Server;

  constructor() {
    // Create MCP server
    this.server = new Server(
      {
        name: 'sb-agent-hub',
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
    // Handle initialization
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => ({
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        logging: {},
      },
      serverInfo: {
        name: 'sb-agent-hub',
        version: '1.0.0',
      },
    }));

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: executeTool.name,
          description: executeTool.description,
          inputSchema: executeSchema,
        },
        {
          name: listAgentsTool.name,
          description: listAgentsTool.description,
          inputSchema: listAgentsSchema,
        },
        {
          name: listAgentsByTeamTool.name,
          description: listAgentsByTeamTool.description,
          inputSchema: listAgentsByTeamSchema,
        },
        {
          name: getAgentPromptTool.name,
          description: getAgentPromptTool.description,
          inputSchema: getAgentPromptSchema,
        },
        {
          name: updateAgentPromptTool.name,
          description: updateAgentPromptTool.description,
          inputSchema: updateAgentPromptSchema,
        },
        {
          name: updateAgentTool.name,
          description: updateAgentTool.description,
          inputSchema: updateAgentSchema,
        },
        {
          name: listWorkspaceItemsTool.name,
          description: listWorkspaceItemsTool.description,
          inputSchema: listWorkspaceItemsSchema,
        },
        {
          name: getWorkspaceItemTool.name,
          description: getWorkspaceItemTool.description,
          inputSchema: getWorkspaceItemSchema,
        },
        {
          name: getAgentInfoTool.name,
          description: getAgentInfoTool.description,
          inputSchema: getAgentInfoSchema,
        },
        {
          name: listTeamsTool.name,
          description: listTeamsTool.description,
          inputSchema: listTeamsSchema,
        },
        {
          name: createAgentTool.name,
          description: createAgentTool.description,
          inputSchema: createAgentSchema,
        },
        {
          name: assignAgentToTeamTool.name,
          description: assignAgentToTeamTool.description,
          inputSchema: assignAgentToTeamSchema,
        },
        {
          name: addWorkspaceItemTool.name,
          description: addWorkspaceItemTool.description,
          inputSchema: addWorkspaceItemSchema,
        },
        {
          name: deleteWorkspaceItemTool.name,
          description: deleteWorkspaceItemTool.description,
          inputSchema: deleteWorkspaceItemSchema,
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute': {
          // Validate input
          const parseResult = executeSchema.safeParse(args);
          if (!parseResult.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid parameters: ${parseResult.error.message}`,
            );
          }

          // Get user context from request (set by auth middleware)
          // This will be passed through the request context
          throw new McpError(
            ErrorCode.InvalidRequest,
            'User context required. This should be called through the HTTP endpoint with auth.',
          );
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
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
        const requestedVersion =
          jsonRpcRequest.params?.protocolVersion || '2024-11-05';

        res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: requestedVersion,
            capabilities: {
              tools: {},
              logging: {},
            },
            serverInfo: {
              name: 'sb-agent-hub',
              version: '1.0.0',
            },
          },
          id: jsonRpcRequest.id,
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
        // Convert all schemas to inline format (no $ref) for MCP compatibility
        const tools = [
          {
            name: executeTool.name,
            description: executeTool.description,
            inputSchema: zodToJsonSchema(executeSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: listAgentsTool.name,
            description: listAgentsTool.description,
            inputSchema: zodToJsonSchema(listAgentsSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: listAgentsByTeamTool.name,
            description: listAgentsByTeamTool.description,
            inputSchema: zodToJsonSchema(listAgentsByTeamSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: getAgentPromptTool.name,
            description: getAgentPromptTool.description,
            inputSchema: zodToJsonSchema(getAgentPromptSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: updateAgentPromptTool.name,
            description: updateAgentPromptTool.description,
            inputSchema: zodToJsonSchema(updateAgentPromptSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: updateAgentTool.name,
            description: updateAgentTool.description,
            inputSchema: zodToJsonSchema(updateAgentSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: listWorkspaceItemsTool.name,
            description: listWorkspaceItemsTool.description,
            inputSchema: zodToJsonSchema(listWorkspaceItemsSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: getWorkspaceItemTool.name,
            description: getWorkspaceItemTool.description,
            inputSchema: zodToJsonSchema(getWorkspaceItemSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: getAgentInfoTool.name,
            description: getAgentInfoTool.description,
            inputSchema: zodToJsonSchema(getAgentInfoSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: listTeamsTool.name,
            description: listTeamsTool.description,
            inputSchema: zodToJsonSchema(listTeamsSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: createAgentTool.name,
            description: createAgentTool.description,
            inputSchema: zodToJsonSchema(createAgentSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: assignAgentToTeamTool.name,
            description: assignAgentToTeamTool.description,
            inputSchema: zodToJsonSchema(assignAgentToTeamSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: addWorkspaceItemTool.name,
            description: addWorkspaceItemTool.description,
            inputSchema: zodToJsonSchema(addWorkspaceItemSchema, {
              $refStrategy: 'none',
            }),
          },
          {
            name: deleteWorkspaceItemTool.name,
            description: deleteWorkspaceItemTool.description,
            inputSchema: zodToJsonSchema(deleteWorkspaceItemSchema, {
              $refStrategy: 'none',
            }),
          },
        ];

        res.json({
          jsonrpc: '2.0',
          result: { tools },
          id: jsonRpcRequest.id,
        });
        return;
      }

      // All other methods require authentication
      if (!companyId || !userId) {
        // Return 401 with WWW-Authenticate header per RFC 9728
        res
          .status(401)
          .header(
            'WWW-Authenticate',
            'Bearer realm="MCP", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"',
          )
          .json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Authentication required',
            },
            id: jsonRpcRequest.id,
          });
        return;
      }

      // Handle tool calls with user context
      if (jsonRpcRequest.method === 'tools/call') {
        const toolName = jsonRpcRequest.params?.name;
        const toolArgs = jsonRpcRequest.params?.arguments;

        try {
          let result;

          switch (toolName) {
            case 'execute': {
              const parseResult = executeSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await execute(
                parseResult.data as ExecuteInput,
                companyId,
                userId,
              );
              break;
            }

            case 'list_agents': {
              const parseResult = listAgentsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listAgents(
                parseResult.data as ListAgentsInput,
                companyId,
              );
              break;
            }

            case 'list_agents_by_team': {
              const parseResult = listAgentsByTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listAgentsByTeam(
                parseResult.data as ListAgentsByTeamInput,
                companyId,
              );
              break;
            }

            case 'get_agent_prompt': {
              const parseResult = getAgentPromptSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getAgentPrompt(
                parseResult.data as GetAgentPromptInput,
                companyId,
              );
              break;
            }

            case 'update_agent_prompt': {
              const parseResult = updateAgentPromptSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await updateAgentPrompt(
                parseResult.data as UpdateAgentPromptInput,
                companyId,
              );
              break;
            }

            case 'update_agent': {
              const parseResult = updateAgentSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await updateAgent(
                parseResult.data as UpdateAgentInput,
                companyId,
              );
              break;
            }

            case 'list_workspace_items': {
              const parseResult = listWorkspaceItemsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listWorkspaceItems(
                parseResult.data as ListWorkspaceItemsInput,
                companyId,
              );
              break;
            }

            case 'get_workspace_item': {
              const parseResult = getWorkspaceItemSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getWorkspaceItem(
                parseResult.data as GetWorkspaceItemInput,
                companyId,
              );
              break;
            }

            case 'get_agent_info': {
              const parseResult = getAgentInfoSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getAgentInfo(
                parseResult.data as GetAgentInfoInput,
                companyId,
              );
              break;
            }

            case 'list_teams': {
              const parseResult = listTeamsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listTeams(
                parseResult.data as ListTeamsInput,
                companyId,
              );
              break;
            }

            case 'create_agent': {
              const parseResult = createAgentSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await createAgent(
                parseResult.data as CreateAgentInput,
                companyId,
              );
              break;
            }

            case 'assign_agent_to_team': {
              const parseResult = assignAgentToTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await assignAgentToTeam(
                parseResult.data as AssignAgentToTeamInput,
                companyId,
              );
              break;
            }

            case 'add_workspace_item': {
              const parseResult = addWorkspaceItemSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await addWorkspaceItem(
                parseResult.data as AddWorkspaceItemInput,
                companyId,
              );
              break;
            }

            case 'delete_workspace_item': {
              const parseResult = deleteWorkspaceItemSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await deleteWorkspaceItem(
                parseResult.data as DeleteWorkspaceItemInput,
                companyId,
              );
              break;
            }

            default:
              res.status(400).json({
                jsonrpc: '2.0',
                error: {
                  code: -32601,
                  message: `Unknown tool: ${toolName}`,
                },
                id: jsonRpcRequest.id,
              });
              return;
          }

          res.json({
            jsonrpc: '2.0',
            result,
            id: jsonRpcRequest.id,
          });
          return;
        } catch (toolError: any) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: toolError.message || 'Tool execution failed',
            },
            id: jsonRpcRequest.id,
          });
          return;
        }
      }

      // Unknown method
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${jsonRpcRequest.method}`,
        },
        id: jsonRpcRequest.id,
      });
    } catch (error) {
      console.error('MCP request error:', error);

      // Send error response in JSON-RPC format
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
        id: req.body?.id || null,
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
