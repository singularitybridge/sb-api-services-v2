import Agenda, { Job } from 'agenda';
import { ObjectId } from 'mongodb';
import { toZonedTime, format } from 'date-fns-tz';
import { sendMessageToAgent } from '../../services/assistant.service';

const agendaClient = new Agenda({
  db: { address: `${process.env.MONGODB_URI}/agenda` },
});

export const startAgenda = async () => {
  await agendaClient.start();
  console.log('Agenda started');
};

export const rerunJob = async (jobId: string) => {
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
  try {
    const jobs = await agendaClient.jobs({ nextRunAt: { $ne: null }, lastRunAt: null });
    const israelTimeZone = 'Asia/Jerusalem';
    
    return jobs.map(job => ({
      ...job.attrs,
      nextRunAt: job.attrs.nextRunAt 
        ? format(toZonedTime(job.attrs.nextRunAt, israelTimeZone), 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: israelTimeZone }) 
        : null,
    }));
  } catch (error) {
    console.error('Error getting jobs:', error);
    throw error;
  }
};

export const getJob = async (jobId: string) => {
  try {
    const job = await agendaClient.jobs({ _id: new ObjectId(jobId) });
    return job;
  } catch (error) {
    console.error('Error getting job:', error);
    throw error;
  }
};

agendaClient.define('genericScheduledJob', async (job: Job) => {
  try {
    console.log('Generic scheduled job started', job.attrs._id, job.attrs.data);
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
    console.log('Scheduled message job started', job.attrs._id, job.attrs.data);
    const { sessionId, message } = job.attrs.data;
    await sendMessageToAgent(sessionId, message);
    console.log('Scheduled message sent successfully');
  } catch (error) {
    console.error('Error sending scheduled message:', error);
    throw error;
  }
});

export const scheduleJob = async (
  jobName: string,
  data: any,
  scheduledTime: string
): Promise<Job> => {
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
  scheduledTime: string
): Promise<Job> => {
  return scheduleJob('sendScheduledMessage', { sessionId, message }, scheduledTime);
};

export { agendaClient };