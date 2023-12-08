import express, { NextFunction } from "express";
import { Twilio } from "twilio";
import { handleUserInput } from "../services/assistant.service";
import VoiceResponse, {
  GatherLanguage,
  SayLanguage,
  SayVoice,
} from "twilio/lib/twiml/VoiceResponse";
import { Assistant, IAssistant } from "../models/Assistant";
import { User } from "../models/User";
import { Session } from "../models/Session";
import { createNewThread, deleteThread } from "../services/oai.thread.service";

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const router = express.Router();


// const extractEntities = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
//   const { From, To } = req.body;

//   const assistant = await Assistant.findOne({ "identifiers.value": To });
//   const user = await User.findOne({ "identifiers.value": From });

//   if (!assistant || !user) {
//     return res.status(404).send("Assistant or User not found.");
//   }

//   const session = await Session.findOne({
//     userId: user._id,
//     assistantId: assistant.assistantId,
//     active: true,
//   });

//   if (!session) {
//     return res.status(404).send("Session not found.");
//   }

//   // Attach the extracted entities to the request object
//   req.assistant = assistant;
//   req.user = user;
//   req.session = session;

//   next();
// }


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

  const session = await Session.findOne({
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

    const newSession = new Session({
      threadId: threadId,
      userId: user._id,
      assistantId: assistant.assistantId,
      active: true,
    });
    await newSession.save();
    console.log(
      `Voice Call >> Created new session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${threadId}`
    );
  }

  console.log(`assistant: ${assistant.name}, user: ${user.name}`);

  if (firstTime !== "false") {
    twiml.say(
      {
        voice: assistant.voice as SayVoice,
        language: assistant.language as SayLanguage,
      },
      assistant.introMessage.replace("[Name]", user.name)
    );
  }

  twiml.gather({
    speechTimeout: "auto", // Automatically determine the end of user speech
    speechModel: "experimental_conversations", // Use the conversation-based speech recognition model
    input: ["speech"],
    language: assistant.language as GatherLanguage,
    enhanced: true,
    action: "/messaging/voice-response", // Send the collected input to /respond
  });

  twiml.redirect("/messaging/voice?firstTime=false");
  res.type("text/xml");
  res.send(twiml.toString());
});

router.post("/voice-response", async (req, res) => {
  const {
    CallSid,
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To, // +97293762075
    SpeechResult,
    Confidence,
  } = req.body;

  console.log(
    `Voice Response >> CallSid: ${CallSid}, CallStatus: ${CallStatus}, From: ${From}, To: ${To}, SpeechResult: ${SpeechResult}, Confidence: ${Confidence}`
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

  twiml.say(limitedResponse);
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

  // const replyTo = req.body.From; // Get the number that sent the WhatsApp message
  // const messageText = req.body.Body; // Get the message text sent

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
