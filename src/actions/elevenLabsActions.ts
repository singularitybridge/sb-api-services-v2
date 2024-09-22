import { ActionContext, FunctionFactory } from '../integrations/actions/types';
import { generateAudio } from '../services/11labs.service';
import { getApiKey } from '../services/api.key.service';

export const createElevenLabsActions = (context: ActionContext): FunctionFactory => ({
  generateElevenLabsAudio: {
    function: async ({ text, voiceId }: { text: string; voiceId: string }) => {
      try {
        const apiKey = await getApiKey(context.companyId, 'labs11');
        if (!apiKey) {
          throw new Error('ElevenLabs API key is missing');
        }
        const audioUrl = await generateAudio(apiKey, text, voiceId);
        return { audioUrl };
      } catch (error) {
        console.error('Error generating audio with ElevenLabs:', error);
        throw new Error('Failed to generate audio with ElevenLabs');
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