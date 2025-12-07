/**
 * Get Workspace Item Tool
 *
 * Retrieves a specific workspace item for an agent
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the get_workspace_item tool
 */
export const getWorkspaceItemSchema = z.object({
  itemPath: z
    .string()
    .describe(
      'Path of the workspace item to retrieve (e.g., "/config/settings.json")',
    ),
  scope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe(
      'Storage scope: "company", "session", or "agent" (default: "agent")',
    ),
  scopeId: z
    .string()
    .optional()
    .describe(
      'ID for the scope: agentId/name for agent scope, sessionId for session scope. For company scope, this is ignored.',
    ),
});

export type GetWorkspaceItemInput = z.infer<typeof getWorkspaceItemSchema>;

/**
 * Get a workspace item
 */
export async function getWorkspaceItem(
  input: GetWorkspaceItemInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'agent';
    const workspace = getWorkspaceService();

    // Ensure itemPath starts with /
    const itemPath = input.itemPath.startsWith('/')
      ? input.itemPath
      : `/${input.itemPath}`;

    let fullPath: string;
    const scopeInfo: any = { scope };

    // Build the full path based on scope
    switch (scope) {
      case 'company':
        fullPath = `/company/${companyId}${itemPath}`;
        scopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.scopeId) {
          throw new Error('scopeId (sessionId) is required for session scope');
        }
        fullPath = `/session/${input.scopeId}${itemPath}`;
        scopeInfo.sessionId = input.scopeId;
        break;

      case 'agent':
      default:
        if (!input.scopeId) {
          throw new Error(
            'scopeId (agentId or agent name) is required for agent scope',
          );
        }

        // Resolve agent by ID or name
        const agent = await resolveAssistantIdentifier(
          input.scopeId,
          companyId,
        );
        if (!agent) {
          throw new Error(`Agent not found: ${input.scopeId}`);
        }

        fullPath = `/agent/${agent._id.toString()}${itemPath}`;
        scopeInfo.agentId = agent._id.toString();
        scopeInfo.agentName = agent.name;
        break;
    }

    // Get the workspace item
    const item = await workspace.get(fullPath);

    if (!item) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Workspace item not found: ${input.itemPath}`,
                path: input.itemPath,
                fullPath,
                scope: scopeInfo,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Return the item content and metadata
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              scope: scopeInfo,
              path: input.itemPath,
              fullPath,
              content: item,
              metadata: item.metadata || {},
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get workspace item error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to get workspace item',
              path: input.itemPath,
              scope: input.scope || 'agent',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const getWorkspaceItemTool = {
  name: 'get_workspace_item',
  description:
    'Get a specific workspace item at company, session, or agent level. Default is agent level. Returns the item content and metadata.',
  inputSchema: getWorkspaceItemSchema,
};
