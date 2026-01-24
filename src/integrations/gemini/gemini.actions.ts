import { ActionContext, FunctionFactory } from '../actions/types';
import { getApiKey } from '../../services/api.key.service';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors';
import { generateText, embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { TestConnectionResult } from '../../services/integration-config.service';

/**
 * Validate Google Gemini connection by listing models
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.google_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'Google API key is not configured',
    };
  }

  try {
    // Create a Gemini provider and test with a simple generation
    const googleProvider = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: googleProvider('gemini-2.0-flash'),
      prompt: 'Say "connected" in one word.',
    });

    if (result.text) {
      return {
        success: true,
        message: 'Connected successfully to Google Gemini API.',
      };
    }

    return {
      success: true,
      message: 'Connected to Google Gemini API.',
    };
  } catch (error: any) {
    if (error.message?.includes('API key')) {
      return {
        success: false,
        error: 'Invalid API key. Please check your Google AI API key.',
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
      error: error.message || 'Failed to connect to Google Gemini',
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

interface EmbedTextArgs {
  text: string;
  model?: string;
}

export const createGeminiActions = (
  context: ActionContext,
): FunctionFactory => ({
  geminiGenerateText: {
    description:
      'Generate text using Google Gemini models. Supports Gemini 2.0 Flash, 1.5 Pro, and other models.',
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
          description:
            'Optional system instructions to guide the model behavior',
        },
        model: {
          type: 'string',
          enum: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
          description: 'The Gemini model to use (default: gemini-2.0-flash)',
          default: 'gemini-2.0-flash',
        },
        temperature: {
          type: 'number',
          description:
            'Sampling temperature (0-2). Higher values make output more random (default: 0.7)',
          default: 0.7,
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    function: async ({
      prompt,
      systemPrompt,
      model = 'gemini-2.0-flash',
      temperature = 0.7,
    }: GenerateTextArgs) => {
      const actionName = 'geminiGenerateText';
      const apiKey = await getApiKey(context.companyId, 'google_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Google API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ text: string; model: string }>(
        actionName,
        async () => {
          const google = createGoogleGenerativeAI({ apiKey });

          const result = await generateText({
            model: google(model),
            prompt,
            system: systemPrompt,
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
        { serviceName: 'GeminiService' },
      );
    },
  },

  geminiAnalyzeImage: {
    description:
      'Analyze an image using Google Gemini vision capabilities. Can describe, extract text, answer questions about images.',
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
          enum: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
          description: 'The Gemini model to use (default: gemini-2.0-flash)',
          default: 'gemini-2.0-flash',
        },
      },
      required: ['imageUrl'],
      additionalProperties: false,
    },
    function: async ({
      imageUrl,
      prompt = 'Describe this image in detail',
      model = 'gemini-2.0-flash',
    }: AnalyzeImageArgs) => {
      const actionName = 'geminiAnalyzeImage';
      const apiKey = await getApiKey(context.companyId, 'google_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Google API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ analysis: string; model: string }>(
        actionName,
        async () => {
          const google = createGoogleGenerativeAI({ apiKey });

          const result = await generateText({
            model: google(model),
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
        { serviceName: 'GeminiService' },
      );
    },
  },

  geminiChat: {
    description:
      'Have a multi-turn conversation with Google Gemini. Maintains context across messages.',
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
          enum: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
          description: 'The Gemini model to use (default: gemini-2.0-flash)',
          default: 'gemini-2.0-flash',
        },
        temperature: {
          type: 'number',
          description:
            'Sampling temperature (0-2). Higher values make output more random (default: 0.7)',
          default: 0.7,
        },
      },
      required: ['messages'],
      additionalProperties: false,
    },
    function: async ({
      messages,
      systemPrompt,
      model = 'gemini-2.0-flash',
      temperature = 0.7,
    }: ChatArgs) => {
      const actionName = 'geminiChat';
      const apiKey = await getApiKey(context.companyId, 'google_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Google API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ response: string; model: string }>(
        actionName,
        async () => {
          const google = createGoogleGenerativeAI({ apiKey });

          const result = await generateText({
            model: google(model),
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
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
        { serviceName: 'GeminiService' },
      );
    },
  },

  geminiEmbedText: {
    description:
      'Generate text embeddings using Google Gemini embedding models. Useful for semantic search and similarity.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to generate embeddings for',
        },
        model: {
          type: 'string',
          enum: ['text-embedding-004'],
          description:
            'The embedding model to use (default: text-embedding-004)',
          default: 'text-embedding-004',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    function: async ({ text, model = 'text-embedding-004' }: EmbedTextArgs) => {
      const actionName = 'geminiEmbedText';
      const apiKey = await getApiKey(context.companyId, 'google_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'Google API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{
        embedding: number[];
        dimensions: number;
        model: string;
      }>(
        actionName,
        async () => {
          const googleProvider = createGoogleGenerativeAI({ apiKey });

          const result = await embed({
            model: googleProvider.textEmbeddingModel(model),
            value: text,
          });

          return {
            success: true,
            data: {
              embedding: result.embedding,
              dimensions: result.embedding.length,
              model,
            },
          };
        },
        { serviceName: 'GeminiService' },
      );
    },
  },
});
