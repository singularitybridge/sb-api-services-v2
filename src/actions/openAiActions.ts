import { ActionContext, FunctionFactory } from './types';
import { generateSpeech } from '../services/oai.speech.service';
import { getApiKey } from '../services/api.key.service';
import { transcribeAudioWhisperFromURL } from '../services/speech.recognition.service';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type OpenAIModel = 'tts-1' | 'tts-1-hd';

export const createOpenAiActions = (context: ActionContext): FunctionFactory => ({
  generateOpenAiSpeech: {
    function: async ({ text, voice = 'alloy', model = 'tts-1-hd', textLimit = 256 }: { text: string; voice?: OpenAIVoice; model?: OpenAIModel; textLimit?: number }) => {
      try {
        const apiKey = await getApiKey(context.companyId, 'openai');
        if (!apiKey) {
          throw new Error('OpenAI API key is missing');
        }
        const audioUrl = await generateSpeech(apiKey, text, voice, model, textLimit);
        return { audioUrl };
      } catch (error) {
        console.error('Error generating speech with OpenAI:', error);
        throw new Error('Failed to generate speech with OpenAI');
      }
    },
    description: 'Generate speech using OpenAI text-to-speech service',
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
          description: 'The voice to use for speech generation (default: alloy)',
          default: 'alloy',
        },
        model: {
          type: 'string',
          enum: ['tts-1', 'tts-1-hd'],
          description: 'The model to use for speech generation (default: tts-1-hd)',
          default: 'tts-1-hd',
        },
        textLimit: {
          type: 'number',
          description: 'The maximum number of characters allowed in the input text (default: 256)',
          default: 256,
        },
      },
      required: ['text'],
    },
  },
  transcribeAudioWhisperFromURL: {
    function: async ({ audioUrl, language }: { audioUrl: string; language?: string }) => {
      try {
        const apiKey = await getApiKey(context.companyId, 'openai');
        if (!apiKey) {
          throw new Error('OpenAI API key is missing');
        }
        const transcription = await transcribeAudioWhisperFromURL(apiKey, audioUrl, language);
        return { transcription };
      } catch (error) {
        console.error('Error transcribing audio with OpenAI Whisper:', error);
        throw new Error('Failed to transcribe audio with OpenAI Whisper');
      }
    },
    description: 'Transcribe audio from a URL using OpenAI Whisper',
    parameters: {
      type: 'object',
      properties: {
        audioUrl: {
          type: 'string',
          description: 'The URL of the audio file to transcribe',
        },
        language: {
          type: 'string',
          description: 'The language of the audio file (optional)',
        },
      },
      required: ['audioUrl'],
    },
  },
});