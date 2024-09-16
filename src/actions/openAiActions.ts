import { ActionContext, FunctionFactory } from './types';
import { generateSpeech } from '../services/oai.speech.service';
import { getApiKey } from '../services/api.key.service';
import { transcribeAudioWhisperFromURL } from '../services/speech.recognition.service';
import { getO1CompletionResponse } from '../services/oai.completion.service';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type OpenAIModel = 'tts-1' | 'tts-1-hd';

export const createOpenAiActions = (context: ActionContext): FunctionFactory => ({
  generateOpenAiSpeech: {
    function: async ({
      text,
      voice = 'alloy',
      model = 'tts-1-hd',
      textLimit = 256,
    }: {
      text: string;
      voice?: OpenAIVoice;
      model?: OpenAIModel;
      textLimit?: number;
    }) => {
      try {
        const apiKey = await getApiKey(context.companyId, 'openai');
        if (!apiKey) {
          return { error: 'OpenAI API key is missing' };
        }
        const audioUrl = await generateSpeech(apiKey, text, voice, model, textLimit);
        return { audioUrl };
      } catch (error) {
        // Console.error removed to prevent output during tests
        return { error: 'Failed to generate speech with OpenAI' };
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
          return { error: 'OpenAI API key is missing' };
        }
        const transcription = await transcribeAudioWhisperFromURL(apiKey, audioUrl, language);
        return { transcription };
      } catch (error) {
        // Console.error removed to prevent output during tests
        return { error: 'Failed to transcribe audio with OpenAI Whisper' };
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
  askO1Model: {
    function: async ({ question, model }: { question: string; model: string }) => {
      try {
        const apiKey = await getApiKey(context.companyId, 'openai');
        if (!apiKey) {
          return { error: 'OpenAI API key is missing' };
        }
        const allowedModels = ['o1-preview', 'o1-mini'];
        if (!allowedModels.includes(model)) {
          return { error: `Invalid model specified. Allowed models are ${allowedModels.join(', ')}` };
        }
        const responseText = await getO1CompletionResponse(apiKey, question, model, 2048);
        return { response: responseText };
      } catch (error) {
        console.error('Error in askO1Model action:', error);
        return { error: 'Failed to get response from OpenAI o1 model' };
      }
    },
    description: 'Ask a question to the OpenAI o1 models (o1-preview or o1-mini)',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question or input to send to the model',
        },
        model: {
          type: 'string',
          enum: ['o1-preview', 'o1-mini'],
          description: 'The OpenAI o1 model to use',
        },
      },
      required: ['question', 'model'],
    },
  },
});
