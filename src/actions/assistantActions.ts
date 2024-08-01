import { Assistant } from '../models/Assistant';
import { publishMessage } from '../services/pusher.service';
import { FunctionFactory } from './types';

export const assistantActions: FunctionFactory = {
  getAssistants: {
    description: 'Get a list of all assistants',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      const assistants = await Assistant.find({}, { _id: 1, name: 1, description: 1 });
      return assistants;
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
    function: async (args: { _id: string }) => {
      console.log('called setAssistant with args: ', args);
      publishMessage('sb', 'setAssistant', { _id: args._id });
      return {
        success: true,
        description: `set assistant to ${args._id}`,
      };
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
    function: async (args: { name: string; description: string; prompt: string }) => {
      console.log('called createNewAssistant with args: ', args);
      publishMessage('sb', 'createNewAssistant', args);
      return {
        success: true,
        description: 'created new assistant',
      };
    },
  },
};