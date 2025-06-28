import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  scheduleMessage,
  getJobs as getJobsService,
  getJob as getJobService,
} from './agenda.service';
import { JobAttributesData, Job } from 'agenda';
import { ObjectId } from 'mongodb'; // Keep for potential use if service changes, but attributes will be stringified
import { toZonedTime, format } from 'date-fns-tz';

// Define a more accurate type for the objects returned by getJobs() service
// It's job.attrs with nextRunAt reformatted and _id stringified.
interface SimplifiedAgendaJobAttributes
  extends Omit<JobAttributesData, 'nextRunAt' | '_id'> {
  _id: string; // _id will be stringified
  nextRunAt: string | null;
  [key: string]: any;
}

type ScheduleMessageData = { message: string };
type GetJobsData = SimplifiedAgendaJobAttributes[];
type GetJobData = SimplifiedAgendaJobAttributes | null;

const createAgendaActions = (context: ActionContext): FunctionFactory => ({
  scheduleMessage: {
    description:
      'Schedule a message to be sent to an AI agent at a specified time.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to be scheduled',
        },
        scheduledTime: {
          type: 'string',
          description:
            'The time to schedule the message. Can use phrases like "in 5 minutes", "in 2 hours", "every 1 hour", "every 2 days", or exact dates and times like "2023-09-15 14:30" or "September 15, 2023 2:30 PM"',
        },
      },
      required: ['message', 'scheduledTime'],
    },
    function: async ({
      message,
      scheduledTime,
    }: {
      message: string;
      scheduledTime: string;
    }): Promise<StandardActionResult<ScheduleMessageData>> => {
      try {
        await scheduleMessage(context.sessionId, message, scheduledTime);
        return {
          success: true,
          message: 'Message scheduled successfully.',
          data: { message: 'Message scheduled successfully.' },
        };
      } catch (error) {
        console.error('Error scheduling message:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to schedule message',
        );
      }
    },
  },
  getJobs: {
    description:
      'Retrieve a list of all scheduled jobs that have not been triggered yet. Dates are returned in Israel time zone.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult<GetJobsData>> => {
      try {
        const rawJobsAttrsArray = await getJobsService();

        const processedJobs: GetJobsData = rawJobsAttrsArray.map((attrs) => {
          const jobAttrs = attrs as any; // Cast to any to access _id before it's strictly typed
          return {
            ...jobAttrs,
            _id: jobAttrs._id ? jobAttrs._id.toString() : '', // Ensure _id is string
            // nextRunAt is already formatted by the service
          };
        });

        return {
          success: true,
          message: 'Jobs retrieved successfully.',
          data: processedJobs,
        };
      } catch (error) {
        console.error('Error retrieving jobs:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to retrieve jobs',
        );
      }
    },
  },
  getJob: {
    description:
      'Retrieve details of a specific job by its ID. Dates are returned in Israel time zone.',
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
    function: async ({
      jobId,
    }: {
      jobId: string;
    }): Promise<StandardActionResult<GetJobData>> => {
      try {
        const jobArray = await getJobService(jobId);
        if (!jobArray || jobArray.length === 0) {
          throw new Error(`Job with ID ${jobId} not found.`);
        }
        const jobAttrs = jobArray[0].attrs;
        const israelTimeZone = 'Asia/Jerusalem';

        const simplifiedJob: SimplifiedAgendaJobAttributes = {
          ...jobAttrs,
          _id: jobAttrs._id ? jobAttrs._id.toString() : '',
          nextRunAt: jobAttrs.nextRunAt
            ? format(
                toZonedTime(jobAttrs.nextRunAt, israelTimeZone),
                'yyyy-MM-dd HH:mm:ss zzz',
                { timeZone: israelTimeZone },
              )
            : null,
        };

        return {
          success: true,
          message: 'Job retrieved successfully.',
          data: simplifiedJob,
        };
      } catch (error) {
        console.error(`Error retrieving job ${jobId}:`, error);
        throw new Error(
          error instanceof Error
            ? error.message
            : `Failed to retrieve job ${jobId}`,
        );
      }
    },
  },
});

export { createAgendaActions };
