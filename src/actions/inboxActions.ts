import { addMessageToInbox } from '../services/inbox.service';
import { FunctionFactory, ActionContext } from './types';

export const createInboxActions = (context: ActionContext): FunctionFactory => ({
  sendMessageToInbox: {
    description: 'Send a message to the inbox',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the inbox',
        },
      },
      required: ['message'],
    },
    function: async (args: { message: string }) => {
      try {
        await addMessageToInbox({
          sessionId: context.sessionId,
          message: args.message,
          type: 'human_agent_request',
        });
        console.log(`Message sent to inbox: ${args.message}, sessionId: ${context.sessionId}`);
        return {
          success: true,
          description: 'Message sent to inbox',
        };
      } catch (error) {
        console.error('Error sending message to inbox:', error);
        if ((error as any).name === 'CastError' && (error as any).path === '_id') {
          return {
            success: false,
            description: 'Invalid session ID. Please contact support.',
          };
        }
        return {
          success: false,
          description: 'Failed to send message to inbox',
        };
      }
    },
  },
});