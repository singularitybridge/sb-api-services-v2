import { ActionContext, FunctionFactory } from '../actions/types';
import { scheduleJob, getJobs, getJob } from './agenda.service';

const createAgendaActions = (context: ActionContext): FunctionFactory => ({
  scheduleMessage: {
    description: 'Schedule a message to be sent to an ai agent at a specified time.',
    parameters: {
      type: 'object',
      properties: {
        message: { 
          type: 'string',
          description: 'The message to be scheduled',
        },
        scheduledTime: { 
          type: 'string',
          description: 'The time to schedule the message. Can use phrases like "in 5 minutes", "in 2 hours", "every 1 hour", "every 2 days", or exact dates and times like "2023-09-15 14:30" or "September 15, 2023 2:30 PM"',
        },
      },
      required: ['message', 'scheduledTime'],
    },
    function: async ({ message, scheduledTime }: { message: string; scheduledTime: string }) => {
      try {
        await scheduleJob('genericScheduledJob', { sessionId: context.sessionId, message }, scheduledTime);
        return { success: true, message: 'Message scheduled successfully' };
      } catch (error) {
        console.error('Error scheduling message:', error);
        return { success: false, error: 'Failed to schedule message' };
      }
    },
  },
  getJobs: {
    description: 'Retrieve a list of all scheduled jobs.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const jobs = await getJobs();
        return { success: true, jobs };
      } catch (error) {
        console.error('Error retrieving jobs:', error);
        return { success: false, error: 'Failed to retrieve jobs' };
      }
    },
  },
  getJob: {
    description: 'Retrieve details of a specific job by its ID.',
    parameters: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'The ID of the job to retrieve',
        },
      },
      required: ['jobId'],
    },
    function: async ({ jobId }: { jobId: string }) => {
      try {
        const job = await getJob(jobId);
        return { success: true, job };
      } catch (error) {
        console.error('Error retrieving job:', error);
        return { success: false, error: 'Failed to retrieve job' };
      }
    },
  },
});

export { createAgendaActions };