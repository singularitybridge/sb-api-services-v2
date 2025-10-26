/**
 * Navigate to Page Tool
 *
 * Navigates the connected frontend to a specific page/route.
 */

import { z } from 'zod';
import { executeAgentHubUiAction } from '../../integrations/agent_hub_ui_context/agent_hub_ui_context.actions';

/**
 * Input schema for the navigate_to_page tool
 */
export const navigateToPageSchema = z.object({
  path: z
    .string()
    .describe(
      'The path to navigate to (e.g., "/admin/assistants", "/admin/costs")',
    ),
});

export type NavigateToPageInput = z.infer<typeof navigateToPageSchema>;

/**
 * Navigate to a specific page in the frontend
 */
export async function navigateToPage(
  input: NavigateToPageInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const result = await executeAgentHubUiAction(
      companyId,
      'navigateToPage',
      { path: input.path },
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
    console.error('MCP navigate to page error:', error);

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
                  : 'Failed to navigate to page',
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
export const navigateToPageTool = {
  name: 'navigate_to_page',
  description:
    'Navigate the user\'s browser to a specific page or route in the application. Use this to guide users to relevant pages. Example paths: "/admin/assistants", "/admin/costs", "/admin/teams".',
  inputSchema: navigateToPageSchema,
};
