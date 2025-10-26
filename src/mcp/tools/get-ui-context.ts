/**
 * Get UI Context Tool
 *
 * Retrieves the current UI context from the connected frontend,
 * including current route, workspace file being viewed, and active session.
 */

import { z } from 'zod';
import { getAgentHubUiContext } from '../../integrations/agent_hub_ui_context/agent_hub_ui_context.actions';

/**
 * Input schema for the get_ui_context tool
 */
export const getUiContextSchema = z.object({});

export type GetUiContextInput = z.infer<typeof getUiContextSchema>;

/**
 * Get current UI context from connected frontend
 */
export async function getUiContext(
  input: GetUiContextInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const context = await getAgentHubUiContext(companyId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(context, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get UI context error:', error);

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
                  : 'Failed to get UI context',
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
export const getUiContextTool = {
  name: 'get_ui_context',
  description:
    'Get the current UI context from the connected frontend, including the current route, workspace file being viewed (path and content), active session ID, and assistant ID. Use this to understand what the user is currently looking at.',
  inputSchema: getUiContextSchema,
};
