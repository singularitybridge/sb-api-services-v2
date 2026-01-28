/**
 * Get Session Messages Tool
 *
 * Retrieves message history for a session with pagination support
 */

import { z } from 'zod';
import { Message } from '../../models/Message';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';

/**
 * Input schema for the get_session_messages tool
 */
export const getSessionMessagesSchema = z.object({
  sessionId: z.string().describe('Session ID to get messages from'),
  limit: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of messages to return (default: 50)'),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe('Number of messages to skip for pagination (default: 0)'),
  sender: z
    .enum(['user', 'assistant', 'system'])
    .optional()
    .describe('Filter by sender type'),
});

export type GetSessionMessagesInput = z.infer<typeof getSessionMessagesSchema>;

/**
 * Get messages from a session with pagination
 */
export async function getSessionMessages(
  input: GetSessionMessagesInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate session ownership
    await validateSessionOwnership(input.sessionId, companyId);

    const limit = input.limit || 50;
    const offset = input.offset || 0;

    // Build query
    const query: any = { sessionId: input.sessionId };
    if (input.sender) {
      query.sender = input.sender;
    }

    // Get messages with pagination
    const messages = await Message.find(query)
      .sort({ timestamp: 1 }) // Oldest first for conversation order
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Message.countDocuments(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              messages: messages.map((msg) => ({
                id: msg._id.toString(),
                role: msg.sender,
                content: msg.content || '',
                messageType: msg.messageType,
                toolCalls: msg.data?.toolCalls || msg.data?.toolResults || [],
                createdAt:
                  msg.timestamp?.toISOString() || new Date().toISOString(),
              })),
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
    console.error('MCP get session messages error:', error);

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
                  : 'Failed to get session messages',
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
export const getSessionMessagesTool = {
  name: 'get_session_messages',
  description:
    'Retrieve message history for a chat session with pagination. Returns messages in chronological order. Use for verifying conversation flow during testing.',
  inputSchema: getSessionMessagesSchema,
};
