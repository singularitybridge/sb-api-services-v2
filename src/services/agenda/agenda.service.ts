import Agenda, { Job } from 'agenda';
import { handleVoiceRecordingRequest } from '../twilio/voice.service';

const agendaClient = new Agenda({
  db: { address: 'mongodb://127.0.0.1/agenda' },
});

export const startAgenda = async () => {
  await agendaClient.start();
  console.log('Agenda started');
};

agendaClient.define('processVoiceRecording', async (job: Job) => {

  console.log('job started' ,job.attrs._id, job.attrs.data);


  const { CallSid, CallStatus, From, To, RecordingUrl } = job.attrs.data;
  const response = await handleVoiceRecordingRequest(From, To, RecordingUrl);

  job.attrs.data.result = response;
  await job.save();
});


export { agendaClient };
