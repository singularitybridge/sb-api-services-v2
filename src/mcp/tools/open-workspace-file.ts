/**
 * Open Workspace File Tool
 *
 * Opens a specific workspace file in the frontend workspace viewer.
 */

import { z } from 'zod';
import { executeAgentHubUiAction } from '../../integrations/agent_hub_ui_context/agent_hub_ui_context.actions';

/**
 * Input schema for the open_workspace_file tool
 */
export const openWorkspaceFileSchema = z.object({
  assistantId: z
    .string()
    .describe('The ID or name of the assistant that owns the workspace file'),
  path: z
    .string()
    .describe(
      'The path to the workspace file to open (e.g., "/README.mdx", "/docs/guide.md")',
    ),
});

export type OpenWorkspaceFileInput = z.infer<typeof openWorkspaceFileSchema>;

/**
 * Open a workspace file in the frontend
 */
export async function openWorkspaceFile(
  input: OpenWorkspaceFileInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const result = await executeAgentHubUiAction(
      companyId,
      'openWorkspaceFile',
      {
        assistantId: input.assistantId,
        path: input.path,
      },
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('MCP open workspace file error:', error);

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
                  : 'Failed to open workspace file',
              assistantId: input.assistantId,
              path: input.path,
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
export const openWorkspaceFileTool = {
  name: 'open_workspace_file',
  description:
    'Open a specific workspace file in the frontend workspace viewer. Use this to show users specific documentation, guides, or other workspace content. The file will be opened in the workspace interface.',
  inputSchema: openWorkspaceFileSchema,
};
