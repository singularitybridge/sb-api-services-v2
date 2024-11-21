import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { Assistant } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { User } from '../../models/User';
import { deleteThread, createNewThread } from '../oai.thread.service';
import { transcribeAudioWhisper } from '../speech.recognition.service';
import { getCurrentTimeAndDay } from '../context.service';
import { Twilio } from 'twilio';
import { ApiKey } from '../verification.service';
import Api from 'twilio/lib/rest/Api';
import { handleSessionMessage } from '../assistant.service';
import { generateAudio } from '../../integrations/elevenlabs/elevenlabs.service';

export type TwilioKeys = {
  accountSid: string;
  authToken: string;
};

export const handleVoiceCallEnded = async (
  apiKey: string,
  from: string,
  to: string,
): Promise<boolean> => {
  const assistant = await Assistant.findOne({ 'identifiers.value': to });
  const user = await User.findOne({ 'identifiers.value': from });

  if (!assistant || !user) return false;

  const session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  if (!session) return false;

  deleteThread(apiKey, session.threadId);
  session.active = false;
  await session.save();

  console.log(`call ended, assistant: ${assistant.name}, user: ${user.name}`);

  return true;
};

export const handleVoiceRequest = async (
  apiKey: string,
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
    return { callActive: false, response: twiml.toString() };
  }

  let session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  if (!session) {
    const threadId = await createNewThread(apiKey);

    session = new Session({
      threadId: threadId,
      userId: user._id,
      assistantId: assistant.assistantId,
      active: true,
    });
    await session.save();
  }

  if (firstTime !== false) {
    const response = await handleSessionMessage(
      apiKey,
      `this is a conversation with ${
        user.name
      }, start with greeting the user. ${getCurrentTimeAndDay()}`,
      session.id      
    );
    const limitedResponse = response.substring(0, 1200); // Limit response to 1200 characters

    // generate intro message
    const audioResponse = await generateAudio('', limitedResponse);
    if (audioResponse.success && audioResponse.data?.audioUrl) {
      twiml.play(audioResponse.data.audioUrl);
    } else {
      console.error('Failed to generate audio:', audioResponse.error);
      twiml.say('I apologize, but I am unable to generate audio at the moment.');
    }
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

export const handleVoiceRecordingRequest = async (
  apiKey: string,
  from: string,
  to: string,
  recordingUrl: string,
) => {

  // const SpeechResult = await transcribeAudioWhisper(recordingUrl);

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

  const response = await handleSessionMessage(
    apiKey,
    '', // or SpeechResult when uncommented
    session._id,
  );

  const limitedResponse = response.substring(0, 1200); // Limit response to 1200 characters
  const audioResponse = await generateAudio('', limitedResponse);

  if (audioResponse.success && audioResponse.data?.audioUrl) {
    twiml.play(audioResponse.data.audioUrl);
  } else {
    console.error('Failed to generate audio:', audioResponse.error);
    twiml.say('I apologize, but I am unable to generate audio at the moment.');
  }

  twiml.redirect('/twilio/voice?firstTime=false');
  return twiml.toString();
};

export const verifyTwilioKeys = async (keys: ApiKey): Promise<boolean> => {
  try {
    if (
      typeof keys !== 'object' ||
      !('accountSid' in keys) ||
      !('authToken' in keys)
    ) {
      throw new Error('Invalid API key type for Twilio verification');
    }

    const tempTwilioClient = new Twilio(keys.accountSid, keys.authToken);

    const account = await tempTwilioClient.api
      .accounts(keys.accountSid)
      .fetch();

    return !!account;
  } catch (error) {
    console.error('Error verifying Twilio keys:', error);
    return false;
  }
};
