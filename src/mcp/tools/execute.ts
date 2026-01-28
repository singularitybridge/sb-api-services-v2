/**
 * Execute Tool - Direct Service Integration
 *
 * Executes an AI assistant with a user prompt
 */

import { z } from 'zod';
import { executeAssistantStateless } from '../../services/assistant/stateless-execution.service';
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
  responseFormat: z
    .object({
      type: z
        .enum(['json_object'])
        .describe(
          'Response format type: "json_object" for JSON mode (instructs the model to return valid JSON)',
        ),
    })
    .optional()
    .describe(
      'Optional response format for structured JSON output. Use { type: "json_object" } to get JSON responses.',
    ),
  includeToolCalls: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include detailed tool call information in response. Defaults to true for MCP. Shows which tools were called and their results.',
    ),
});

export type ExecuteInput = z.infer<typeof executeSchema>;

/**
 * Tool call information extracted from execution
 */
interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/**
 * Execute an AI assistant using direct service integration
 */
export async function execute(
  input: ExecuteInput,
  companyId: string,
  userId: string,
): Promise<{
  content: Array<{ type: string; text: string }>;
  toolCalls?: ToolCallInfo[];
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
      input.responseFormat as any, // responseFormat for JSON mode (json_object only via MCP)
      input.sessionId ? { sessionId: input.sessionId } : undefined,
      input.systemPromptOverride,
    );

    // Extract tool calls and errors if present
    const toolCalls: ToolCallInfo[] = [];
    const toolErrors: Array<{ toolName: string; error: string }> = [];

    // Extract tool calls from result.data (stateless execution response format)
    const resultData = (result as any)?.data;
    if (resultData) {
      // Extract tool calls with their arguments
      // Vercel AI SDK uses 'input' not 'args' for tool call parameters
      // Also capture toolCallId for proper result correlation
      if (resultData.toolCalls && Array.isArray(resultData.toolCalls)) {
        for (const call of resultData.toolCalls) {
          toolCalls.push({
            toolCallId:
              call.toolCallId || call.id || `call_${toolCalls.length}`,
            toolName: call.toolName,
            args: call.input || call.args || {},
          });
        }
      }

      // Match tool results to tool calls and extract errors
      // Vercel AI SDK uses 'output' not 'result' for tool results
      // Use toolCallId for proper correlation (fixes bug where same tool called multiple times)
      if (resultData.toolResults && Array.isArray(resultData.toolResults)) {
        for (const toolResult of resultData.toolResults) {
          // Get the result content (Vercel AI SDK uses 'output')
          const outputValue = toolResult.output ?? toolResult.result;
          const resultContent =
            typeof outputValue === 'string'
              ? outputValue
              : outputValue === undefined || outputValue === null
                ? ''
                : JSON.stringify(outputValue);

          // Find the matching tool call by toolCallId (not toolName)
          // This correctly correlates results when the same tool is called multiple times
          const resultToolCallId = toolResult.toolCallId || toolResult.id;
          const matchingCall = toolCalls.find(
            (tc) => tc.toolCallId === resultToolCallId,
          );
          if (matchingCall) {
            matchingCall.result = outputValue;
          } else {
            // Tool result without a matching call (shouldn't happen, but handle it)
            toolCalls.push({
              toolCallId: resultToolCallId || `result_${toolCalls.length}`,
              toolName: toolResult.toolName,
              args: toolResult.input || {},
              result: outputValue,
            });
          }

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
            // Also mark the error on the tool call
            if (matchingCall) {
              matchingCall.error = resultContent;
            }
          }
        }
      }
    }

    // Handle different response types - extract the assistant's text response
    let responseText: string | null = null;
    if (typeof result === 'string') {
      responseText = result;
    } else if (typeof result === 'object' && 'text' in result) {
      // StreamTextResult
      responseText = JSON.stringify(result);
    } else if (
      typeof result === 'object' &&
      result.content &&
      Array.isArray(result.content)
    ) {
      // Extract text from content array
      const textContent = result.content.find(
        (c: any) => c.type === 'text' && c.text?.value,
      );
      // Only use the text if it's not empty
      if (textContent?.text?.value) {
        responseText = textContent.text.value;
      }
    }

    // Format the response for MCP
    const contentBlocks: Array<{ type: string; text: string }> = [];

    // Add main response text if present
    if (responseText) {
      contentBlocks.push({
        type: 'text',
        text: responseText,
      });
    }

    // Add tool calls summary if requested and present
    if (input.includeToolCalls !== false && toolCalls.length > 0) {
      const toolCallsSummary = toolCalls.map((tc) => ({
        tool: tc.toolName,
        args: tc.args,
        ...(tc.result !== undefined && {
          result:
            typeof tc.result === 'string'
              ? tc.result.length > 500
                ? tc.result.substring(0, 500) + '... (truncated)'
                : tc.result
              : tc.result,
        }),
        ...(tc.error && { error: tc.error }),
      }));

      contentBlocks.push({
        type: 'text',
        text: `\n---\n**Tool Calls (${toolCalls.length}):**\n${JSON.stringify(toolCallsSummary, null, 2)}`,
      });
    }

    // Add tool errors summary if present
    if (toolErrors.length > 0) {
      contentBlocks.push({
        type: 'text',
        text: `\n---\n**Tool Errors (${toolErrors.length}):**\n${JSON.stringify(toolErrors, null, 2)}`,
      });
    }

    // Ensure we have at least one content block
    if (contentBlocks.length === 0) {
      contentBlocks.push({
        type: 'text',
        text: '(No response content)',
      });
    }

    return {
      content: contentBlocks,
      // Also include structured data for programmatic access
      ...(input.includeToolCalls !== false &&
        toolCalls.length > 0 && { toolCalls }),
      ...(toolErrors.length > 0 && { toolErrors }),
    };
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
    "Execute an AI assistant with a user prompt. Supports optional system prompt override and session context. Returns the assistant's response including any tool calls, thinking, or generated content. When includeToolCalls is true (default), the response includes a toolCalls array showing exactly which tools were invoked and their results.",
  inputSchema: executeSchema,
};
