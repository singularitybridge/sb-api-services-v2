import { ActionContext, FunctionFactory } from '../actions/types';
import { generateSpeech } from '../../services/oai.speech.service';
import { transcribeAudioWhisperFromURL } from '../../services/speech.recognition.service';
import { getApiKey } from '../../services/api.key.service';
import OpenAI from 'openai';
import { executeAction } from '../actions/executor';
import {
  ActionExecutionError,
  ActionValidationError,
} from '../../utils/actionErrors';
import { generateText } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { TestConnectionResult } from '../../services/integration-config.service';

/**
 * Validate OpenAI connection by listing models
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.openai_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'OpenAI API key is not configured',
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    // Try to list models - this validates the API key
    const models = await client.models.list();

    if (models.data && models.data.length > 0) {
      return {
        success: true,
        message: `Connected successfully. Found ${models.data.length} available models.`,
      };
    }

    return {
      success: true,
      message: 'Connected successfully to OpenAI API.',
    };
  } catch (error: any) {
    if (error.status === 401) {
      return {
        success: false,
        error: 'Invalid API key. Please check your OpenAI API key.',
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
      error: error.message || 'Failed to connect to OpenAI',
    };
  }
}

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type OpenAIModel = 'tts-1' | 'tts-1-hd';

interface GenerateSpeechArgs {
  text: string;
  voice?: OpenAIVoice;
  model?: OpenAIModel;
  textLimit?: number;
  filename?: string;
}

interface TranscribeAudioArgs {
  audioUrl: string;
  language?: string;
}

interface WebSearchArgs {
  query: string;
  location: string;
  sites: string[];
}

export const createOpenAiActions = (
  context: ActionContext,
): FunctionFactory => ({
  generateOpenAiSpeech: {
    description: 'Generate speech using OpenAI text-to-speech service',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to convert to speech',
        },
        voice: {
          type: 'string',
          enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
          description:
            'The voice to use for speech generation (default: alloy)',
          default: 'alloy',
        },
        model: {
          type: 'string',
          enum: ['tts-1', 'tts-1-hd'],
          description:
            'The model to use for speech generation (default: tts-1-hd)',
          default: 'tts-1-hd',
        },
        textLimit: {
          type: 'number',
          description:
            'The maximum number of characters allowed in the input text (default: 256)',
          default: 256,
        },
        filename: {
          type: 'string',
          description: 'Optional custom filename for the generated audio',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    function: async ({
      text,
      voice = 'alloy',
      model = 'tts-1-hd',
      textLimit = 256,
      filename,
    }: GenerateSpeechArgs) => {
      const actionName = 'generateOpenAiSpeech';
      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'OpenAI API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ audioUrl: string }>(
        actionName,
        async () => {
          const audioUrl = await generateSpeech(
            apiKey,
            text,
            voice,
            model,
            textLimit,
            filename,
          );
          return { success: true, data: { audioUrl } };
        },
        { serviceName: 'OpenAIService' },
      );
    },
  },
  transcribeAudioWhisperFromURL: {
    description: 'Transcribe audio from a URL using OpenAI Whisper',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        audioUrl: {
          type: 'string',
          description: 'The URL of the audio file to transcribe',
        },
        language: {
          type: 'string',
          description:
            'The language of the audio file (optional), e.g., he, en, es, fr, de, it, nl, pt, ru, zh',
        },
      },
      required: ['audioUrl'],
      additionalProperties: false,
    },
    function: async ({ audioUrl, language }: TranscribeAudioArgs) => {
      const actionName = 'transcribeAudioWhisperFromURL';
      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'OpenAI API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ transcription: string }>(
        actionName,
        async () => {
          const transcription = await transcribeAudioWhisperFromURL(
            apiKey,
            audioUrl,
            language,
          );
          return { success: true, data: { transcription } };
        },
        { serviceName: 'OpenAIService' },
      );
    },
  },
  webSearch: {
    description:
      "Search the web using OpenAI's native web search capabilities. When providing location, use ISO 3166-1 two-letter country codes (US, GB, FR, DE, IL, etc.)",
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query or question to answer using web search',
        },
        location: {
          type: 'string',
          description: 'ISO 3166-1 two-letter country code (e.g., US, GB, FR)',
        },
        sites: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of specific sites to search within',
        },
      },
      required: ['query', 'location', 'sites'],
      additionalProperties: false,
    },
    function: async ({ query, location, sites }: WebSearchArgs) => {
      const actionName = 'webSearch';

      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError(
          'OpenAI API key is missing for this company.',
          { actionName, statusCode: 400 },
        );
      }

      return executeAction<{ answer: string; sources?: string[] }>(
        actionName,
        async () => {
          try {
            // Create a custom OpenAI provider instance with the API key
            const customOpenAI = createOpenAI({
              apiKey,
            });

            // Build options object only with provided values
            const searchOptions: any = {};
            if (location && location.trim() !== '') {
              // Ensure it's uppercase and exactly 2 letters
              const countryCode = location.toUpperCase().trim();

              if (countryCode.length !== 2) {
                console.warn(
                  `Invalid country code "${location}" - must be 2 letters. Defaulting to US.`,
                );
                searchOptions.userLocation = {
                  type: 'approximate',
                  country: 'US',
                };
              } else {
                searchOptions.userLocation = {
                  type: 'approximate',
                  country: countryCode,
                };
              }
            } else {
              // Default to US if no location provided
              searchOptions.userLocation = {
                type: 'approximate',
                country: 'US',
              };
            }

            // Note: sites filtering may not be directly supported in the current API

            const result = await generateText({
              model: customOpenAI.responses('gpt-4.1-mini'),
              prompt: query,
              tools: {
                web_search: customOpenAI.tools.webSearchPreview(searchOptions),
              },
            });

            return {
              success: true,
              data: {
                answer: result.text,
                sources: result.sources,
              },
            };
          } catch (error: any) {
            console.error('[webSearch] Error performing web search:', error);
            console.error('[webSearch] Error details:', {
              message: error.message,
              response: error.response,
              statusCode: error.statusCode,
              responseBody: error.responseBody,
            });
            throw new ActionExecutionError('Failed to perform web search', {
              actionName,
              originalError: error,
            });
          }
        },
        { serviceName: 'OpenAIService' },
      );
    },
  },
});
