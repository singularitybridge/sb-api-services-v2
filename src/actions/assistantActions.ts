import { Assistant } from '../models/Assistant';
import { Session } from '../models/Session';
import { publishMessage } from '../services/pusher.service';
import { ActionContext, FunctionFactory } from '../integrations/actions/types';

export const createAssistantActions = (context: ActionContext): FunctionFactory => ({
  getAssistants: {
    description: 'Get a list of all assistants for the current user\'s company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return {
            success: false,
            description: 'Invalid session',
          };
        }
        const assistants = await Assistant.find(
          { companyId: session.companyId },
          { _id: 1, name: 1, description: 1 }
        );
        return {
          success: true,
          description: 'Assistants retrieved successfully',
          data: assistants,
        };
      } catch (error) {
        console.error('Error getting assistants:', error);
        return {
          success: false,
          description: 'Failed to retrieve assistants',
        };
      }
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
      try {
        const assistant = await Assistant.findById(args._id);
        if (!assistant) {
          return {
            success: false,
            description: 'Assistant not found',
          };
        }
        publishMessage(`sb-${context.sessionId}`, 'setAssistant', { _id: args._id });
        return {
          success: true,
          description: `Assistant set to ${assistant.name} (ID: ${args._id})`,
        };
      } catch (error) {
        console.error('Error setting assistant:', error);
        return {
          success: false,
          description: 'Failed to set assistant',
        };
      }
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
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return {
            success: false,
            description: 'Invalid session',
          };
        }

        const newAssistant = new Assistant({
          name: args.name,
          description: args.description,
          prompt: args.prompt,
          companyId: session.companyId,
        });

        await newAssistant.save();

        publishMessage(`sb-${context.sessionId}`, 'createNewAssistant', {
          _id: newAssistant._id,
          name: newAssistant.name,
          description: newAssistant.description,
        });

        return {
          success: true,
          description: 'New assistant created successfully',
          data: {
            _id: newAssistant._id,
            name: newAssistant.name,
            description: newAssistant.description,
          },
        };
      } catch (error) {
        console.error('Error creating new assistant:', error);
        return {
          success: false,
          description: 'Failed to create new assistant',
        };
      }
    },
  },
});
