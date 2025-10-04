/**
 * Add Workspace Item Tool
 *
 * Adds a new workspace item at company, session, or agent level
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the add_workspace_item tool
 */
export const addWorkspaceItemSchema = z.object({
  itemPath: z
    .string()
    .describe('Path for the workspace item (e.g., "/config/settings.json")'),
  content: z
    .any()
    .describe('Content to store (can be string, object, array, etc.)'),
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
  metadata: z
    .object({
      contentType: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Optional metadata for the item'),
});

export type AddWorkspaceItemInput = z.infer<typeof addWorkspaceItemSchema>;

/**
 * Add a workspace item
 */
export async function addWorkspaceItem(
  input: AddWorkspaceItemInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'agent';
    const workspace = getWorkspaceService();

    let fullPath: string;
    const scopeInfo: any = { scope };

    // Build the full path based on scope
    switch (scope) {
      case 'company':
        fullPath = `/company/${companyId}${input.itemPath}`;
        scopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.scopeId) {
          throw new Error('scopeId (sessionId) is required for session scope');
        }
        fullPath = `/session/${input.scopeId}${input.itemPath}`;
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

        fullPath = `/agent/${agent._id.toString()}${input.itemPath}`;
        scopeInfo.agentId = agent._id.toString();
        scopeInfo.agentName = agent.name;
        break;
    }

    // Add metadata with timestamp
    const metadata = {
      ...input.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      scope,
      companyId,
    };

    // Store the item
    await workspace.set(fullPath, input.content, metadata);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              item: {
                path: input.itemPath,
                fullPath,
                scope: scopeInfo,
                contentType: typeof input.content,
                metadata: input.metadata,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP add workspace item error:', error);

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
                  : 'Failed to add workspace item',
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
export const addWorkspaceItemTool = {
  name: 'add_workspace_item',
  description:
    'Add a new workspace item at company, session, or agent level. Default is agent level. Can store any JSON-serializable content (string, object, array, etc.).',
  inputSchema: addWorkspaceItemSchema,
};
