/**
 * Get Latest Workspace Items Tool
 *
 * Retrieves the most recently updated workspace items sorted by modification time.
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the get_latest_workspace_items tool
 */
export const getLatestWorkspaceItemsSchema = z.object({
  limit: z.coerce
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Maximum number of items to return (1-100, default: 10)',
    ),
  scope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe(
      'Storage scope: "company", "session", or "agent" (default: "company")',
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

export type GetLatestWorkspaceItemsInput = z.infer<typeof getLatestWorkspaceItemsSchema>;

/**
 * Get the most recently updated workspace items
 */
export async function getLatestWorkspaceItems(
  input: GetLatestWorkspaceItemsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'company';
    const limit = input.limit || 10;
    const workspace = getWorkspaceService();

    let basePath: string;
    const scopeInfo: any = { scope };

    switch (scope) {
      case 'company':
        basePath = `/company/${companyId}`;
        scopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.scopeId) {
          throw new Error('scopeId (sessionId) is required for session scope');
        }
        await validateSessionOwnership(input.scopeId, companyId);
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

    const items = await workspace.listLatest(fullPrefix, limit);

    // Strip base path prefix for cleaner display
    const cleanedItems = items.map((item) => ({
      path: item.path.startsWith(basePath)
        ? item.path.substring(basePath.length)
        : item.path,
      metadata: item.metadata || {},
      type: item.type,
      size: item.size,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              scope: scopeInfo,
              limit,
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
    console.error('MCP get latest workspace items error:', error);

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
                  : 'Failed to get latest workspace items',
              scope: input.scope || 'company',
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
export const getLatestWorkspaceItemsTool = {
  name: 'get_latest_workspace_items',
  description:
    'Get the most recently updated workspace items sorted by modification time. Returns items with metadata (path, timestamps, size, type) but excludes full content. Useful for seeing what has changed recently in the workspace.',
  inputSchema: getLatestWorkspaceItemsSchema,
};
