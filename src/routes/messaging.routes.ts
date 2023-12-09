import express, { NextFunction } from "express";
import { Twilio } from "twilio";
import { handleUserInput } from "../services/assistant.service";
import VoiceResponse, {
  GatherLanguage,
  SayLanguage,
  SayVoice,
} from "twilio/lib/twiml/VoiceResponse";
import { Assistant, IAssistant } from "../models/Assistant";
import { IUser, User } from "../models/User";
import { ISession, Session } from "../models/Session";
import { createNewThread, deleteThread } from "../services/oai.thread.service";
import { Request } from "express";
import { generateAudio } from "../services/11labs.service";
import {
  transcribeAudio,
  transcribeAudioGoogle,
} from "../services/speech.recognition.service";

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const router = express.Router();

router.get("/test", async (req, res) => {
  const audioURL =
    "https://api.twilio.com/2010-04-01/Accounts/ACac8672e7717c6e9d7238a577e13e72d0/Recordings/RE0a3ff37605235d4492f6d0ac530e9fd5";
  // const googleResult = await transcribeAudioGoogle(audioURL);
  const oaiWhipserResult = await transcribeAudio(audioURL);
  res.send({
    // googleResult,
    oaiWhipserResult,
  });
});

// lets generatea route to serve the audio file saved in the files folder
router.get("/audio/:filename", async (req, res) => {
  const { filename } = req.params;
  const filePath = `./files/${filename}`;
  res.download(filePath);
});

router.post("/voice", async (req, res) => {
  const { firstTime } = req.query;
  const {
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To, // +97293762075
  } = req.body;

  const twiml = new VoiceResponse();
  const assistant = await Assistant.findOne({ "identifiers.value": To });
  const user = await User.findOne({ "identifiers.value": From });

  if (!assistant || !user) {
    console.log(`Voice Call >> Assistant not found for To: ${To}`);
    twiml.say(
      {
        voice: "Polly.Emma",
        language: "en-US",
      },
      "Sorry, I couldn't find an assistant for this number."
    );
    res.type("text/xml");
    res.send(twiml.toString());
    return;
  }

  // next, check if have an active session, if not, create one

  let session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  // check if call status is completed, if so, set session to inactive and delete thread
  if (CallStatus === "completed") {
    if (!session) {
      console.log("session not found");
      return res.status(500).send();
    }

    deleteThread(session.threadId);
    session.active = false;
    await session.save();

    console.log(
      `Voice Call >> Completed session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${session.threadId}`
    );
    return res.status(200).send();
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
    console.log(
      `Voice Call >> Created new session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${threadId}`
    );
  }

  console.log(`assistant: ${assistant.name}, user: ${user.name}`);

  if (firstTime !== "false") {
    const response = await handleUserInput(
      `this is a conversation with ${user.name}, start with greeting the user`,
      session.assistantId,
      session.threadId
    );
    const limitedResponse = response.substring(0, 1200); // Limit response to 1600 characters

    // generate intro message
    const filename = await generateAudio(limitedResponse);
    const fileUrl = `https://sb-api.ngrok.app/messaging/audio/${filename}`;
    console.log("audio file url", fileUrl);
    twiml.play(fileUrl);
  }

  twiml.record({
    action: "/messaging/voice-recording", // Send the recording to /voice-recording
    method: "POST",
    maxLength: 20, // Maximum length of recording in seconds
    finishOnKey: "star", // End the recording when the user presses *
    timeout: 2, // If the user is silent for 3 seconds, end the recording
    playBeep: true, // Play a beep before beginning the recording
  });
  // twiml.redirect("/messaging/voice?firstTime=false");
  res.type("text/xml");
  res.send(twiml.toString());
});

router.post("/voice-recording", async (req, res) => {
  const {
    CallSid,
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To, // +97293762075
    // SpeechResult,
    RecordingUrl,
  } = req.body;

  const SpeechResult = await transcribeAudio(RecordingUrl);

  console.log(
    `Voice Response >> CallSid: ${CallSid}, CallStatus: ${CallStatus}, From: ${From}, To: ${To}, SpeechResult: ${SpeechResult}`
  );

  const twiml = new VoiceResponse();
  const assistant = await Assistant.findOne({ "identifiers.value": To });
  const user = await User.findOne({ "identifiers.value": From });

  if (!assistant || !user) {
    console.log(`Voice Call >> Assistant not found for To: ${To}`);
    twiml.say(
      {
        voice: "Polly.Emma",
        language: "en-US",
      },
      "Sorry, I couldn't find an assistant for this number."
    );
    res.type("text/xml");
    res.send(twiml.toString());
    return;
  }

  const session = await Session.findOne({
    userId: user._id,
    assistantId: assistant.assistantId,
    active: true,
  });

  if (!session) {
    console.log(
      `Voice Response >> Session not found for assistant: ${assistant.name}, user: ${user.name}`
    );
    twiml.say(
      {
        voice: "Polly.Emma",
        language: "en-US",
      },
      "Sorry, I couldn't find an active session for this number."
    );
    res.type("text/xml");
    res.send(twiml.toString());
    return;
  }

  const response = await handleUserInput(
    SpeechResult,
    session.assistantId,
    session.threadId
  );
  const limitedResponse = response.substring(0, 1200); // Limit response to 1600 characters

  const filename = await generateAudio(limitedResponse);
  const fileUrl = `https://sb-api.ngrok.app/messaging/audio/${filename}`;
  console.log("audio file url", fileUrl);
  twiml.play(fileUrl);

  twiml.redirect("/messaging/voice?firstTime=false");
  res.type("text/xml");
  res.send(twiml.toString());
});

router.get("/sms", (req, res) => {
  twilioClient.messages.list().then((messages) => res.send(messages));
});

router.post("/sms/reply", async (req, res) => {
  const {
    CallSid,
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To, // +97293762075
    SpeechResult,
    Confidence,
    Body,
  } = req.body;

  const assistant = await Assistant.findOne({ "identifiers.value": To });
  const user = await User.findOne({ "identifiers.value": From });

  if (!assistant || !user) {
    console.log(`Voice Call >> Assistant not found for To: ${To}`);
    return res.status(500).send();
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
    console.log(
      `Voice Call >> Created new session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${threadId}`
    );
  }

  // print received message
  console.log(req.body);

  const response = await handleUserInput(
    Body,
    session.assistantId,
    session.threadId
  );
  const limitedResponse = response.substring(0, 1600); // Limit response to 1600 characters

  twilioClient.messages
    .create({
      body: limitedResponse,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: From,
    })
    .then((message) => console.log(message.sid));
});

export default router;
