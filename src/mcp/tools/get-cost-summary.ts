/**
 * Get Cost Summary Tool
 *
 * Gets cost tracking summary for the company
 */

import { z } from 'zod';
import { getCostSummary } from '../../services/cost-tracking.service';

/**
 * Input schema for the get_cost_summary tool
 */
export const getCostSummarySchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe(
      'Start date for the cost summary (ISO 8601 format, e.g., "2025-01-01")',
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      'End date for the cost summary (ISO 8601 format, e.g., "2025-01-31")',
    ),
  provider: z
    .string()
    .optional()
    .describe('Filter by LLM provider (e.g., "openai", "anthropic", "google")'),
});

export type GetCostSummaryInput = z.infer<typeof getCostSummarySchema>;

/**
 * Get cost summary for the company
 */
export async function getCostSummaryTool(
  input: GetCostSummaryInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const summary = await getCostSummary(
      companyId,
      input.startDate ? new Date(input.startDate) : undefined,
      input.endDate ? new Date(input.endDate) : undefined,
      input.provider,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              summary,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get cost summary error:', error);

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
                  : 'Failed to get cost summary',
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
export const getCostSummaryToolMeta = {
  name: 'get_cost_summary',
  description:
    'Get a summary of AI costs for the company, including total costs, breakdowns by model, provider, and assistant. Supports filtering by date range and provider.',
  inputSchema: getCostSummarySchema,
};
