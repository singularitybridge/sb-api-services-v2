import Agenda, { Job } from 'agenda';
import { ObjectId } from 'mongodb';

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
    const jobs = await agendaClient.jobs();
    return jobs;
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

export { agendaClient };