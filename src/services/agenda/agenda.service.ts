import Agenda, { Job } from 'agenda';
import { handleVoiceRecordingRequest } from '../twilio/voice.service';
import { ObjectId } from 'mongodb';
import { sendMessageToAgent } from '../assistant.service';
import { Session } from '../../models/Session';

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
  }
}

export const getJob = async (jobId: string) => {
  try {
    const job = await agendaClient.jobs({ _id: new ObjectId(jobId) });
    return job;
  } catch (error) {
    console.error('Error getting job:', error);
  }
}

agendaClient.define('processVoiceRecording', async (job: Job, done) => {
  try {
    console.log('job started', job.attrs._id, job.attrs.data);
    const { CallStatus, From, To, RecordingUrl } = job.attrs.data;
    // add handling for api key
    const response = await handleVoiceRecordingRequest('api-key', From, To, RecordingUrl);
    job.attrs.data.result = response;
    await job.save();
    done();
  } catch (error) {
    console.error('Error processing voice recording:', error);
    done();
  }
});

// Updated job definition for scheduled messages
agendaClient.define('sendScheduledMessage', async (job: Job, done) => {
  try {
    console.log('Scheduled message job started', job.attrs._id, job.attrs.data);
    const { sessionId, message } = job.attrs.data;
    await sendMessageToAgent(sessionId, message);
    console.log('Scheduled message sent successfully');
    done();
  } catch (error) {
    console.error('Error sending scheduled message:', error);
    done();
  }
});

// Updated function to schedule a message with string scheduling
export const scheduleMessage = async (
  sessionId: string,
  message: string,
  scheduledTime: string
) => {
  try {
    await agendaClient.schedule(scheduledTime, 'sendScheduledMessage', {
      sessionId,
      message,
    });
    console.log('Message scheduled successfully');
  } catch (error) {
    console.error('Error scheduling message:', error);
    throw error;
  }
};

export { agendaClient };
