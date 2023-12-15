import express, { NextFunction } from 'express';
import {
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

  const { response, callActive } = await handleVoiceRequest(
    firstTime !== 'false',
    CallStatus,
    From,
    To,
  );

  res.type('text/xml');
  res.send(response);
});

twilioVoiceRouter.post('/wait', async (req, res) => {

  const jobId = req.query.job as string;
  console.log(`wait, jobId: ${jobId}`);

  // Retrieve the job using the job ID
  const jobs = await agendaClient.jobs({ _id: new ObjectId(jobId) });

  console.log('jobs found', jobs[0].attrs.data);

  if (jobs && jobs.length > 0) {
    const job = jobs[0];
    // Using type assertion to access properties
    const isJobFinished = (job.attrs as any).lastFinishedAt;
    const jobData = (job.attrs as any).data;

    if (isJobFinished) {
      console.log('job finished', jobData.result);
      const response = jobData.result;

      res.type('text/xml');
      res.send(response);
    } else {
      // Wait and play tick sound
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const twiml = new VoiceResponse();
      twiml.play(waitingSoundTick);
      twiml.redirect(`/twilio/voice/wait?job=${jobId}`);

      res.type('text/xml'); 
      res.send(twiml.toString());
    }
  } else {
    // Handle case where the job is not found
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
