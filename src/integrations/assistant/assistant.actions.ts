import { ActionContext, FunctionFactory } from '../actions/types';
import { 
  getAssistants, 
  setAssistant, 
  createNewAssistant, 
  getCurrentAssistant,
  updateCurrentAssistant // Added import
} from './assistant.service';
import { IIdentifier } from '../../models/Assistant';

const createAssistantActions = (context: ActionContext): FunctionFactory => ({
  getAssistants: {
    description: 'Get a list of all assistants for the current user\'s company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      return await getAssistants(context.sessionId);
    },
  },

  setAssistant: {
    description: 'Set the current assistant',
    parameters: {
      type: 'object',
      properties: {
        _id: {
          type: 'string',
          description: 'The ID of the assistant to set',
        },
      },
      required: ['_id'],
    },
    function: async ({ _id }: { _id: string }) => {
      return await setAssistant(context.sessionId, _id);
    },
  },

  createNewAssistant: {
    description: 'Create a new assistant',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the new assistant',
        },
        description: {
          type: 'string',
          description: 'A description of the new assistant',
        },
        prompt: {
          type: 'string',
          description: 'The initial prompt for the new assistant',
        },
        language: {
          type: 'string',
          description: 'The language of the assistant, can be he or en',
        },
        voice: {
          type: 'string',
          description: 'The voice of the assistant',
        },
        conversationStarters: {
          type: 'array',
          description: 'Array of conversation starters with title and content',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'The title of the conversation starter',
              },
              value: {
                type: 'string',
                description: 'The content of the conversation starter',
              },
            },
            required: ['key', 'value'],
          },
        },
      },
      required: ['name', 'description', 'prompt', 'language', 'voice'],
    },
    function: async ({ 
      name, 
      description, 
      prompt, 
      language, 
      voice, 
      conversationStarters = []
    }: { 
      name: string; 
      description: string; 
      prompt: string;
      language: string;
      voice: string;
      conversationStarters?: IIdentifier[];
    }) => {
      return await createNewAssistant(
        context.sessionId, 
        name, 
        description, 
        prompt, 
        language, 
        voice, 
        conversationStarters
      );
    },
  },

  getCurrentAssistant: {
    description: "Get the current assistant's information for the session",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      return await getCurrentAssistant(context.sessionId);
    },
  },

  updateCurrentAssistant: {
    description: 'Update the current assistant with new information. Only provided fields (name, description, llmModel, llmProvider, llmPrompt) will be updated.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New name (title) for the assistant' },
        description: { type: 'string', description: 'New description for the assistant' },
        llmModel: { type: 'string', description: 'New LLM model identifier (e.g., gpt-4o-mini)' },
        llmProvider: { type: 'string', enum: ['openai', 'google', 'anthropic'], description: 'New LLM provider' },
        llmPrompt: { type: 'string', description: 'New LLM prompt for the assistant' }, // Added llmPrompt
      },
      required: [], // No fields are strictly required for a partial update
      additionalProperties: false,
    },
    function: async (params: {
      name?: string;
      description?: string;
      llmModel?: string;
      llmProvider?: 'openai' | 'google' | 'anthropic';
      llmPrompt?: string; // Added llmPrompt
    }) => {
      return await updateCurrentAssistant(context.sessionId, params);
    },
  },
});

export { createAssistantActions };
