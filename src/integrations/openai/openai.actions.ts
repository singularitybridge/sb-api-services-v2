import { ActionContext, FunctionFactory } from '../actions/types';
import { generateSpeech, transcribeAudioWhisperFromURL, getO1CompletionResponse } from './openai.service';

interface GenerateSpeechArgs {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  textLimit?: number;
}

interface TranscribeAudioArgs {
  audioUrl: string;
  language?: string;
}

interface AskO1ModelArgs {
  question: string;
  model: 'o1-preview' | 'o1-mini';
}

export const createOpenAiActions = (context: ActionContext): FunctionFactory => ({
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
      additionalProperties: false,
    },
    function: async (args: GenerateSpeechArgs) => {
      console.log('generateOpenAiSpeech called with arguments:', JSON.stringify(args, null, 2));

      const { text, voice = 'alloy', model = 'tts-1-hd', textLimit = 256 } = args;

      try {
        console.log('generateOpenAiSpeech: Calling generateSpeech service');
        const audioUrl = await generateSpeech(context.companyId, text, voice, model, textLimit);
        return { audioUrl };
      } catch (error) {
        console.error('generateOpenAiSpeech: Error generating speech', error);
        return {
          error: 'Speech generation failed',
          message: 'Failed to generate speech using OpenAI API.',
        };
      }
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
          description: 'The language of the audio file (optional)',
        },
      },
      required: ['audioUrl'],
      additionalProperties: false,
    },
    function: async (args: TranscribeAudioArgs) => {
      console.log('transcribeAudioWhisperFromURL called with arguments:', JSON.stringify(args, null, 2));

      const { audioUrl, language } = args;

      try {
        console.log('transcribeAudioWhisperFromURL: Calling transcribeAudioWhisperFromURL service');
        const transcription = await transcribeAudioWhisperFromURL(context.companyId, audioUrl, language);
        return { transcription };
      } catch (error) {
        console.error('transcribeAudioWhisperFromURL: Error transcribing audio', error);
        return {
          error: 'Transcription failed',
          message: 'Failed to transcribe audio using OpenAI Whisper API.',
        };
      }
    },
  },
  askO1Model: {
    description: 'Ask a question to the OpenAI o1 models (o1-preview or o1-mini)',
    strict: true,
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
      additionalProperties: false,
    },
    function: async (args: AskO1ModelArgs) => {
      console.log('askO1Model called with arguments:', JSON.stringify(args, null, 2));

      const { question, model } = args;

      try {
        console.log('askO1Model: Calling getO1CompletionResponse service');
        const response = await getO1CompletionResponse(context.companyId, question, model, 2048);
        return { response };
      } catch (error) {
        console.error('askO1Model: Error getting response from o1 model', error);
        return {
          error: 'Model query failed',
          message: 'Failed to get response from OpenAI o1 model.',
        };
      }
    },
  },
});
