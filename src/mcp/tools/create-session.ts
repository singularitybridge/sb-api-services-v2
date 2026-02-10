/**
 * Create Session Tool
 *
 * Creates a new chat session with an AI assistant for programmatic testing
 */

import { z } from 'zod';
import mongoose from 'mongoose';
import { Session } from '../../models/Session';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the create_session tool
 */
export const createSessionSchema = z.object({
  agentId: z.string().describe('Agent ID or name to start a session with'),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .describe('Optional session metadata'),
  channel: z
    .string()
    .optional()
    .describe('Channel identifier (e.g., "web", "telegram", "whatsapp", "email", "api"). Defaults to "web".'),
  channelUserId: z
    .string()
    .optional()
    .describe('External user ID for the channel (e.g., Telegram user ID, phone number). Defaults to empty string.'),
  channelMetadata: z
    .record(z.string(), z.any())
    .optional()
    .describe('Optional channel-specific metadata (e.g., username, display name).'),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/**
 * Create a new chat session with an AI assistant
 */
export async function createSession(
  input: CreateSessionInput,
  companyId: string,
  userId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Resolve agent by ID or name
    const assistant = await resolveAssistantIdentifier(
      input.agentId,
      companyId,
    );

    if (!assistant) {
      throw new Error(`Assistant not found: ${input.agentId}`);
    }

    const channel = input.channel || 'web';
    const channelUserId = input.channelUserId || userId;

    // Deactivate any existing active sessions for this user on the same channel + agent
    await Session.updateMany(
      { userId, companyId, channel, channelUserId, assistantId: assistant._id, active: true },
      { $set: { active: false } },
    );

    // Generate a unique thread ID
    const threadId = new mongoose.Types.ObjectId().toString();

    // Create new session
    const session = await Session.create({
      userId,
      companyId,
      assistantId: assistant._id,
      active: true,
      threadId,
      channel,
      channelUserId,
      ...(input.channelMetadata && { channelMetadata: input.channelMetadata }),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: session._id.toString(),
              agentId: assistant._id.toString(),
              agentName: assistant.name,
              channel,
              channelUserId,
              createdAt:
                session.createdAt?.toISOString() || new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP create session error:', error);

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
                  : 'Failed to create session',
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
export const createSessionTool = {
  name: 'create_session',
  description:
    'Start a new chat session with an AI assistant. Deactivates any existing active session for the user. Use this for programmatic testing of agents.',
  inputSchema: createSessionSchema,
};
