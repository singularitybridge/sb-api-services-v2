import { ActionContext, FunctionFactory } from '../actions/types';
import { generateAudio, listModels, listVoices } from './elevenlabs.service';
import { getApiKey } from '../../services/api.key.service';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors';

// Define expected data shapes for StandardActionResult for clarity
interface GenerateAudioData {
  audioUrl?: string;
}
// Assuming ModelType[] and VoiceType[] are the expected array types for list actions
// Using any[] for now if specific types are not readily available or too complex for this snippet
type ModelList = any[]; // Replace with actual type e.g. ElevenLabsModel[]
type VoiceList = any[]; // Replace with actual type e.g. ElevenLabsVoice[]

export const createElevenLabsActions = (context: ActionContext): FunctionFactory => ({
  generateElevenLabsAudio: {
    function: async ({ text, voiceId, modelId, filename }: { text: string; voiceId: string; modelId?: string; filename?: string }) => {
      const apiKey = await getApiKey(context.companyId, 'labs11_api_key');
      if (!apiKey) {
        throw new ActionExecutionError('ElevenLabs API key is not configured for this company.', {
          actionName: 'generateElevenLabsAudio',
          statusCode: 400,
        });
      }

      return executeAction<GenerateAudioData, { success: boolean; data?: { audioUrl?: string }; error?: string }>(
        'generateElevenLabsAudio',
        async () => {
          const serviceResult = await generateAudio(apiKey, text, voiceId, modelId, filename);
          if (serviceResult.success) {
            return { success: true, data: { audioUrl: serviceResult.data?.audioUrl } };
          } else {
            return { success: false, description: serviceResult.error || 'Audio generation failed by service' };
          }
        },
        {
          serviceName: 'ElevenLabsService',
        }
      );
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
        throw new ActionExecutionError('ElevenLabs API key is not configured for this company.', {
          actionName: 'listElevenLabsModels',
          statusCode: 400,
        });
      }
      return executeAction<ModelList>(
        'listElevenLabsModels',
        async () => {
          const modelsData = await listModels(apiKey);
          return { success: true, data: modelsData };
        },
        { serviceName: 'ElevenLabsService' }
      );
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
        throw new ActionExecutionError('ElevenLabs API key is not configured for this company.', {
          actionName: 'listElevenLabsVoices',
          statusCode: 400,
        });
      }
      return executeAction<VoiceList>(
        'listElevenLabsVoices',
        async () => {
          const voicesData = await listVoices(apiKey);
          return { success: true, data: voicesData };
        },
        { serviceName: 'ElevenLabsService' }
      );
    },
    description: 'List available ElevenLabs voices',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
});
