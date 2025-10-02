/**
 * Execute Assistant Tool
 *
 * MCP tool for executing AI assistants via the Singularity Bridge API
 */

import { z } from 'zod';
import { APIClient } from '../api-client.js';

/**
 * Input schema for the execute_assistant tool
 */
export const executeAssistantSchema = z.object({
  assistantId: z.string()
    .describe('The ID of the AI assistant to execute (e.g., "681b41850f470a9a746f280e")'),
  userInput: z.string()
    .describe('The user message/prompt to send to the assistant'),
  sessionId: z.string().optional()
    .describe('Optional session ID to maintain conversation context'),
  systemPromptOverride: z.string().optional()
    .describe('Optional system prompt override to customize assistant behavior'),
  attachments: z.array(z.object({
    type: z.enum(['url', 'base64'])
      .describe('Type of attachment: "url" for URLs or "base64" for base64-encoded data'),
    data: z.string()
      .describe('The attachment data (URL or base64 string)'),
    mimeType: z.string().optional()
      .describe('MIME type of the attachment (e.g., "image/png")')
  })).optional()
    .describe('Optional array of attachments (images, files)')
});

export type ExecuteAssistantInput = z.infer<typeof executeAssistantSchema>;

/**
 * Execute an AI assistant
 */
export async function executeAssistant(
  apiClient: APIClient,
  input: ExecuteAssistantInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const result = await apiClient.executeAssistant(input);

    // Format the response for MCP
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    // Return error in a structured format
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          assistantId: input.assistantId
        }, null, 2)
      }]
    };
  }
}

/**
 * Tool metadata for registration
 */
export const executeAssistantTool = {
  name: 'execute_assistant',
  description: 'Execute an AI assistant with a prompt. Returns the assistant\'s response including any tool calls, thinking, or generated content.',
  inputSchema: executeAssistantSchema
};
