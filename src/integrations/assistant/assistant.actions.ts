import { ActionContext, FunctionFactory } from '../actions/types';
import { 
  getAssistants, 
  setAssistant, 
  createNewAssistant, 
  getCurrentAssistant,
  updateAssistantById,
  askAnotherAssistant,
  getTeams,
  getAssistantsByTeam
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

  updateAssistantById: {
    description: 'Update a specific assistant by ID with new information. Only provided fields (name, description, llmModel, llmProvider, llmPrompt) will be updated.',
    parameters: {
      type: 'object',
      properties: {
        assistantId: { type: 'string', description: 'The ID of the assistant to update' },
        name: { type: 'string', description: 'New name (title) for the assistant' },
        description: { type: 'string', description: 'New description for the assistant' },
        llmModel: { type: 'string', description: 'New LLM model identifier (e.g., gpt-4o-mini)' },
        llmProvider: { type: 'string', enum: ['openai', 'google', 'anthropic'], description: 'New LLM provider' },
        llmPrompt: { type: 'string', description: 'New LLM prompt for the assistant' },
      },
      required: ['assistantId'], // assistantId is now required
      additionalProperties: false,
    },
    function: async (params: {
      assistantId: string; // Added assistantId
      name?: string;
      description?: string;
      llmModel?: string;
      llmProvider?: 'openai' | 'google' | 'anthropic';
      llmPrompt?: string;
    }) => {
      const { assistantId, ...updateData } = params;
      return await updateAssistantById(context.sessionId, assistantId, updateData);
    },
  },

  askAssistant: {
    description: 'Ask another assistant to handle a specific task and return the response. Useful for delegating specialized tasks to expert assistants.',
    parameters: {
      type: 'object',
      properties: {
        assistantId: {
          type: 'string',
          description: 'The ID of the target assistant to ask',
        },
        task: {
          type: 'string',
          description: 'The task or prompt to send to the target assistant',
        },
      },
      required: ['assistantId', 'task'],
      additionalProperties: false,
    },
    function: async ({ assistantId, task }: { assistantId: string; task: string }) => {
      if (context.isStateless) {
        return await askAnotherAssistant(context.sessionId, assistantId, task, context.companyId, context.userId);
      }
      return await askAnotherAssistant(context.sessionId, assistantId, task);
    },
  },

  getTeams: {
    description: 'Get a list of all teams for the current user\'s company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const teams = await getTeams(context.sessionId);
        return { success: true, data: teams }; 
      } catch (error) {
        throw error; // Re-throw to be caught by the executor
      }
    },
  },

  getAssistantsByTeam: {
    description: 'Get a list of assistants for a specific team',
    parameters: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          description: 'The ID of the team',
        },
        lean: {
          type: 'boolean',
          description: 'If true, returns a lean representation of assistants. Defaults to true.',
          default: true,
        }
      },
      required: ['teamId'],
    },
    function: async ({ teamId, lean = true }: { teamId: string, lean?: boolean }) => {
      try {
        const assistants = await getAssistantsByTeam(context.sessionId, teamId, lean);
        return { success: true, data: assistants };
      } catch (error) {
        throw error; // Re-throw to be caught by the executor
      }
    },
  },
});

export { createAssistantActions };
