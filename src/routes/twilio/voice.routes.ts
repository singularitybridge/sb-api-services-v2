import express, { NextFunction } from 'express';
import {
  handleVoiceRecordingRequest,
  handleVoiceRequest,
} from '../../services/twilio/voice.service';

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

twilioVoiceRouter.post('/recording', async (req, res) => {
  const { CallSid, CallStatus, From, To, RecordingUrl } = req.body;
  const response = await handleVoiceRecordingRequest(From, To, RecordingUrl);

  res.type('text/xml');
  res.send(response);
});

export { twilioVoiceRouter };
