/**
 * Get Daily Costs Tool
 *
 * Retrieves daily cost breakdown for AI usage trends and analysis.
 */

import { z } from 'zod';
import { getDailyCosts } from '../../services/cost-tracking.service';

/**
 * Input schema for the get_daily_costs tool
 */
export const getDailyCostsSchema = z.object({
  days: z
    .number()
    .optional()
    .default(30)
    .describe('Number of days to retrieve (default: 30)'),
  startDate: z
    .string()
    .optional()
    .describe(
      'Start date for the range (ISO 8601 format, e.g., "2025-01-01"). If provided, overrides days parameter.',
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      'End date for the range (ISO 8601 format, e.g., "2025-01-31"). Defaults to today if startDate is provided.',
    ),
  provider: z
    .string()
    .optional()
    .describe('Filter by LLM provider (e.g., "openai", "anthropic", "google")'),
});

export type GetDailyCostsInput = z.infer<typeof getDailyCostsSchema>;

/**
 * Get daily cost breakdown for the company
 */
export async function getDailyCostsTool(
  input: GetDailyCostsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    const dailyCosts = await getDailyCosts(
      companyId,
      input.days,
      startDate,
      endDate,
      input.provider,
    );

    // Calculate summary statistics
    const totalCost = dailyCosts.reduce((sum, day) => sum + day.cost, 0);
    const totalRequests = dailyCosts.reduce(
      (sum, day) => sum + day.requests,
      0,
    );
    const totalTokens = dailyCosts.reduce((sum, day) => sum + day.tokens, 0);
    const avgDailyCost =
      dailyCosts.length > 0 ? totalCost / dailyCosts.length : 0;

    // Find peak day
    const peakDay = dailyCosts.reduce(
      (max, day) => (day.cost > max.cost ? day : max),
      { date: 'N/A', cost: 0, requests: 0, tokens: 0 },
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              summary: {
                totalCost: Number(totalCost.toFixed(4)),
                totalRequests,
                totalTokens,
                averageDailyCost: Number(avgDailyCost.toFixed(4)),
                daysWithData: dailyCosts.length,
                peakDay: peakDay.date !== 'N/A' ? peakDay : undefined,
              },
              dailyCosts: dailyCosts.map((day) => ({
                date: day.date,
                cost: Number(day.cost.toFixed(4)),
                requests: day.requests,
                tokens: day.tokens,
              })),
              filters: {
                days: input.days,
                startDate: input.startDate,
                endDate: input.endDate,
                provider: input.provider,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP get daily costs error:', error);

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
                  : 'Failed to get daily costs',
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
export const getDailyCostsTool_metadata = {
  name: 'get_daily_costs',
  description:
    'Get daily cost breakdown for AI usage over time. Returns daily totals for cost, requests, and tokens. Useful for analyzing spending trends, identifying peak usage days, and budget planning. Use get_cost_summary for aggregated totals by model/provider/assistant.',
  inputSchema: getDailyCostsSchema,
};
