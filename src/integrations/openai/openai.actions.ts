import { ActionContext, FunctionFactory } from '../actions/types';
import { generateSpeech } from '../../services/oai.speech.service';
import { transcribeAudioWhisperFromURL } from '../../services/speech.recognition.service';
import { getO1CompletionResponse } from '../../services/oai.completion.service';
import { getApiKey } from '../../services/api.key.service';
import { getFileContent } from '../code_indexer/code_indexer.service';
import OpenAI from 'openai';
import { executeAction } from '../actions/executor';
import { ActionExecutionError, ActionValidationError } from '../../utils/actionErrors';

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type OpenAIModel = 'tts-1' | 'tts-1-hd';
type O1Model = 'o1-preview' | 'o1-mini';

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

interface O1Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AskO1ModelArgs {
  question: string;
  model: O1Model;
}

interface AskO1ModelWithFilesArgs {
  question: string;
  model: O1Model;
  filePaths: string[];
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
        filename: {
          type: 'string',
          description: 'Optional custom filename for the generated audio',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    function: async ({ text, voice = 'alloy', model = 'tts-1-hd', textLimit = 256, filename }: GenerateSpeechArgs) => {
      const actionName = 'generateOpenAiSpeech';
      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError('OpenAI API key is missing for this company.', { actionName, statusCode: 400 });
      }

      return executeAction<{ audioUrl: string }>(
        actionName,
        async () => {
          const audioUrl = await generateSpeech(apiKey, text, voice, model, textLimit, filename);
          return { success: true, data: { audioUrl } };
        },
        { serviceName: 'OpenAIService' }
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
          description: 'The language of the audio file (optional), e.g., he, en, es, fr, de, it, nl, pt, ru, zh',
        },
      },
      required: ['audioUrl'],
      additionalProperties: false,
    },
    function: async ({ audioUrl, language }: TranscribeAudioArgs) => {
      const actionName = 'transcribeAudioWhisperFromURL';
      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError('OpenAI API key is missing for this company.', { actionName, statusCode: 400 });
      }

      return executeAction<{ transcription: string }>(
        actionName,
        async () => {
          const transcription = await transcribeAudioWhisperFromURL(apiKey, audioUrl, language);
          return { success: true, data: { transcription } };
        },
        { serviceName: 'OpenAIService' }
      );
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
    function: async ({ question, model }: AskO1ModelArgs) => {
      const actionName = 'askO1Model';
      const allowedModels: O1Model[] = ['o1-preview', 'o1-mini'];
      if (!allowedModels.includes(model)) {
        throw new ActionValidationError(`Invalid model specified. Allowed models are ${allowedModels.join(', ')}`, {
          fieldErrors: { model: `Invalid model. Allowed: ${allowedModels.join(', ')}` },
        });
      }

      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError('OpenAI API key is missing for this company.', { actionName, statusCode: 400 });
      }

      return executeAction<{ response: string }>(
        actionName,
        async () => {
          const messages: O1Message[] = [{ role: 'user', content: question }];
          const responseText = await getO1CompletionResponse(apiKey, messages, model);
          return { success: true, data: { response: responseText } };
        },
        { serviceName: 'OpenAIService' }
      );
    },
  },
  askO1ModelWithFiles: {
    description: 'Ask a question to the OpenAI O1 models with additional code files as context',
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
          description: 'The OpenAI O1 model to use',
        },
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file paths to include as context',
        },
      },
      required: ['question', 'model', 'filePaths'],
      additionalProperties: false,
    },
    function: async ({ question, model, filePaths }: AskO1ModelWithFilesArgs) => {
      const actionName = 'askO1ModelWithFiles';
      const allowedModels: O1Model[] = ['o1-preview', 'o1-mini'];
      if (!allowedModels.includes(model)) {
        throw new ActionValidationError(`Invalid model specified. Allowed models are ${allowedModels.join(', ')}`, {
          fieldErrors: { model: `Invalid model. Allowed: ${allowedModels.join(', ')}` },
        });
      }

      const apiKey = await getApiKey(context.companyId, 'openai_api_key');
      if (!apiKey) {
        throw new ActionExecutionError('OpenAI API key is missing for this company.', { actionName, statusCode: 400 });
      }

      return executeAction<{ response: string }>(
        actionName,
        async () => {
          let combinedContext = await loadAndProcessFiles(filePaths);
          combinedContext = truncateContextIfNecessary(combinedContext, question);
          const messages: O1Message[] = [{ role: 'user', content: `${combinedContext}\n\nQuestion: ${question}` }];
          const responseText = await getO1CompletionResponse(apiKey, messages, model);
          return { success: true, data: { response: responseText } };
        },
        { serviceName: 'OpenAIService' }
      );
    },
  },
});

async function loadAndProcessFiles(filePaths: string[]): Promise<string> {
  let combinedContext = '';

  for (const filePath of filePaths) {
    try {
      const content = await getFileContent(filePath);
      const processedContent = await processFileContent(content, filePath);
      combinedContext += `File: ${filePath}\n${processedContent}\n\n`;
    } catch (error) {
      console.error(`Error loading file ${filePath}:`, error);
      combinedContext += `File: ${filePath}\nError loading file content.\n\n`;
    }
  }

  return combinedContext;
}

async function processFileContent(content: string, filePath: string): Promise<string> {
  // For now, we'll return the content as is
  // In the future, you might want to implement summarization or preprocessing here
  return content;
}

function truncateContextIfNecessary(context: string, question: string): string {
  const MAX_TOKENS = 4096; // Adjust based on the model's max tokens
  const ESTIMATED_TOKENS_PER_CHAR = 0.5; // Rough estimate

  const totalEstimatedTokens = (context.length + question.length) * ESTIMATED_TOKENS_PER_CHAR;

  if (totalEstimatedTokens > MAX_TOKENS) {
    const allowedContextLength = (MAX_TOKENS - question.length * ESTIMATED_TOKENS_PER_CHAR) / ESTIMATED_TOKENS_PER_CHAR;
    context = context.slice(-Math.floor(allowedContextLength));
  }

  return context;
}
