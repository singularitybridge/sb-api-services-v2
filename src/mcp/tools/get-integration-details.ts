/**
 * Get Integration Details Tool
 *
 * Gets detailed information about a specific integration
 */

import { z } from 'zod';
import {
  getIntegration,
  discoverActionsByIntegration,
} from '../../integrations/debug/debug.service';

/**
 * Input schema for the get_integration_details tool
 */
export const getIntegrationDetailsSchema = z.object({
  integrationId: z
    .string()
    .describe(
      'The ID of the integration to retrieve (e.g., "jira", "openai", "sendgrid")',
    ),
  includeActions: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to include detailed action information with parameters (default: true)',
    ),
  language: z
    .enum(['en', 'he'])
    .optional()
    .default('en')
    .describe('Language for descriptions (default: en)'),
});

export type GetIntegrationDetailsInput = z.infer<
  typeof getIntegrationDetailsSchema
>;

/**
 * Get detailed information about a specific integration
 */
export async function getIntegrationDetails(
  input: GetIntegrationDetailsInput,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const language = input.language || 'en';

    if (input.includeActions) {
      // Get full details with actions
      const result = await discoverActionsByIntegration(
        input.integrationId,
        language,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    result.error ||
                    `Integration not found: ${input.integrationId}`,
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
                ...result.data,
              },
              null,
              2,
            ),
          },
        ],
      };
    } else {
      // Get basic integration info
      const result = await getIntegration(input.integrationId);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    result.error ||
                    `Integration not found: ${input.integrationId}`,
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
                integration: result.data,
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  } catch (error) {
    console.error('MCP get integration details error:', error);

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
                  : 'Failed to get integration details',
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
export const getIntegrationDetailsTool = {
  name: 'get_integration_details',
  description:
    'Get detailed information about a specific integration including its actions, parameters, and business context. Useful for understanding what an integration can do and how to use it.',
  inputSchema: getIntegrationDetailsSchema,
};
