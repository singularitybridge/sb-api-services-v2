/**
 * Delete Session Tool
 *
 * Ends and permanently deletes a session and its messages
 */

import { z } from 'zod';
import { Session } from '../../models/Session';
import { Message } from '../../models/Message';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';

/**
 * Input schema for the delete_session tool
 */
export const deleteSessionSchema = z.object({
  sessionId: z.string().describe('Session ID to delete'),
});

export type DeleteSessionInput = z.infer<typeof deleteSessionSchema>;

/**
 * Delete a session and all its messages
 */
export async function deleteSession(
  input: DeleteSessionInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate session ownership
    await validateSessionOwnership(input.sessionId, companyId);

    // Delete all messages for this session
    await Message.deleteMany({ sessionId: input.sessionId });

    // Delete the session
    await Session.deleteOne({ _id: input.sessionId });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              deletedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP delete session error:', error);

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
                  : 'Failed to delete session',
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
export const deleteSessionTool = {
  name: 'delete_session',
  description:
    'Permanently delete a chat session and all its messages. Use this to clean up after testing.',
  inputSchema: deleteSessionSchema,
};
