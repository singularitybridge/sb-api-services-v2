import { ActionContext, FunctionFactory } from '../integrations/actions/types';
import { scheduleMessage } from '../services/agenda/agenda.service';

export const createAgendaActions = (context: ActionContext): FunctionFactory => ({
  scheduleMessage: {
    description: 'Schedule a message to be sent to a chat session at a specified time.',
    parameters: {
      type: 'object',
      properties: {
        message: { 
          type: 'string',
          description: 'The message to be sent to the chat session',
        },
        scheduledTime: { 
          type: 'string',
          description: 'this field can use phrases like "in 5 minutes" or "in 2 hours" to schedule tasks relative to the current time. For repeating tasks, you can use formats like "every 1 hour" or "every 2 days. You can provide exact dates and times in various formats, such as "2023-09-15 14:30" or "September 15, 2023 2:30 PM"',
        },
      },
      required: ['message', 'scheduledTime'],
    },
    function: async ({ message, scheduledTime }: { message: string; scheduledTime: string }) => {
      try {
        await scheduleMessage(context.sessionId, message, scheduledTime);
        return { success: true, message: 'Message scheduled successfully' };
      } catch (error) {
        console.error('Error scheduling message:', error);
        return { success: false, error: 'Failed to schedule message' };
      }
    },
  },
});