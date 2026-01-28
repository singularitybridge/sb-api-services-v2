/**
 * List Sessions Tool
 *
 * Lists sessions with optional filters for agent and status
 */

import { z } from 'zod';
import { Session } from '../../models/Session';
import { Message } from '../../models/Message';
import { Assistant } from '../../models/Assistant';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the list_sessions tool
 */
export const listSessionsSchema = z.object({
  agentId: z.string().optional().describe('Filter by agent ID or name'),
  status: z
    .enum(['active', 'inactive'])
    .optional()
    .describe('Filter by session status'),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of sessions to return (default: 20)'),
  offset: z
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

    // Build query
    const query: any = { companyId };

    // Filter by agent if provided
    if (input.agentId) {
      const assistant = await resolveAssistantIdentifier(
        input.agentId,
        companyId,
      );
      if (!assistant) {
        throw new Error(`Assistant not found: ${input.agentId}`);
      }
      query.assistantId = assistant._id;
    }

    // Filter by status if provided
    if (input.status) {
      query.active = input.status === 'active';
    }

    // Get sessions with pagination
    const sessions = await Session.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Session.countDocuments(query);

    // Enrich with assistant names and message counts
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        // Get assistant name
        const assistant = await Assistant.findById(session.assistantId).lean();

        // Get message count and last message
        const messageCount = await Message.countDocuments({
          sessionId: session._id,
        });
        const lastMessage = await Message.findOne({ sessionId: session._id })
          .sort({ timestamp: -1 })
          .lean();

        return {
          sessionId: session._id.toString(),
          agentId: session.assistantId?.toString() || '',
          agentName: assistant?.name || 'Unknown',
          active: session.active,
          messageCount,
          lastMessageAt: lastMessage?.timestamp?.toISOString() || null,
          createdAt:
            session.createdAt?.toISOString() || new Date().toISOString(),
        };
      }),
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessions: enrichedSessions,
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
