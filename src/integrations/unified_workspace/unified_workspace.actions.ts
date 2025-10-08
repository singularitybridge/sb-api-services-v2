import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { logger } from '../../utils/logger';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { UnifiedWorkspaceService } from '../../services/unified-workspace.service';
import { Message } from '../../models/Message';
import mongoose from 'mongoose';

/**
 * Unified Workspace Integration Actions
 * Provides session and agent level storage for text/json content
 * Uses the local UnifiedWorkspaceService directly without HTTP calls
 */

// Initialize the service
const workspaceService = new UnifiedWorkspaceService();

// Helper function to resolve agent ID from ID, name, or URL using centralized resolver
async function resolveAgentId(
  agentIdentifier: string,
  companyId?: string,
): Promise<string | null> {
  try {
    const assistant = await resolveAssistantIdentifier(
      agentIdentifier,
      companyId,
    );

    if (assistant) {
      logger.debug(
        `Resolved agent identifier "${agentIdentifier}" to ID: ${assistant._id}`,
      );
      return assistant._id.toString();
    }

    logger.warn(`Could not resolve agent identifier: ${agentIdentifier}`);
    return null;
  } catch (error) {
    logger.error(`Error resolving agent ID: ${error}`);
    return null;
  }
}

// Helper function to get the last user message from a session
async function getLastUserMessage(sessionId: string): Promise<{
  content?: string;
  messageId?: string;
  timestamp?: Date;
} | null> {
  try {
    // Skip if sessionId is not a valid ObjectId (e.g., "stateless_execution")
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      logger.debug(`Session ID "${sessionId}" is not a valid ObjectId, skipping message lookup`);
      return null;
    }

    // Find the last user message in this session
    const lastUserMessage = await Message.findOne({
      sessionId,
      sender: 'user',
    })
      .sort({ timestamp: -1 }) // Most recent first
      .limit(1)
      .select('content _id timestamp')
      .lean();

    if (!lastUserMessage) {
      logger.debug(`No user messages found for session ${sessionId}`);
      return null;
    }

    return {
      content: lastUserMessage.content,
      messageId: lastUserMessage._id?.toString(),
      timestamp: lastUserMessage.timestamp,
    };
  } catch (error) {
    logger.error(`Error getting last user message for session ${sessionId}:`, error);
    return null;
  }
}

// Create workspace actions for integration framework
export const createWorkspaceActions = (
  context: ActionContext,
): FunctionFactory => ({
  // Store content at session or agent level
  storeContent: {
    description: 'Store text or JSON content at session or agent scope',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Path to store content (e.g., "settings/config.json", "prompts/main.txt")',
        },
        content: {
          type: ['object', 'string'],
          description: 'Text or JSON content to store',
        },
        scope: {
          type: 'string',
          enum: ['session', 'agent'],
          description:
            'Storage scope - session (session-specific) or agent (agent-specific)',
        },
        agentId: {
          type: 'string',
          description:
            'Agent ID (optional - will auto-use current assistant if omitted when scope is "agent")',
        },
      },
      required: ['path', 'content', 'scope'],
      additionalProperties: false,
    },
    function: async ({
      path,
      content,
      scope,
      agentId,
    }: any): Promise<StandardActionResult> => {
      try {
        // Validate scope
        if (scope !== 'session' && scope !== 'agent') {
          throw new Error('Scope must be either "session" or "agent"');
        }

        // Validate and resolve agent ID when scope is agent
        let resolvedAgentId: string | undefined;
        if (scope === 'agent') {
          // Auto-inject current assistant's ID if not provided
          const agentIdentifier = agentId || context?.assistantId;

          if (!agentIdentifier) {
            throw new Error(
              'agentId is required when scope is "agent" (or must be executing within an assistant context)',
            );
          }

          // Resolve agent ID from name, URL, or ID
          const resolved = await resolveAgentId(
            agentIdentifier,
            context?.companyId,
          );
          if (!resolved) {
            throw new Error(
              `Could not find agent with identifier: ${agentIdentifier}`,
            );
          }
          resolvedAgentId = resolved;
        }

        // Capture the creation context (last user message)
        const sessionId = context?.sessionId || 'default';
        const creationContext = await getLastUserMessage(sessionId);

        // Use the workspace service directly
        const result = await workspaceService.storeContent(
          sessionId,
          path,
          content,
          {
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
            creationContext: creationContext || undefined,
          },
        );

        logger.info(`Workspace: Stored content at ${path} in ${scope} scope`, {
          companyId: context?.companyId,
          userId: context?.userId,
          scope,
          agentId: scope === 'agent' ? resolvedAgentId : undefined,
          originalAgentIdentifier: scope === 'agent' ? agentId : undefined,
          path,
        });

        return {
          success: true,
          message: `Content stored at ${path} in ${scope} scope`,
          data: {
            path,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
            version: result.version,
          },
        };
      } catch (error: any) {
        logger.error('Failed to store content', {
          error: error.message,
          path,
          scope,
        });
        throw error;
      }
    },
  },

  // Retrieve content from session or agent level
  retrieveContent: {
    description: 'Retrieve text or JSON content from session or agent scope',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to retrieve content from',
        },
        scope: {
          type: 'string',
          enum: ['session', 'agent'],
          description: 'Storage scope - session or agent',
        },
        agentId: {
          type: 'string',
          description:
            'Agent ID (optional - will auto-use current assistant if omitted when scope is "agent")',
        },
      },
      required: ['path', 'scope'],
      additionalProperties: false,
    },
    function: async ({
      path,
      scope,
      agentId,
    }: any): Promise<StandardActionResult> => {
      try {
        // Validate scope
        if (scope !== 'session' && scope !== 'agent') {
          throw new Error('Scope must be either "session" or "agent"');
        }

        // Validate and resolve agent ID when scope is agent
        let resolvedAgentId: string | undefined;
        if (scope === 'agent') {
          // Auto-inject current assistant's ID if not provided
          const agentIdentifier = agentId || context?.assistantId;

          if (!agentIdentifier) {
            throw new Error(
              'agentId is required when scope is "agent" (or must be executing within an assistant context)',
            );
          }

          // Resolve agent ID from name, URL, or ID
          const resolved = await resolveAgentId(
            agentIdentifier,
            context?.companyId,
          );
          if (!resolved) {
            throw new Error(
              `Could not find agent with identifier: ${agentIdentifier}`,
            );
          }
          resolvedAgentId = resolved;
        }

        // Use the workspace service directly
        const sessionId = context?.sessionId || 'default';
        const result = await workspaceService.retrieveContent(
          sessionId,
          path,
          scope === 'agent' ? resolvedAgentId : undefined,
        );

        if (!result.found) {
          return {
            success: true,
            message: `No content found at ${path} in ${scope} scope`,
            data: null,
          };
        }

        logger.info(
          `Workspace: Retrieved content from ${path} in ${scope} scope`,
          {
            companyId: context?.companyId,
            userId: context?.userId,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
            path,
          },
        );

        return {
          success: true,
          message: `Content retrieved from ${path}`,
          data: {
            content: result.content,
            metadata: result.metadata,
            path,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
          },
        };
      } catch (error: any) {
        logger.error('Failed to retrieve content', {
          error: error.message,
          path,
          scope,
        });
        throw error;
      }
    },
  },

  // List content at session or agent level
  listContent: {
    description: 'List all stored paths at session or agent scope',
    parameters: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description:
            'Optional prefix to filter paths (e.g., "settings/", "prompts/")',
        },
        scope: {
          type: 'string',
          enum: ['session', 'agent'],
          description: 'Storage scope - session or agent',
        },
        agentId: {
          type: 'string',
          description:
            'Agent ID (optional - will auto-use current assistant if omitted when scope is "agent")',
        },
      },
      required: ['scope'],
      additionalProperties: false,
    },
    function: async ({
      prefix,
      scope,
      agentId,
    }: any): Promise<StandardActionResult> => {
      try {
        // Validate scope
        if (scope !== 'session' && scope !== 'agent') {
          throw new Error('Scope must be either "session" or "agent"');
        }

        // Validate and resolve agent ID when scope is agent
        let resolvedAgentId: string | undefined;
        if (scope === 'agent') {
          // Auto-inject current assistant's ID if not provided
          const agentIdentifier = agentId || context?.assistantId;

          if (!agentIdentifier) {
            throw new Error(
              'agentId is required when scope is "agent" (or must be executing within an assistant context)',
            );
          }

          // Resolve agent ID from name, URL, or ID
          const resolved = await resolveAgentId(
            agentIdentifier,
            context?.companyId,
          );
          if (!resolved) {
            throw new Error(
              `Could not find agent with identifier: ${agentIdentifier}`,
            );
          }
          resolvedAgentId = resolved;
        }

        // Use the workspace service directly
        const sessionId = context?.sessionId || 'default';
        const result = await workspaceService.listContent(
          sessionId,
          prefix,
          scope === 'agent' ? resolvedAgentId : undefined,
        );

        logger.info(
          `Workspace: Listed ${result.count} paths in ${scope} scope`,
          {
            companyId: context?.companyId,
            userId: context?.userId,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
            originalAgentIdentifier: scope === 'agent' ? agentId : undefined,
            prefix,
          },
        );

        return {
          success: true,
          message: `Found ${result.count} paths in ${scope} scope${prefix ? ` under ${prefix}` : ''}`,
          data: {
            paths: result.paths,
            count: result.count,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
          },
        };
      } catch (error: any) {
        logger.error('Failed to list content', {
          error: error.message,
          scope,
          prefix,
        });
        throw error;
      }
    },
  },

  // Delete content from session or agent level
  deleteContent: {
    description:
      'Delete content at a specific path from session or agent scope',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to delete content from',
        },
        scope: {
          type: 'string',
          enum: ['session', 'agent'],
          description: 'Storage scope - session or agent',
        },
        agentId: {
          type: 'string',
          description:
            'Agent ID, name, or URL (required when scope is "agent")',
        },
      },
      required: ['path', 'scope'],
      additionalProperties: false,
    },
    function: async ({
      path,
      scope,
      agentId,
    }: any): Promise<StandardActionResult> => {
      try {
        // Validate scope
        if (scope !== 'session' && scope !== 'agent') {
          throw new Error('Scope must be either "session" or "agent"');
        }

        // Validate and resolve agent ID when scope is agent
        let resolvedAgentId: string | undefined;
        if (scope === 'agent') {
          // Auto-inject current assistant's ID if not provided
          const agentIdentifier = agentId || context?.assistantId;

          if (!agentIdentifier) {
            throw new Error(
              'agentId is required when scope is "agent" (or must be executing within an assistant context)',
            );
          }

          // Resolve agent ID from name, URL, or ID
          const resolved = await resolveAgentId(
            agentIdentifier,
            context?.companyId,
          );
          if (!resolved) {
            throw new Error(
              `Could not find agent with identifier: ${agentIdentifier}`,
            );
          }
          resolvedAgentId = resolved;
        }

        // Use the workspace service directly
        const sessionId = context?.sessionId || 'default';
        const result = await workspaceService.deleteContent(
          sessionId,
          path,
          scope === 'agent' ? resolvedAgentId : undefined,
        );

        logger.info(`Workspace: Deleted content at ${path} in ${scope} scope`, {
          companyId: context?.companyId,
          userId: context?.userId,
          scope,
          agentId: scope === 'agent' ? resolvedAgentId : undefined,
          originalAgentIdentifier: scope === 'agent' ? agentId : undefined,
          path,
        });

        return {
          success: true,
          message: `Content deleted at ${path} in ${scope} scope`,
          data: {
            path,
            scope,
            agentId: scope === 'agent' ? resolvedAgentId : undefined,
            deleted: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to delete content', {
          error: error.message,
          path,
          scope,
        });
        throw error;
      }
    },
  },
});
