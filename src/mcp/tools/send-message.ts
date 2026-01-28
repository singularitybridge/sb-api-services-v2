/**
 * Send Message Tool
 *
 * Sends a message to a session and optionally waits for the assistant's response
 */

import { z } from 'zod';
import { Session } from '../../models/Session';
import { Message } from '../../models/Message';
import { validateSessionOwnership } from '../../services/session/session-resolver.service';
import { handleSessionMessage } from '../../services/assistant.service';

/**
 * Input schema for the send_message tool
 */
export const sendMessageSchema = z.object({
  sessionId: z.string().describe('Session ID to send the message to'),
  message: z.string().describe('User message content'),
  attachments: z
    .array(
      z.object({
        type: z.enum(['url', 'base64']).describe('Type of attachment'),
        url: z
          .string()
          .optional()
          .describe('URL to the attachment (if type is "url")'),
        data: z
          .string()
          .optional()
          .describe('Base64-encoded data (if type is "base64")'),
        mimeType: z.string().describe('MIME type of the attachment'),
        fileName: z.string().optional().describe('Optional file name'),
      }),
    )
    .optional()
    .describe('Optional array of attachments'),
  waitForResponse: z
    .boolean()
    .optional()
    .default(true)
    .describe('Wait for assistant response (default: true)'),
  timeout: z
    .number()
    .optional()
    .default(60000)
    .describe('Response timeout in milliseconds (default: 60000)'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Send a message to a session and optionally wait for response
 */
export async function sendMessage(
  input: SendMessageInput,
  companyId: string,
  _userId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate session ownership
    await validateSessionOwnership(input.sessionId, companyId);

    // Get session details
    const session = await Session.findById(input.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Transform attachments to match service format
    const attachments = input.attachments?.map((att) => ({
      type: att.type as 'url' | 'base64',
      data: att.data,
      url: att.url,
      mimeType: att.mimeType,
      fileName: att.fileName || 'attachment',
    }));

    // Send message to assistant (non-streaming)
    const result = await handleSessionMessage(
      input.message,
      input.sessionId,
      undefined, // No streaming metadata
      attachments,
    );

    // Get the user message that was just created
    const userMessage = await Message.findOne({
      sessionId: session._id,
      sender: 'user',
    }).sort({ timestamp: -1 });

    const responseData: any = {
      userMessageId: userMessage?._id?.toString() || 'unknown',
    };

    // If waitForResponse is true, get the assistant's response
    if (input.waitForResponse !== false) {
      // The result from handleSessionMessage should be the assistant's response text
      if (typeof result === 'string') {
        // Get the assistant message that was created
        const assistantMessage = await Message.findOne({
          sessionId: session._id,
          sender: 'assistant',
        }).sort({ timestamp: -1 });

        responseData.response = {
          messageId: assistantMessage?._id?.toString() || 'unknown',
          content: result,
          toolCalls: assistantMessage?.data?.toolCalls || [],
          createdAt:
            assistantMessage?.timestamp?.toISOString() ||
            new Date().toISOString(),
        };
      } else if (result && typeof result === 'object') {
        // Handle case where result might be an object with text property
        const text =
          (result as any).text ||
          (result as any).content ||
          JSON.stringify(result);

        const assistantMessage = await Message.findOne({
          sessionId: session._id,
          sender: 'assistant',
        }).sort({ timestamp: -1 });

        responseData.response = {
          messageId: assistantMessage?._id?.toString() || 'unknown',
          content: text,
          toolCalls: assistantMessage?.data?.toolCalls || [],
          createdAt:
            assistantMessage?.timestamp?.toISOString() ||
            new Date().toISOString(),
        };
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(responseData, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('MCP send message error:', error);

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
                  : 'Failed to send message',
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
export const sendMessageTool = {
  name: 'send_message',
  description:
    "Send a message to a chat session and get the assistant's response. Supports attachments. Use for programmatic testing of agent conversations.",
  inputSchema: sendMessageSchema,
};
