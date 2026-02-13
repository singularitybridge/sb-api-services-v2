/**
 * Delete Workspace Item Tool
 *
 * Deletes a workspace item at company, session, or agent level
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the delete_workspace_item tool
 */
export const deleteWorkspaceItemSchema = z.object({
  itemPath: z
    .string()
    .describe(
      'Path of the workspace item to delete (e.g., "/config/settings.json")',
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

export type DeleteWorkspaceItemInput = z.infer<
  typeof deleteWorkspaceItemSchema
>;

/**
 * Delete a workspace item
 */
export async function deleteWorkspaceItem(
  input: DeleteWorkspaceItemInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'agent';
    const workspace = getWorkspaceService();

    let fullPath: string;
    const scopeInfo: any = { scope };

    // Ensure itemPath starts with /
    const itemPath = input.itemPath.startsWith('/')
      ? input.itemPath
      : `/${input.itemPath}`;

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
        // Validate session belongs to the authenticated company
        await validateSessionOwnership(input.scopeId, companyId);
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

    // Check if item exists
    const exists = await workspace.exists(fullPath);
    if (!exists) {
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

    // Delete the item
    const deleted = await workspace.delete(fullPath);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: deleted,
              deleted: {
                path: input.itemPath,
                fullPath,
                scope: scopeInfo,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP delete workspace item error:', error);

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
                  : 'Failed to delete workspace item',
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
export const deleteWorkspaceItemTool = {
  name: 'delete_workspace_item',
  description:
    'Delete a workspace item at company, session, or agent level. Default is agent level. Returns error if item does not exist.',
  inputSchema: deleteWorkspaceItemSchema,
};
