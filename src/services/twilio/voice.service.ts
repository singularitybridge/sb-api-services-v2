import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { Assistant } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { User } from '../../models/User';
import { generateAudio } from '../11labs.service';
import { handleUserInput } from '../assistant.service';
import { deleteThread, createNewThread } from '../oai.thread.service';
import { transcribeAudioWhisper } from '../speech.recognition.service';

export const handleVoiceCallEnded = async (
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

  deleteThread(session.threadId);
  session.active = false;
  await session.save();

  console.log(`call ended, assistant: ${assistant.name}, user: ${user.name}`);


  return true;
};

export const handleVoiceRequest = async (
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
      `this is a conversation with ${user.name}, start with greeting the user. today is december 14, 2023`,
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

export const handleVoiceRecordingRequest = async (
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
