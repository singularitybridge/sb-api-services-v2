/// file_path: /src/actions/inboxActions.ts

import { addMessageToInbox } from '../services/inbox.service';
import { FunctionFactory, ActionContext } from './types';

// Extend the ActionContext to include companyId if it's not already there
interface ExtendedActionContext extends ActionContext {
  companyId: string;
}

export const createInboxActions = (context: ExtendedActionContext): FunctionFactory => ({
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
          companyId: context.companyId, // Add the companyId here
        });
        console.log(`Message sent to inbox: ${args.message}, sessionId: ${context.sessionId}, companyId: ${context.companyId}`);
        return {
          success: true,
          description: 'Message sent to inbox',
        };
      } catch (error) {
        console.error('Error sending message to inbox:', error);
        if ((error as any).name === 'CastError' && (error as any).path === '_id') {
          return {
            success: false,
            description: 'Invalid session ID or company ID. Please contact support.',
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