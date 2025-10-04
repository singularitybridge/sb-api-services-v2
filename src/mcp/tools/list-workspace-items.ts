/**
 * List Workspace Items Tool
 *
 * Lists workspace items for a specific agent
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the list_workspace_items tool
 */
export const listWorkspaceItemsSchema = z.object({
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
  prefix: z
    .string()
    .optional()
    .describe(
      'Optional path prefix to filter items (e.g., "/docs" to list only items under /docs)',
    ),
});

export type ListWorkspaceItemsInput = z.infer<typeof listWorkspaceItemsSchema>;

/**
 * List workspace items
 */
export async function listWorkspaceItems(
  input: ListWorkspaceItemsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'agent';
    const workspace = getWorkspaceService();

    let basePath: string;
    const scopeInfo: any = { scope };

    // Build the base path based on scope
    switch (scope) {
      case 'company':
        basePath = `/company/${companyId}`;
        scopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.scopeId) {
          throw new Error('scopeId (sessionId) is required for session scope');
        }
        basePath = `/session/${input.scopeId}`;
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

        basePath = `/agent/${agent._id.toString()}`;
        scopeInfo.agentId = agent._id.toString();
        scopeInfo.agentName = agent.name;
        break;
    }

    const fullPrefix = input.prefix ? `${basePath}${input.prefix}` : basePath;

    // List all workspace items with the prefix
    const items = await workspace.list(fullPrefix);

    // Remove the base path prefix from results for cleaner display
    const cleanedItems = items.map((item) => {
      return item.startsWith(basePath) ? item.substring(basePath.length) : item;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              scope: scopeInfo,
              items: cleanedItems,
              count: cleanedItems.length,
              prefix: input.prefix || '/',
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list workspace items error:', error);

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
                  : 'Failed to list workspace items',
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
export const listWorkspaceItemsTool = {
  name: 'list_workspace_items',
  description:
    'List all workspace items at company, session, or agent level. Default is agent level. Supports filtering by path prefix. Returns an array of workspace paths.',
  inputSchema: listWorkspaceItemsSchema,
};
