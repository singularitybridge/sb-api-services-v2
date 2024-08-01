import { addMessageToInbox } from '../services/inbox.service';
import { FunctionFactory } from './types';

export const inboxActions: FunctionFactory = {
  sendMessageToInbox: {
    description: 'Send a message to the inbox',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the current session',
        },
        message: {
          type: 'string',
          description: 'The message to send to the inbox',
        },
      },
      required: ['message'],
    },
    function: async (args: { sessionId?: string; message: string }) => {
      if (!args.sessionId) {
        return {
          success: false,
          description: 'Session ID is not provided. Please ask the user for it.',
        };
      }

      try {
        await addMessageToInbox({
          sessionId: args.sessionId,
          message: args.message,
          type: 'human_agent_request',
        });
        console.log(`Message sent to inbox: ${args.message}, sessionId: ${args.sessionId}`);
        return {
          success: true,
          description: 'Message sent to inbox',
        };
      } catch (error) {
        console.error('Error sending message to inbox:', error);
        if ((error as any).name === 'CastError' && (error as any).path === '_id') {
          return {
            success: false,
            description: 'Invalid session ID. Could you please share your session ID?',
          };
        }
        return {
          success: false,
          description: 'Failed to send message to inbox',
        };
      }
    },
  },
};