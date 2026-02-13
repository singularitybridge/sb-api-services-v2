/**
 * Move Workspace Item Tool
 *
 * Moves/renames a workspace item from one path to another within the same or different scope
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';
import { getWorkspaceService } from '../../services/unified-workspace.service';

/**
 * Input schema for the move_workspace_item tool
 */
export const moveWorkspaceItemSchema = z.object({
  fromPath: z
    .string()
    .describe('Source path of the workspace item (e.g., "/docs/old-name.md")'),
  toPath: z
    .string()
    .describe(
      'Destination path for the workspace item (e.g., "/docs/features/new-name.md")',
    ),
  fromScope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe('Source scope (default: "agent")'),
  toScope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe('Destination scope (default: same as fromScope)'),
  fromScopeId: z
    .string()
    .optional()
    .describe('Source scope ID (agentId/name or sessionId)'),
  toScopeId: z
    .string()
    .optional()
    .describe(
      'Destination scope ID (agentId/name or sessionId). Default: same as fromScopeId',
    ),
});

export type MoveWorkspaceItemInput = z.infer<typeof moveWorkspaceItemSchema>;

/**
 * Move a workspace item from one path to another
 */
export async function moveWorkspaceItem(
  input: MoveWorkspaceItemInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const fromScope = input.fromScope || 'agent';
    const toScope = input.toScope || fromScope;
    const workspace = getWorkspaceService();

    // Ensure paths start with /
    const fromPath = input.fromPath.startsWith('/')
      ? input.fromPath
      : `/${input.fromPath}`;
    const toPath = input.toPath.startsWith('/')
      ? input.toPath
      : `/${input.toPath}`;

    // Build source path
    let fromFullPath: string;
    const fromScopeInfo: any = { scope: fromScope };

    switch (fromScope) {
      case 'company':
        fromFullPath = `/company/${companyId}${fromPath}`;
        fromScopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!input.fromScopeId) {
          throw new Error(
            'fromScopeId (sessionId) is required for session scope',
          );
        }
        // Validate session belongs to the authenticated company
        await validateSessionOwnership(input.fromScopeId, companyId);
        fromFullPath = `/session/${input.fromScopeId}${fromPath}`;
        fromScopeInfo.sessionId = input.fromScopeId;
        break;

      case 'agent':
      default:
        if (!input.fromScopeId) {
          throw new Error(
            'fromScopeId (agentId or agent name) is required for agent scope',
          );
        }

        // Resolve agent by ID or name
        const fromAgent = await resolveAssistantIdentifier(
          input.fromScopeId,
          companyId,
        );
        if (!fromAgent) {
          throw new Error(`Source agent not found: ${input.fromScopeId}`);
        }

        fromFullPath = `/agent/${fromAgent._id.toString()}${fromPath}`;
        fromScopeInfo.agentId = fromAgent._id.toString();
        fromScopeInfo.agentName = fromAgent.name;
        break;
    }

    // Build destination path
    let toFullPath: string;
    const toScopeInfo: any = { scope: toScope };
    const toScopeId = input.toScopeId || input.fromScopeId;

    switch (toScope) {
      case 'company':
        toFullPath = `/company/${companyId}${toPath}`;
        toScopeInfo.companyId = companyId;
        break;

      case 'session':
        if (!toScopeId) {
          throw new Error(
            'toScopeId (sessionId) is required for session scope',
          );
        }
        // Validate session belongs to the authenticated company
        await validateSessionOwnership(toScopeId, companyId);
        toFullPath = `/session/${toScopeId}${toPath}`;
        toScopeInfo.sessionId = toScopeId;
        break;

      case 'agent':
      default:
        if (!toScopeId) {
          throw new Error(
            'toScopeId (agentId or agent name) is required for agent scope',
          );
        }

        // Resolve agent by ID or name
        const toAgent = await resolveAssistantIdentifier(toScopeId, companyId);
        if (!toAgent) {
          throw new Error(`Destination agent not found: ${toScopeId}`);
        }

        toFullPath = `/agent/${toAgent._id.toString()}${toPath}`;
        toScopeInfo.agentId = toAgent._id.toString();
        toScopeInfo.agentName = toAgent.name;
        break;
    }

    // Check if source item exists
    const exists = await workspace.exists(fromFullPath);
    if (!exists) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Source workspace item not found: ${input.fromPath}`,
                fromPath: input.fromPath,
                fromFullPath,
                fromScope: fromScopeInfo,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Check if destination already exists
    const destExists = await workspace.exists(toFullPath);
    if (destExists) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: `Destination path already exists: ${input.toPath}`,
                toPath: input.toPath,
                toFullPath,
                toScope: toScopeInfo,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Get content from source
    const content = await workspace.get(fromFullPath);

    // Set at destination (preserve metadata)
    await workspace.set(toFullPath, content, {
      movedFrom: fromFullPath,
      movedAt: new Date(),
    });

    // Delete from source
    await workspace.delete(fromFullPath);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              moved: {
                fromPath: input.fromPath,
                toPath: input.toPath,
                fromFullPath,
                toFullPath,
                fromScope: fromScopeInfo,
                toScope: toScopeInfo,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP move workspace item error:', error);

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
                  : 'Failed to move workspace item',
              fromPath: input.fromPath,
              toPath: input.toPath,
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
export const moveWorkspaceItemTool = {
  name: 'move_workspace_item',
  description:
    'Move/rename a workspace item from one path to another. Can move within same scope or across scopes (agent, session, company). Returns error if source does not exist or destination already exists.',
  inputSchema: moveWorkspaceItemSchema,
};
