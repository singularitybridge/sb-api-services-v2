import { ActionContext, FunctionFactory } from '../actions/types';
import { getAssistants, setAssistant, createNewAssistant } from './assistant.service';

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
      },
      required: ['name', 'description', 'prompt'],
    },
    function: async ({ name, description, prompt }: { name: string; description: string; prompt: string }) => {
      return await createNewAssistant(context.sessionId, name, description, prompt);
    },
  },
});

export { createAssistantActions };