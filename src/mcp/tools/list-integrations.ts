/**
 * List Integrations Tool
 *
 * Lists all available integrations in the system
 */

import { z } from 'zod';
import { discoverAllIntegrations } from '../../integrations/debug/debug.service';

/**
 * Input schema for the list_integrations tool
 */
export const listIntegrationsSchema = z.object({
  language: z
    .enum(['en', 'he'])
    .optional()
    .default('en')
    .describe('Language for integration descriptions (default: en)'),
});

export type ListIntegrationsInput = z.infer<typeof listIntegrationsSchema>;

/**
 * List all available integrations
 */
export async function listIntegrations(
  input: ListIntegrationsInput,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const language = input.language || 'en';
    const result = await discoverAllIntegrations(language);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: result.error || 'Failed to list integrations',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              totalIntegrations: result.data?.length || 0,
              integrations: result.data,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list integrations error:', error);

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
                  : 'Failed to list integrations',
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
export const listIntegrationsTool = {
  name: 'list_integrations',
  description:
    'List all available integrations in the system with their names, descriptions, icons, and available actions. Useful for discovering what capabilities are available.',
  inputSchema: listIntegrationsSchema,
};
