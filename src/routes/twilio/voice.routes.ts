import express, { NextFunction } from 'express';
import { Twilio } from 'twilio';
import { handleUserInput } from '../../services/assistant.service';
import { Assistant, IAssistant } from '../../models/Assistant';
import { IUser, User } from '../../models/User';
import { ISession, Session } from '../../models/Session';
import {
  createNewThread,
  deleteThread,
} from '../../services/oai.thread.service';
import { generateAudio } from '../../services/11labs.service';
import { transcribeAudioWhisper } from '../../services/speech.recognition.service';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const twilioVoiceRouter = express.Router();
const waitingSoundTick =
  'https://red-labradoodle-6369.twil.io/assets/tick1.wav';

const handleVoiceRequest = async (
  firstTime: boolean,
  callStatus: 'ringing' | 'in-progress' | 'completed',
  from: string,
  to: string,
): Promise<{ callActive: boolean; response: string }> => {
  const twiml = new VoiceResponse();
  const assistant = await Assistant.findOne({ 'identifiers.value': to });
  const user = await User.findOne({ 'identifiers.value': from });

  if (!assistant || !user) {
    twiml.play(
      'https://red-labradoodle-6369.twil.io/assets/agent-not-found.mp3',
    );
    return twiml.toString();
  }

  let session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  if (callStatus === 'completed') {
    if (!session) {
      throw new Error('Session not found');
    }
    deleteThread(session.threadId);
    session.active = false;
    await session.save();

    return {
      callActive: false,
      response: twiml.toString(),
    };
  }

  if (!session) {
    const threadId = await createNewThread();

    session = new Session({
      threadId: threadId,
      userId: user._id,
      assistantId: assistant.assistantId,
      active: true,
    });
    await session.save();
  }

  if (firstTime !== false) {
    const response = await handleUserInput(
      `this is a conversation with ${user.name}, start with greeting the user`,
      session.assistantId,
      session.threadId,
    );
    const limitedResponse = response.substring(0, 1200); // Limit response to 1600 characters

    // generate intro message
    const audioResponse = await generateAudio(limitedResponse);
    twiml.play(audioResponse?.path);
  }

  twiml.record({
    action: '/twilio/voice/recording', // Send the recording to /voice-recording
    method: 'POST',
    maxLength: 20, // Maximum length of recording in seconds
    finishOnKey: '#', // End the recording when the user presses *
    timeout: 2, // If the user is silent for 3 seconds, end the recording
    playBeep: true, // Play a beep before beginning the recording
  });

  return {
    callActive: true,
    response: twiml.toString(),
  };
};

const handleVoiceRecordingRequest = async (
  from: string,
  to: string,
  recordingUrl: string,
) => {
  const SpeechResult = await transcribeAudioWhisper(recordingUrl);

  const twiml = new VoiceResponse();
  const assistant = await Assistant.findOne({ 'identifiers.value': to });
  const user = await User.findOne({ 'identifiers.value': from });

  if (!assistant || !user) {
    twiml.play(
      'https://red-labradoodle-6369.twil.io/assets/agent-not-found.mp3',
    );

    return twiml.toString();
  }

  const session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  if (!session) {
    twiml.play(
      'https://red-labradoodle-6369.twil.io/assets/session-not-found.mp3',
    );
    return twiml.toString();
  }

  const response = await handleUserInput(
    SpeechResult,
    session.assistantId,
    session.threadId,
  );

  const limitedResponse = response.substring(0, 1200); // Limit response to 1600 characters
  const audioResponse = await generateAudio(limitedResponse);

  twiml.play(audioResponse?.path);
  twiml.redirect('/twilio/voice?firstTime=false');
  return twiml.toString();
};


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
