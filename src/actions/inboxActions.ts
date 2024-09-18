import { addMessageToInbox, getInboxMessages, updateInboxMessageStatus } from '../services/inbox.service';
import { FunctionFactory, ActionContext } from './types';

// Extend the ActionContext to include companyId if it's not already there
interface ExtendedActionContext extends ActionContext {
  companyId: string;
}

export const createInboxActions = (context: ExtendedActionContext): FunctionFactory => ({
  sendMessageToInbox: {
    description: 'Send a message to the inbox for human review or response',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the inbox',
        },
        type: {
          type: 'string',
          enum: ['human_agent_request', 'human_agent_response', 'notification'],
          description: 'The type of the inbox message',
          default: 'human_agent_request',
        },
      },
      required: ['message'],
    },
    function: async (args: { message: string; type?: 'human_agent_request' | 'human_agent_response' | 'notification' }) => {
      try {
        await addMessageToInbox({
          sessionId: context.sessionId,
          message: args.message,
          type: args.type || 'human_agent_request',
          companyId: context.companyId,
        });
        console.log(`Message sent to inbox: ${args.message}, sessionId: ${context.sessionId}, companyId: ${context.companyId}`);
        return {
          success: true,
          description: 'Message sent to inbox successfully',
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

  getInboxMessages: {
    description: 'Retrieve inbox messages for the company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const messages = await getInboxMessages(context.companyId);
        return {
          success: true,
          description: 'Inbox messages retrieved successfully',
          data: messages,
        };
      } catch (error) {
        console.error('Error retrieving inbox messages:', error);
        return {
          success: false,
          description: 'Failed to retrieve inbox messages',
        };
      }
    },
  },

  updateInboxMessageStatus: {
    description: 'Update the status of an inbox message',
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the inbox message to update',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'closed'],
          description: 'The new status of the inbox message',
        },
      },
      required: ['messageId', 'status'],
    },
    function: async (args: { messageId: string; status: 'open' | 'in_progress' | 'closed' }) => {
      try {
        const updatedMessage = await updateInboxMessageStatus(args.messageId, args.status);
        if (updatedMessage) {
          return {
            success: true,
            description: `Inbox message status updated to ${args.status}`,
            data: updatedMessage,
          };
        } else {
          return {
            success: false,
            description: 'Inbox message not found',
          };
        }
      } catch (error) {
        console.error('Error updating inbox message status:', error);
        return {
          success: false,
          description: 'Failed to update inbox message status',
        };
      }
    },
  },
});