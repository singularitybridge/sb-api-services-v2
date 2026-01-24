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
import { z } from 'zod';
import { getBaseUrl } from '../services/oauth-mcp.service';

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
  createTeamTool,
  createTeamSchema,
  createTeam,
  type CreateTeamInput,
} from './tools/create-team';

import {
  updateTeamTool,
  updateTeamSchema,
  updateTeam,
  type UpdateTeamInput,
} from './tools/update-team';

import {
  deleteTeamTool,
  deleteTeamSchema,
  deleteTeam,
  type DeleteTeamInput,
} from './tools/delete-team';

import {
  getTeamTool,
  getTeamSchema,
  getTeam,
  type GetTeamInput,
} from './tools/get-team';

import {
  removeAgentFromTeamTool,
  removeAgentFromTeamSchema,
  removeAgentFromTeam,
  type RemoveAgentFromTeamInput,
} from './tools/remove-agent-from-team';

import {
  getCostSummaryToolMeta,
  getCostSummarySchema,
  getCostSummaryTool,
  type GetCostSummaryInput,
} from './tools/get-cost-summary';

import {
  deleteAgentTool,
  deleteAgentSchema,
  deleteAgent,
  type DeleteAgentInput,
} from './tools/delete-agent';

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

import {
  moveWorkspaceItemTool,
  moveWorkspaceItemSchema,
  moveWorkspaceItem,
  type MoveWorkspaceItemInput,
} from './tools/move-workspace-item';

import {
  vectorSearchWorkspaceTool,
  vectorSearchWorkspaceSchema,
  vectorSearchWorkspace,
  type VectorSearchWorkspaceInput,
} from './tools/vector-search-workspace';

import {
  getUiContextTool,
  getUiContextSchema,
  getUiContext,
  type GetUiContextInput,
} from './tools/get-ui-context';

import {
  navigateToPageTool,
  navigateToPageSchema,
  navigateToPage,
  type NavigateToPageInput,
} from './tools/navigate-to-page';

import {
  openWorkspaceFileTool,
  openWorkspaceFileSchema,
  openWorkspaceFile,
  type OpenWorkspaceFileInput,
} from './tools/open-workspace-file';

import {
  showNotificationTool,
  showNotificationSchema,
  showNotification,
  type ShowNotificationInput,
} from './tools/show-notification';

import {
  listIntegrationsTool,
  listIntegrationsSchema,
  listIntegrations,
  type ListIntegrationsInput,
} from './tools/list-integrations';

import {
  getIntegrationDetailsTool,
  getIntegrationDetailsSchema,
  getIntegrationDetails,
  type GetIntegrationDetailsInput,
} from './tools/get-integration-details';

import {
  triggerIntegrationActionTool,
  triggerIntegrationActionSchema,
  triggerIntegrationAction,
  type TriggerIntegrationActionInput,
} from './tools/trigger-integration-action';

import {
  listModelsTool,
  listModelsSchema,
  listModels,
  type ListModelsInput,
} from './tools/list-models';

// Session data stored per session ID
interface MCPSession {
  createdAt: number;
  userId?: string;
  companyId?: string;
}

// Global session store (survives MCPHttpServer recreation)
const activeSessions = new Map<string, MCPSession>();

// Session expiry time (1 hour)
const SESSION_TTL_MS = 60 * 60 * 1000;

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

    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new session and return the session ID
   */
  createSession(userId?: string, companyId?: string): string {
    const sessionId = `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    activeSessions.set(sessionId, {
      createdAt: Date.now(),
      userId,
      companyId,
    });
    return sessionId;
  }

  /**
   * Check if a session ID is valid
   */
  isValidSession(sessionId: string): boolean {
    if (!sessionId) return false;
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    // Check if session has expired
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(sessionId);
      return false;
    }
    return true;
  }

  /**
   * Get session data
   */
  getSession(sessionId: string): MCPSession | undefined {
    return activeSessions.get(sessionId);
  }

  /**
   * Remove expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of activeSessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        activeSessions.delete(id);
        cleaned++;
      }
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle initialization
    this.server.setRequestHandler(
      InitializeRequestSchema,
      async (_request) => ({
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          logging: {},
        },
        serverInfo: {
          name: 'sb-agent-hub',
          version: '1.0.0',
        },
      }),
    );

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
          name: createTeamTool.name,
          description: createTeamTool.description,
          inputSchema: createTeamSchema,
        },
        {
          name: updateTeamTool.name,
          description: updateTeamTool.description,
          inputSchema: updateTeamSchema,
        },
        {
          name: deleteTeamTool.name,
          description: deleteTeamTool.description,
          inputSchema: deleteTeamSchema,
        },
        {
          name: getTeamTool.name,
          description: getTeamTool.description,
          inputSchema: getTeamSchema,
        },
        {
          name: removeAgentFromTeamTool.name,
          description: removeAgentFromTeamTool.description,
          inputSchema: removeAgentFromTeamSchema,
        },
        {
          name: getCostSummaryToolMeta.name,
          description: getCostSummaryToolMeta.description,
          inputSchema: getCostSummarySchema,
        },
        {
          name: deleteAgentTool.name,
          description: deleteAgentTool.description,
          inputSchema: deleteAgentSchema,
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
        {
          name: vectorSearchWorkspaceTool.name,
          description: vectorSearchWorkspaceTool.description,
          inputSchema: vectorSearchWorkspaceSchema,
        },
        {
          name: getUiContextTool.name,
          description: getUiContextTool.description,
          inputSchema: getUiContextSchema,
        },
        {
          name: navigateToPageTool.name,
          description: navigateToPageTool.description,
          inputSchema: navigateToPageSchema,
        },
        {
          name: openWorkspaceFileTool.name,
          description: openWorkspaceFileTool.description,
          inputSchema: openWorkspaceFileSchema,
        },
        {
          name: showNotificationTool.name,
          description: showNotificationTool.description,
          inputSchema: showNotificationSchema,
        },
        {
          name: listIntegrationsTool.name,
          description: listIntegrationsTool.description,
          inputSchema: listIntegrationsSchema,
        },
        {
          name: getIntegrationDetailsTool.name,
          description: getIntegrationDetailsTool.description,
          inputSchema: getIntegrationDetailsSchema,
        },
        {
          name: triggerIntegrationActionTool.name,
          description: triggerIntegrationActionTool.description,
          inputSchema: triggerIntegrationActionSchema,
        },
        {
          name: listModelsTool.name,
          description: listModelsTool.description,
          inputSchema: listModelsSchema,
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

      // Get session ID from header
      const sessionId = req.headers['mcp-session-id'] as string;

      // Get user context from Express middleware
      const companyId = (req as any).company?.id;
      const userId = (req as any).user?.id;

      // Session validation - be lenient during initialization handshake
      // The handshake methods (initialize, notifications/initialized, tools/list) don't require valid sessions
      // Claude.ai can send stale session IDs, so we only enforce sessions for authenticated tool calls
      const handshakeMethods = [
        'initialize',
        'notifications/initialized',
        'tools/list',
      ];
      const isHandshakeMethod = handshakeMethods.includes(
        jsonRpcRequest.method,
      );

      if (!isHandshakeMethod) {
        if (sessionId && !this.isValidSession(sessionId)) {
          // Session is stale - if authenticated, auto-create a new session
          // This handles clients like Claude Code that may send stale session IDs
          if (companyId && userId) {
            const newSessionId = this.createSession(userId, companyId);
            res.setHeader('Mcp-Session-Id', newSessionId);
            // Continue processing with the new session
          } else {
            // Not authenticated and session is invalid - require reinit
            res.status(404).json({
              jsonrpc: '2.0',
              error: {
                code: -32600,
                message: 'Session not found. Please reinitialize.',
              },
              id: jsonRpcRequest.id,
            });
            return;
          }
        }
      }

      // Handle initialize (no auth required for capability negotiation)
      if (jsonRpcRequest.method === 'initialize') {
        // Use the client's requested protocol version for compatibility
        const requestedVersion =
          jsonRpcRequest.params?.protocolVersion || '2024-11-05';

        // Create and store a new session
        // Per MCP spec: include Mcp-Session-Id header on InitializeResult response
        const sessionId = this.createSession(userId, companyId);
        res.setHeader('Mcp-Session-Id', sessionId);

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
            inputSchema: z.toJSONSchema(executeSchema, { reused: 'inline' }),
          },
          {
            name: listAgentsTool.name,
            description: listAgentsTool.description,
            inputSchema: z.toJSONSchema(listAgentsSchema, { reused: 'inline' }),
          },
          {
            name: listAgentsByTeamTool.name,
            description: listAgentsByTeamTool.description,
            inputSchema: z.toJSONSchema(listAgentsByTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getAgentPromptTool.name,
            description: getAgentPromptTool.description,
            inputSchema: z.toJSONSchema(getAgentPromptSchema, {
              reused: 'inline',
            }),
          },
          {
            name: updateAgentPromptTool.name,
            description: updateAgentPromptTool.description,
            inputSchema: z.toJSONSchema(updateAgentPromptSchema, {
              reused: 'inline',
            }),
          },
          {
            name: updateAgentTool.name,
            description: updateAgentTool.description,
            inputSchema: z.toJSONSchema(updateAgentSchema, {
              reused: 'inline',
            }),
          },
          {
            name: listWorkspaceItemsTool.name,
            description: listWorkspaceItemsTool.description,
            inputSchema: z.toJSONSchema(listWorkspaceItemsSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getWorkspaceItemTool.name,
            description: getWorkspaceItemTool.description,
            inputSchema: z.toJSONSchema(getWorkspaceItemSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getAgentInfoTool.name,
            description: getAgentInfoTool.description,
            inputSchema: z.toJSONSchema(getAgentInfoSchema, {
              reused: 'inline',
            }),
          },
          {
            name: listTeamsTool.name,
            description: listTeamsTool.description,
            inputSchema: z.toJSONSchema(listTeamsSchema, { reused: 'inline' }),
          },
          {
            name: createAgentTool.name,
            description: createAgentTool.description,
            inputSchema: z.toJSONSchema(createAgentSchema, {
              reused: 'inline',
            }),
          },
          {
            name: createTeamTool.name,
            description: createTeamTool.description,
            inputSchema: z.toJSONSchema(createTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: updateTeamTool.name,
            description: updateTeamTool.description,
            inputSchema: z.toJSONSchema(updateTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: deleteTeamTool.name,
            description: deleteTeamTool.description,
            inputSchema: z.toJSONSchema(deleteTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getTeamTool.name,
            description: getTeamTool.description,
            inputSchema: z.toJSONSchema(getTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: removeAgentFromTeamTool.name,
            description: removeAgentFromTeamTool.description,
            inputSchema: z.toJSONSchema(removeAgentFromTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getCostSummaryToolMeta.name,
            description: getCostSummaryToolMeta.description,
            inputSchema: z.toJSONSchema(getCostSummarySchema, {
              reused: 'inline',
            }),
          },
          {
            name: deleteAgentTool.name,
            description: deleteAgentTool.description,
            inputSchema: z.toJSONSchema(deleteAgentSchema, {
              reused: 'inline',
            }),
          },
          {
            name: assignAgentToTeamTool.name,
            description: assignAgentToTeamTool.description,
            inputSchema: z.toJSONSchema(assignAgentToTeamSchema, {
              reused: 'inline',
            }),
          },
          {
            name: addWorkspaceItemTool.name,
            description: addWorkspaceItemTool.description,
            inputSchema: z.toJSONSchema(addWorkspaceItemSchema, {
              reused: 'inline',
            }),
          },
          {
            name: deleteWorkspaceItemTool.name,
            description: deleteWorkspaceItemTool.description,
            inputSchema: z.toJSONSchema(deleteWorkspaceItemSchema, {
              reused: 'inline',
            }),
          },
          {
            name: moveWorkspaceItemTool.name,
            description: moveWorkspaceItemTool.description,
            inputSchema: z.toJSONSchema(moveWorkspaceItemSchema, {
              reused: 'inline',
            }),
          },
          {
            name: vectorSearchWorkspaceTool.name,
            description: vectorSearchWorkspaceTool.description,
            inputSchema: z.toJSONSchema(vectorSearchWorkspaceSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getUiContextTool.name,
            description: getUiContextTool.description,
            inputSchema: z.toJSONSchema(getUiContextSchema, {
              reused: 'inline',
            }),
          },
          {
            name: navigateToPageTool.name,
            description: navigateToPageTool.description,
            inputSchema: z.toJSONSchema(navigateToPageSchema, {
              reused: 'inline',
            }),
          },
          {
            name: openWorkspaceFileTool.name,
            description: openWorkspaceFileTool.description,
            inputSchema: z.toJSONSchema(openWorkspaceFileSchema, {
              reused: 'inline',
            }),
          },
          {
            name: showNotificationTool.name,
            description: showNotificationTool.description,
            inputSchema: z.toJSONSchema(showNotificationSchema, {
              reused: 'inline',
            }),
          },
          {
            name: listIntegrationsTool.name,
            description: listIntegrationsTool.description,
            inputSchema: z.toJSONSchema(listIntegrationsSchema, {
              reused: 'inline',
            }),
          },
          {
            name: getIntegrationDetailsTool.name,
            description: getIntegrationDetailsTool.description,
            inputSchema: z.toJSONSchema(getIntegrationDetailsSchema, {
              reused: 'inline',
            }),
          },
          {
            name: triggerIntegrationActionTool.name,
            description: triggerIntegrationActionTool.description,
            inputSchema: z.toJSONSchema(triggerIntegrationActionSchema, {
              reused: 'inline',
            }),
          },
          {
            name: listModelsTool.name,
            description: listModelsTool.description,
            inputSchema: z.toJSONSchema(listModelsSchema, {
              reused: 'inline',
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

      // Handle list_models without auth (static data, no company context needed)
      if (
        jsonRpcRequest.method === 'tools/call' &&
        jsonRpcRequest.params?.name === 'list_models'
      ) {
        try {
          const parseResult = listModelsSchema.safeParse(
            jsonRpcRequest.params?.arguments,
          );
          if (!parseResult.success) {
            throw new Error(
              `Invalid parameters: ${parseResult.error.message}`,
            );
          }
          const result = await listModels(parseResult.data as ListModelsInput);
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

      // All other methods require authentication
      if (!companyId || !userId) {
        // Return 401 with WWW-Authenticate header per RFC 9728
        const baseUrl = getBaseUrl(req);
        res
          .status(401)
          .header(
            'WWW-Authenticate',
            `Bearer realm="MCP", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
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

            case 'create_team': {
              const parseResult = createTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await createTeam(
                parseResult.data as CreateTeamInput,
                companyId,
              );
              break;
            }

            case 'update_team': {
              const parseResult = updateTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await updateTeam(
                parseResult.data as UpdateTeamInput,
                companyId,
              );
              break;
            }

            case 'delete_team': {
              const parseResult = deleteTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await deleteTeam(
                parseResult.data as DeleteTeamInput,
                companyId,
              );
              break;
            }

            case 'get_team': {
              const parseResult = getTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getTeam(
                parseResult.data as GetTeamInput,
                companyId,
              );
              break;
            }

            case 'remove_agent_from_team': {
              const parseResult = removeAgentFromTeamSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await removeAgentFromTeam(
                parseResult.data as RemoveAgentFromTeamInput,
                companyId,
              );
              break;
            }

            case 'get_cost_summary': {
              const parseResult = getCostSummarySchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getCostSummaryTool(
                parseResult.data as GetCostSummaryInput,
                companyId,
              );
              break;
            }

            case 'delete_agent': {
              const parseResult = deleteAgentSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await deleteAgent(
                parseResult.data as DeleteAgentInput,
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

            case 'move_workspace_item': {
              const parseResult = moveWorkspaceItemSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await moveWorkspaceItem(
                parseResult.data as MoveWorkspaceItemInput,
                companyId,
              );
              break;
            }

            case 'vector_search_workspace': {
              const parseResult =
                vectorSearchWorkspaceSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await vectorSearchWorkspace(
                parseResult.data as VectorSearchWorkspaceInput,
                companyId,
              );
              break;
            }

            case 'get_ui_context': {
              const parseResult = getUiContextSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getUiContext(
                parseResult.data as GetUiContextInput,
                companyId,
              );
              break;
            }

            case 'navigate_to_page': {
              const parseResult = navigateToPageSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await navigateToPage(
                parseResult.data as NavigateToPageInput,
                companyId,
              );
              break;
            }

            case 'open_workspace_file': {
              const parseResult = openWorkspaceFileSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await openWorkspaceFile(
                parseResult.data as OpenWorkspaceFileInput,
                companyId,
              );
              break;
            }

            case 'show_notification': {
              const parseResult = showNotificationSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await showNotification(
                parseResult.data as ShowNotificationInput,
                companyId,
              );
              break;
            }

            case 'list_integrations': {
              const parseResult = listIntegrationsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listIntegrations(
                parseResult.data as ListIntegrationsInput,
              );
              break;
            }

            case 'get_integration_details': {
              const parseResult =
                getIntegrationDetailsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await getIntegrationDetails(
                parseResult.data as GetIntegrationDetailsInput,
              );
              break;
            }

            case 'trigger_integration_action': {
              const parseResult =
                triggerIntegrationActionSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await triggerIntegrationAction(
                parseResult.data as TriggerIntegrationActionInput,
                companyId,
                userId,
              );
              break;
            }

            case 'list_models': {
              const parseResult = listModelsSchema.safeParse(toolArgs);
              if (!parseResult.success) {
                throw new Error(
                  `Invalid parameters: ${parseResult.error.message}`,
                );
              }
              result = await listModels(parseResult.data as ListModelsInput);
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
