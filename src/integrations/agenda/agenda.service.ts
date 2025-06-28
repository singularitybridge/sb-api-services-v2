import Agenda, { Job } from 'agenda';
import { ObjectId } from 'mongodb';
import { toZonedTime, format } from 'date-fns-tz';
import { sendMessageToAgent } from '../../services/assistant.service';
import { ApiKeyService } from '../../services/apiKey.service';

let agendaClient: Agenda | null = null;

if (process.env.MONGODB_URI) {
  agendaClient = new Agenda({
    db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' }, // Connect to the DB specified in MONGODB_URI and use 'agendaJobs' collection
  });
}

export const startAgenda = async () => {
  if (agendaClient) {
    try {
      await agendaClient.start();
      console.log('Agenda started');

      // Schedule API key cleanup job to run daily at 2 AM
      await agendaClient.every('0 2 * * *', 'cleanupExpiredApiKeys');
      console.log('Scheduled daily API key cleanup job');
    } catch (error) {
      console.error('Failed to start Agenda:', error);
      agendaClient = null; // Set to null if it fails to start
    }
  } else {
    console.log('Agenda not configured (MONGODB_URI not set)');
  }
};

export const rerunJob = async (jobId: string) => {
  if (!agendaClient) {
    console.log('Agenda client not initialized. Cannot re-run job.');
    return;
  }
  try {
    const job = await agendaClient.jobs({ _id: new ObjectId(jobId) });

    if (job.length === 0) {
      console.log('Job not found');
      return;
    }

    await job[0].schedule(new Date());
    await job[0].save();

    console.log(`Job ${jobId} re-scheduled to run immediately`);
  } catch (error) {
    console.error('Error re-running job:', error);
  }
};

export const getJobs = async () => {
  if (!agendaClient) {
    console.log('Agenda client not initialized. Cannot get jobs.');
    return [];
  }
  try {
    const jobs = await agendaClient.jobs({
      nextRunAt: { $ne: null },
      lastRunAt: null,
    });
    const israelTimeZone = 'Asia/Jerusalem';

    return jobs.map((job) => ({
      ...job.attrs,
      nextRunAt: job.attrs.nextRunAt
        ? format(
            toZonedTime(job.attrs.nextRunAt, israelTimeZone),
            'yyyy-MM-dd HH:mm:ss zzz',
            { timeZone: israelTimeZone },
          )
        : null,
    }));
  } catch (error) {
    console.error('Error getting jobs:', error);
    throw error;
  }
};

export const getJob = async (jobId: string) => {
  if (!agendaClient) {
    console.log('Agenda client not initialized. Cannot get job.');
    return null;
  }
  try {
    const job = await agendaClient.jobs({ _id: new ObjectId(jobId) });
    return job;
  } catch (error) {
    console.error('Error getting job:', error);
    throw error;
  }
};

if (agendaClient) {
  agendaClient.define('genericScheduledJob', async (job: Job) => {
    try {
      console.log(
        'Generic scheduled job started',
        job.attrs._id,
        job.attrs.data,
      );
      // Perform the scheduled task here
      // This could be calling an API, running a function, etc.
      console.log('Generic scheduled job completed');
    } catch (error) {
      console.error('Error executing generic scheduled job:', error);
      throw error;
    }
  });

  agendaClient.define('sendScheduledMessage', async (job: Job) => {
    try {
      console.log(
        'Scheduled message job started',
        job.attrs._id,
        job.attrs.data,
      );
      const { sessionId, message } = job.attrs.data;
      await sendMessageToAgent(sessionId, message);
      console.log('Scheduled message sent successfully');
    } catch (error) {
      console.error('Error sending scheduled message:', error);
      throw error;
    }
  });

  agendaClient.define('cleanupExpiredApiKeys', async (job: Job) => {
    try {
      console.log('API key cleanup job started');
      const deletedCount = await ApiKeyService.cleanupExpiredKeys();
      console.log(
        `API key cleanup completed. Deleted ${deletedCount} expired keys`,
      );
    } catch (error) {
      console.error('Error cleaning up expired API keys:', error);
      throw error;
    }
  });
}

export const scheduleJob = async (
  jobName: string,
  data: any,
  scheduledTime: string,
): Promise<Job | null> => {
  if (!agendaClient) {
    console.log('Agenda client not initialized. Cannot schedule job.');
    return null;
  }
  try {
    const job = agendaClient.create(jobName, data);
    await job.schedule(scheduledTime).save();
    console.log(`Job ${jobName} scheduled successfully for ${scheduledTime}`);
    return job;
  } catch (error) {
    console.error('Error scheduling job:', error);
    throw error;
  }
};

export const scheduleMessage = async (
  sessionId: string,
  message: string,
  scheduledTime: string,
): Promise<Job | null> => {
  return scheduleJob(
    'sendScheduledMessage',
    { sessionId, message },
    scheduledTime,
  );
};

export { agendaClient };
