import { ActionContext, FunctionFactory } from '../actions/types';
import { generateAudio, listModels, listVoices } from './elevenlabs.service';
import { getApiKey } from '../../services/api.key.service';

export const createElevenLabsActions = (context: ActionContext): FunctionFactory => ({
  generateElevenLabsAudio: {
    function: async ({ text, voiceId, modelId, filename }: { text: string; voiceId: string; modelId?: string; filename?: string }) => {
      const apiKey = await getApiKey(context.companyId, 'labs11_api_key');
      if (!apiKey) {
        return {
          success: false,
          error: 'API key missing',
          message: 'ElevenLabs API key is not configured.',
        };
      }

      const result = await generateAudio(apiKey, text, voiceId, modelId, filename);
      if (result.success) {
        return {
          success: true,
          data: { audioUrl: result.data?.audioUrl },
        };
      } else {
        return {
          success: false,
          error: result.error || 'Audio generation failed',
          message: result.error || 'Unknown error occurred while generating audio.',
        };
      }
    },
    description: 'Generate audio using ElevenLabs text-to-speech service',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to convert to speech',
        },
        voiceId: {
          type: 'string',
          description: 'The ID of the voice to use for speech generation',
        },
        modelId: {
          type: 'string',
          description: 'Optional model ID to use for speech generation (e.g., eleven_multilingual_v2)',
        },
        filename: {
          type: 'string',
          description: 'Optional custom filename for the generated audio',
        },
      },
      required: ['text', 'voiceId'],
    },
  },
  listElevenLabsModels: {
    function: async () => {
      const apiKey = await getApiKey(context.companyId, 'labs11_api_key');
      if (!apiKey) {
        return {
          success: false,
          error: 'API key missing',
          message: 'ElevenLabs API key is not configured.',
        };
      }
      try {
        const models = await listModels(apiKey);
        return {
          success: true,
          data: models,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list models',
          message: error instanceof Error ? error.message : 'Unknown error occurred while listing models.',
        };
      }
    },
    description: 'List available ElevenLabs models',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  listElevenLabsVoices: {
    function: async () => {
      const apiKey = await getApiKey(context.companyId, 'labs11_api_key');
      if (!apiKey) {
        return {
          success: false,
          error: 'API key missing',
          message: 'ElevenLabs API key is not configured.',
        };
      }
      try {
        const voices = await listVoices(apiKey);
        return {
          success: true,
          data: voices,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list voices',
          message: error instanceof Error ? error.message : 'Unknown error occurred while listing voices.',
        };
      }
    },
    description: 'List available ElevenLabs voices',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
});
