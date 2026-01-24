import { ActionContext, FunctionFactory } from '../actions/types';
import { getApiKey } from '../../services/api.key.service';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TestConnectionResult } from '../../services/integration-config.service';

/**
 * Validate Anthropic Claude connection
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.anthropic_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'Anthropic API key is not configured',
    };
  }

  try {
    // Create an Anthropic provider and test with a simple generation
    const anthropic = createAnthropic({ apiKey });

    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: 'Say "connected" in one word.',
    });

    if (result.text) {
      return {
        success: true,
        message: 'Connected successfully to Anthropic Claude API.',
      };
    }

    return {
      success: true,
      message: 'Connected to Anthropic Claude API.',
    };
  } catch (error: any) {
    if (error.status === 401 || error.message?.includes('authentication')) {
      return {
        success: false,
        error: 'Invalid API key. Please check your Anthropic API key.',
      };
    }
    if (error.status === 429) {
      return {
        success: false,
        error:
          'Rate limited. Your API key is valid but you have exceeded your rate limit.',
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to connect to Anthropic Claude',
    };
  }
}

interface GenerateTextArgs {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
}

interface AnalyzeImageArgs {
  imageUrl: string;
  prompt?: string;
  model?: string;
}

interface ChatArgs {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
}

interface SummarizeArgs {
  text: string;
  format?: 'bullets' | 'paragraph' | 'detailed';
  maxLength?: number;
  model?: string;
}

export const createAnthropicActions = (
  context: ActionContext,
): FunctionFactory => ({
  claudeGenerateText: {
    description:
      'Generate text using Anthropic Claude models. Supports Claude 4.5 Sonnet, Haiku, and Opus.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt or question to generate text for',
        },
        systemPrompt: {
          type: 'string',
          description: 'Optional system instructions to guide Claude behavior',
        },
        model: {
          type: 'string',
          enum: [
            'claude-sonnet-4-5-20250929',
            'claude-haiku-4-5-20251001',
            'claude-sonnet-4-20250514',
          ],
          description:
            'The Claude model to use (default: claude-sonnet-4-5-20250929)',
          default: 'claude-sonnet-4-5-20250929',
        },
        temperature: {
          type: 'number',
          description:
            'Sampling temperature (0-1). Higher values make output more random (default: 0.7)',
          default: 0.7,
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    function: async ({
      prompt,
      systemPrompt,
      model = 'claude-sonnet-4-5-20250929',
      temperature = 0.7,
    }: GenerateTextArgs) => {
      const actionName = 'claudeGenerateText';
      const apiKey = await getApiKey(context.companyId, 'anthropic_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Anthropic API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ text: string; model: string }>(
        actionName,
        async () => {
          const anthropic = createAnthropic({ apiKey });

          // Build messages array - Anthropic requires system prompt in messages array
          const messages: any[] = [];
          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }
          messages.push({ role: 'user', content: prompt });

          const result = await generateText({
            model: anthropic(model),
            messages,
            temperature,
          });

          return {
            success: true,
            data: {
              text: result.text,
              model,
            },
          };
        },
        { serviceName: 'AnthropicService' },
      );
    },
  },

  claudeAnalyzeImage: {
    description:
      'Analyze an image using Claude vision capabilities. Can describe, extract text, answer questions about images.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'URL of the image to analyze',
        },
        prompt: {
          type: 'string',
          description:
            'Question or instruction about the image (default: "Describe this image in detail")',
          default: 'Describe this image in detail',
        },
        model: {
          type: 'string',
          enum: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514'],
          description:
            'The Claude model to use for vision (default: claude-sonnet-4-5-20250929)',
          default: 'claude-sonnet-4-5-20250929',
        },
      },
      required: ['imageUrl'],
      additionalProperties: false,
    },
    function: async ({
      imageUrl,
      prompt = 'Describe this image in detail',
      model = 'claude-sonnet-4-5-20250929',
    }: AnalyzeImageArgs) => {
      const actionName = 'claudeAnalyzeImage';
      const apiKey = await getApiKey(context.companyId, 'anthropic_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Anthropic API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ analysis: string; model: string }>(
        actionName,
        async () => {
          const anthropic = createAnthropic({ apiKey });

          const result = await generateText({
            model: anthropic(model),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image', image: imageUrl },
                ],
              },
            ],
          });

          return {
            success: true,
            data: {
              analysis: result.text,
              model,
            },
          };
        },
        { serviceName: 'AnthropicService' },
      );
    },
  },

  claudeChat: {
    description:
      'Have a multi-turn conversation with Claude. Maintains context across messages.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['user', 'assistant'],
                description: 'The role of the message sender',
              },
              content: {
                type: 'string',
                description: 'The message content',
              },
            },
            required: ['role', 'content'],
          },
          description: 'Array of conversation messages with role and content',
        },
        systemPrompt: {
          type: 'string',
          description: 'Optional system instructions to guide the conversation',
        },
        model: {
          type: 'string',
          enum: [
            'claude-sonnet-4-5-20250929',
            'claude-haiku-4-5-20251001',
            'claude-sonnet-4-20250514',
          ],
          description:
            'The Claude model to use (default: claude-sonnet-4-5-20250929)',
          default: 'claude-sonnet-4-5-20250929',
        },
        temperature: {
          type: 'number',
          description:
            'Sampling temperature (0-1). Higher values make output more random (default: 0.7)',
          default: 0.7,
        },
      },
      required: ['messages'],
      additionalProperties: false,
    },
    function: async ({
      messages,
      systemPrompt,
      model = 'claude-sonnet-4-5-20250929',
      temperature = 0.7,
    }: ChatArgs) => {
      const actionName = 'claudeChat';
      const apiKey = await getApiKey(context.companyId, 'anthropic_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Anthropic API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ response: string; model: string }>(
        actionName,
        async () => {
          const anthropic = createAnthropic({ apiKey });

          // Build messages array - Anthropic requires system prompt in messages array
          const formattedMessages: any[] = [];
          if (systemPrompt) {
            formattedMessages.push({ role: 'system', content: systemPrompt });
          }
          formattedMessages.push(
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          );

          const result = await generateText({
            model: anthropic(model),
            messages: formattedMessages,
            temperature,
          });

          return {
            success: true,
            data: {
              response: result.text,
              model,
            },
          };
        },
        { serviceName: 'AnthropicService' },
      );
    },
  },

  claudeSummarize: {
    description:
      'Summarize text or documents using Claude. Supports different formats and lengths.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text or document content to summarize',
        },
        format: {
          type: 'string',
          enum: ['bullets', 'paragraph', 'detailed'],
          description:
            'Output format: bullets (key points), paragraph (concise), or detailed (comprehensive)',
          default: 'paragraph',
        },
        maxLength: {
          type: 'number',
          description:
            'Approximate maximum length of summary in words (default: 200)',
          default: 200,
        },
        model: {
          type: 'string',
          enum: [
            'claude-sonnet-4-5-20250929',
            'claude-haiku-4-5-20251001',
            'claude-sonnet-4-20250514',
          ],
          description:
            'The Claude model to use (default: claude-haiku-4-5-20251001 for speed)',
          default: 'claude-haiku-4-5-20251001',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    function: async ({
      text,
      format = 'paragraph',
      maxLength = 200,
      model = 'claude-haiku-4-5-20251001',
    }: SummarizeArgs) => {
      const actionName = 'claudeSummarize';
      const apiKey = await getApiKey(context.companyId, 'anthropic_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Anthropic API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ summary: string; format: string; model: string }>(
        actionName,
        async () => {
          const anthropic = createAnthropic({ apiKey });

          // Build format-specific instructions
          let formatInstructions = '';
          switch (format) {
            case 'bullets':
              formatInstructions = 'Provide key points as bullet points.';
              break;
            case 'paragraph':
              formatInstructions = 'Write a concise paragraph summary.';
              break;
            case 'detailed':
              formatInstructions =
                'Write a comprehensive summary covering all main topics and details.';
              break;
          }

          const prompt = `Summarize the following text. ${formatInstructions} Keep the summary around ${maxLength} words.

Text to summarize:
${text}

Summary:`;

          const result = await generateText({
            model: anthropic(model),
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3, // Lower temperature for more consistent summaries
          });

          return {
            success: true,
            data: {
              summary: result.text,
              format,
              model,
            },
          };
        },
        { serviceName: 'AnthropicService' },
      );
    },
  },
});
