import { ActionContext, FunctionFactory } from '../actions/types';
import { generateAudio } from './elevenlabs.service';
import { getApiKey } from '../../services/api.key.service';

export const createElevenLabsActions = (context: ActionContext): FunctionFactory => ({
  generateElevenLabsAudio: {
    function: async ({ text, voiceId }: { text: string; voiceId: string }) => {
      const apiKey = await getApiKey(context.companyId, 'labs11_api_key');
      if (!apiKey) {
        return {
          success: false,
          error: 'API key missing',
          message: 'ElevenLabs API key is not configured.',
        };
      }

      const result = await generateAudio(apiKey, text, voiceId);
      if (result.success) {
        return {
          success: true,
          data: { audioUrl: result.data?.audioUrl },
        };
      } else {
        return {
          success: false,
          error: 'Audio generation failed',
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
      },
      required: ['text', 'voiceId'],
    },
  },
});
