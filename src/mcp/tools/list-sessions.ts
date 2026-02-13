/**
 * List Sessions Tool
 *
 * Lists sessions with optional filters for agent and status
 */

import { z } from 'zod';
import { listSessionsEnriched } from '../../services/session.service';

/**
 * Input schema for the list_sessions tool
 */
export const listSessionsSchema = z.object({
  agentId: z.string().optional().describe('Filter by agent ID or name'),
  status: z
    .enum(['active', 'inactive'])
    .optional()
    .describe('Filter by session status'),
  channel: z
    .string()
    .optional()
    .describe('Filter by channel (e.g., "web", "telegram", "whatsapp")'),
  channelUserId: z
    .string()
    .optional()
    .describe('Filter by channel user ID'),
  limit: z.coerce
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of sessions to return (default: 20)'),
  offset: z.coerce
    .number()
    .optional()
    .default(0)
    .describe('Number of sessions to skip for pagination (default: 0)'),
});

export type ListSessionsInput = z.infer<typeof listSessionsSchema>;

/**
 * List sessions with optional filters
 */
export async function listSessions(
  input: ListSessionsInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const limit = input.limit || 20;
    const offset = input.offset || 0;

    const { sessions, total } = await listSessionsEnriched(companyId, {
      agentId: input.agentId,
      status: input.status,
      channel: input.channel,
      channelUserId: input.channelUserId,
      limit,
      offset,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessions,
              pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list sessions error:', error);

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
                  : 'Failed to list sessions',
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
export const listSessionsTool = {
  name: 'list_sessions',
  description:
    'List chat sessions with optional filters. Can filter by agent and active/inactive status. Returns session details including message counts.',
  inputSchema: listSessionsSchema,
};
