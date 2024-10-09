import { ActionContext, FunctionFactory } from '../actions/types';
import { getInboxMessages, sendMessageToInbox, updateInboxMessageStatus } from './inbox.service';

export const createInboxActions = (context: ActionContext): FunctionFactory => ({
  sendMessageToInbox: {
    description: 'Send a message to the inbox for human review or response',
    strict: true,
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
      additionalProperties: false,
    },
    function: async (params: { message: string; type?: 'human_agent_request' | 'human_agent_response' | 'notification' }) => {
      try {
        const result = await sendMessageToInbox(context.sessionId, context.companyId, params);
        return result;
      } catch (error) {
        console.error('Error in sendMessageToInbox:', error);
        return { success: false, error: 'Failed to send message to inbox' };
      }
    },
  },

  getInboxMessages: {
    description: 'Retrieve inbox messages for the company',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await getInboxMessages(context.companyId);
        return result;
      } catch (error) {
        console.error('Error in getInboxMessages:', error);
        return { success: false, error: 'Failed to retrieve inbox messages' };
      }
    },
  },

  updateInboxMessageStatus: {
    description: 'Update the status of an inbox message',
    strict: true,
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
      additionalProperties: false,
    },
    function: async (params: { messageId: string; status: 'open' | 'in_progress' | 'closed' }) => {
      try {
        const result = await updateInboxMessageStatus(params.messageId, params.status);
        return result;
      } catch (error) {
        console.error('Error in updateInboxMessageStatus:', error);
        return { success: false, error: 'Failed to update inbox message status' };
      }
    },
  },
});