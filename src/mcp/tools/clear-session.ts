/**
 * Clear Session Tool
 *
 * Clears all messages from a session (resets the conversation)
 */

import { z } from 'zod';
import { Message } from '../../models/Message';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';

/**
 * Input schema for the clear_session tool
 */
export const clearSessionSchema = z.object({
  sessionId: z.string().describe('Session ID to clear messages from'),
});

export type ClearSessionInput = z.infer<typeof clearSessionSchema>;

/**
 * Clear all messages from a session
 */
export async function clearSession(
  input: ClearSessionInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate session ownership
    await validateSessionOwnership(input.sessionId, companyId);

    // Delete all messages for this session
    const result = await Message.deleteMany({ sessionId: input.sessionId });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              sessionId: input.sessionId,
              messagesDeleted: result.deletedCount,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP clear session error:', error);

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
                  : 'Failed to clear session',
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
export const clearSessionTool = {
  name: 'clear_session',
  description:
    'Clear all messages from a chat session. The session remains active but with empty history. Use this to reset a session for a new test case.',
  inputSchema: clearSessionSchema,
};
