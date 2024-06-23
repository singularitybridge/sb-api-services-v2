import express, { NextFunction } from 'express';
import {
  handleVoiceCallEnded,
  handleVoiceRecordingRequest,
  handleVoiceRequest,
} from '../../services/twilio/voice.service';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { agendaClient } from '../../services/agenda/agenda.service';
import { ObjectId } from 'mongodb';

const twilioVoiceRouter = express.Router();
const waitingSoundTick =
  'https://red-labradoodle-6369.twil.io/assets/tick1.wav';

twilioVoiceRouter.post('/', async (req, res) => {
  const { firstTime } = req.query;
  const { CallStatus, From, To } = req.body;
  const apiKey = req.headers['openai-api-key'] as string;
  
  const { response, callActive } = await handleVoiceRequest(
    apiKey,
    firstTime !== 'false',
    CallStatus,
    From,
    To,
  );

  res.type('text/xml');
  res.send(response);
});

twilioVoiceRouter.post('/status', async (req, res) => {

  const { CallStatus, From, To } = req.body;
  const apiKey = req.headers['openai-api-key'] as string;

  if (CallStatus === 'completed') {
    await handleVoiceCallEnded(apiKey, From, To);
  }
  
  res.status(200).send('OK');
  
});

twilioVoiceRouter.post('/wait', async (req, res) => {
  const jobId = req.query.job as string;
  console.log(`wait, jobId: ${jobId}`);
  const jobs = await agendaClient.jobs({ _id: new ObjectId(jobId) });

  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    const jobData = job.attrs.data;

    if (jobData.result) {
      console.log('job finished', jobData.result);
      const response = jobData.result;
      res.type('text/xml');
      res.send(response);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const twiml = new VoiceResponse();
      twiml.play(waitingSoundTick);
      twiml.redirect(`/twilio/voice/wait?job=${jobId}`);
      res.type('text/xml'); 
      res.send(twiml.toString());
    }
  } else {
    res.status(404).send('Job not found');
  }
});





twilioVoiceRouter.post('/recording', async (req, res) => {

  const { CallSid, CallStatus, From, To, RecordingUrl } = req.body; 
  const job = await agendaClient.now('processVoiceRecording', { CallSid, CallStatus, From, To, RecordingUrl });
  const twiml = new VoiceResponse();
  
  twiml.redirect(`/twilio/voice/wait?job=${job.attrs._id}`);
  console.log(`record, redirect to /twilio/voice/wait?job=${job.attrs._id}`);
  res.type('text/xml');
  res.send(twiml.toString());


});


export { twilioVoiceRouter };
