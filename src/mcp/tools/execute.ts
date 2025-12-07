/**
 * Execute Tool - Direct Service Integration
 *
 * Executes an AI assistant with a user prompt
 */

import { z } from 'zod';
import { executeAssistantStateless } from '../../services/assistant/stateless-execution.service';
import { Assistant } from '../../models/Assistant';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';

/**
 * Input schema for the execute tool
 */
export const executeSchema = z.object({
  assistantId: z
    .string()
    .describe(
      'The ID of the AI assistant to execute (e.g., "681b41850f470a9a746f280e")',
    ),
  userInput: z
    .string()
    .describe('The user message/prompt to send to the assistant'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional session ID to maintain conversation context'),
  systemPromptOverride: z
    .string()
    .optional()
    .describe(
      'Optional system prompt override to customize assistant behavior',
    ),
  attachments: z
    .array(
      z.object({
        type: z
          .enum(['url', 'base64'])
          .describe(
            'Type of attachment: "url" for URLs or "base64" for base64-encoded data',
          ),
        data: z
          .string()
          .optional()
          .describe('Base64-encoded attachment data (if type is "base64")'),
        url: z
          .string()
          .optional()
          .describe('URL to the attachment (if type is "url")'),
        mimeType: z
          .string()
          .describe('MIME type of the attachment (e.g., "image/png")'),
        fileName: z.string().optional().describe('Optional file name'),
      }),
    )
    .optional()
    .describe('Optional array of attachments (images, files)'),
});

export type ExecuteInput = z.infer<typeof executeSchema>;

/**
 * Execute an AI assistant using direct service integration
 */
export async function execute(
  input: ExecuteInput,
  companyId: string,
  userId: string,
): Promise<{
  content: Array<{ type: string; text: string }>;
  toolErrors?: Array<{ toolName: string; error: string }>;
  isError?: boolean;
}> {
  try {
    // Resolve assistant by ID or name
    const assistant = await resolveAssistantIdentifier(
      input.assistantId,
      companyId,
    );

    if (!assistant) {
      throw new Error(`Assistant not found: ${input.assistantId}`);
    }

    // Transform attachments to match service format
    const attachments = input.attachments?.map((att) => ({
      type: att.type as 'url' | 'base64',
      data: att.data,
      url: att.url,
      mimeType: att.mimeType,
      fileName: att.fileName || 'attachment',
    }));

    // Call the stateless execution service directly
    const result = await executeAssistantStateless(
      assistant,
      input.userInput,
      companyId,
      userId,
      attachments,
      undefined, // responseFormat
      input.sessionId ? { sessionId: input.sessionId } : undefined,
      input.systemPromptOverride,
    );

    // Extract tool errors if present
    const toolErrors: Array<{ toolName: string; error: string }> = [];
    if (
      typeof result === 'object' &&
      !('text' in result) &&
      result.data?.toolResults
    ) {
      // Check each tool result for errors
      for (const toolResult of result.data.toolResults) {
        const resultContent =
          typeof toolResult.result === 'string'
            ? toolResult.result
            : toolResult.result === undefined || toolResult.result === null
              ? ''
              : JSON.stringify(toolResult.result);

        // Detect error patterns in tool results
        if (
          resultContent &&
          (resultContent.startsWith('Error:') ||
            resultContent.startsWith('Exception:'))
        ) {
          toolErrors.push({
            toolName: toolResult.toolName,
            error: resultContent,
          });
        }
      }
    }

    // Handle different response types
    let responseText: string;
    if (typeof result === 'string') {
      responseText = result;
    } else if (typeof result === 'object' && 'text' in result) {
      // StreamTextResult
      responseText = JSON.stringify(result);
    } else {
      // Object result (from generateObject mode)
      responseText = JSON.stringify(result);
    }

    // Format the response for MCP
    const response: {
      content: Array<{ type: string; text: string }>;
      toolErrors?: Array<{ toolName: string; error: string }>;
    } = {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };

    // Add tool errors if any were detected
    if (toolErrors.length > 0) {
      response.toolErrors = toolErrors;
    }

    return response;
  } catch (error) {
    console.error('MCP execute assistant error:', error);

    // Return error in a structured format
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
                  : 'Unknown error occurred',
              assistantId: input.assistantId,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Tool metadata for registration
 */
export const executeTool = {
  name: 'execute',
  description:
    "Execute an AI assistant with a user prompt. Supports optional system prompt override and session context. Returns the assistant's response including any tool calls, thinking, or generated content.",
  inputSchema: executeSchema,
};
