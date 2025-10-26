/**
 * Show Notification Tool
 *
 * Displays a notification message in the connected frontend.
 */

import { z } from 'zod';
import { executeAgentHubUiAction } from '../../integrations/agent_hub_ui_context/agent_hub_ui_context.actions';

/**
 * Input schema for the show_notification tool
 */
export const showNotificationSchema = z.object({
  message: z.string().describe('The message to display in the notification'),
  type: z
    .enum(['success', 'error', 'info'])
    .optional()
    .describe('The type of notification (default: info)'),
});

export type ShowNotificationInput = z.infer<typeof showNotificationSchema>;

/**
 * Show a notification in the frontend
 */
export async function showNotification(
  input: ShowNotificationInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const result = await executeAgentHubUiAction(
      companyId,
      'showNotification',
      {
        message: input.message,
        type: input.type || 'info',
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
    console.error('MCP show notification error:', error);

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
                  : 'Failed to show notification',
              notificationMessage: input.message,
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
export const showNotificationTool = {
  name: 'show_notification',
  description:
    'Display a notification message to the user in the frontend. Use this to provide feedback, alerts, or important information. Supports success, error, and info notification types.',
  inputSchema: showNotificationSchema,
};
