import express, { NextFunction } from 'express';
import { Twilio } from 'twilio';
import { Assistant, IAssistant } from '../../models/Assistant';
import { IUser, User } from '../../models/User';
import { ISession, Session } from '../../models/Session';
// import {
//   createNewThread,
//   deleteThread,
// } from '../../services/oai.thread.service'; // Removed, OpenAI specific
import axios from 'axios';
import { ChannelType } from '../../types/ChannelType'; // Added import
import mongoose from 'mongoose'; // Added for ObjectId generation

import { file } from 'googleapis/build/src/apis/file';
import { transcribeAudioWhisper } from '../../services/speech.recognition.service';
import { handleSessionMessage } from '../../services/assistant.service';

let twilioClient: Twilio | undefined;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const messagingRouter = express.Router();
const waitingSoundTick =
  'https://red-labradoodle-6369.twil.io/assets/tick1.wav';

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
} else {
  console.warn("Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) not found. Some omni.wa routes may not be available or fully functional.");
  // messagingRouter.use((req, res) => {
  //   res.status(503).send("Twilio dependent service is not configured on the server.");
  // });
  // We don't add a general 503 middleware here as some routes in this file might not depend on Twilio.
  // Individual route handlers that use twilioClient should check for its existence.
}


messagingRouter.get('/webhook', (req, res) => {
  console.log('verify token ...', req.query);

  const VERIFY_TOKEN = 'sb';

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

const ACCESS_TOKEN = 'EAAHfZCZCi8Pj8BOyI7wYQMlhScoOfcxIUcOZCjdmtLzQxit3GMNTk6GJSLF31BRPIRrypjpJSbruXmHGBtvsV4O5aKoDXdZAhkk2xbTQXrZA2kU0VYZCFZCtyi7qY4rweyAVDL16ERvADE56c5vig18gIuaKos415CbSkx5Ew2IXQ38A5D1aC4SjFgHlixnUWZA4';

function getTextMessageInput(recipient: any, text: any) {
  return JSON.stringify({
    messaging_product: 'whatsapp',
    preview_url: false,
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: {
      body: text,
    },
  });
}

function sendMessage(data: any, phoneNumberId: string) {
  var config = {
    method: 'post',
    url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    data: data,
  };

  return axios(config);
}

// used for whatsapp
messagingRouter.post('/webhook', async (req, res) => {

  console.log('handle incoming message ...');
  console.log(JSON.stringify(req.body, null, 2)); // Indent with 2 spaces

  const messages = req.body.entry[0]?.changes[0]?.value?.messages;
  if (!messages) {
    res.sendStatus(200);
    return;
  }


  const message = messages[0]?.text?.body;
  const senderId = messages[0]?.from;
  const phoneNumberId = req.body.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;

  console.log(message); // Here's the incoming message text!

  // Your response
  var data = getTextMessageInput(
    senderId,
    `You said: ${message}`,
  );
  await sendMessage(data, phoneNumberId);

  res.sendStatus(200);
});

/// old stuff


messagingRouter.post('/whatsapp/reply', async (req, res) => {
  const {
    CallSid,
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To, // +97293762075
    SpeechResult,
    Confidence,
    Body,
  } = req.body;

  const assistant = await Assistant.findOne({ 'identifiers.value': To });
  const user = await User.findOne({ 'identifiers.value': From });

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
    const threadId = new mongoose.Types.ObjectId().toString(); // Generate local threadId

    session = new Session({
      threadId: threadId, // Use locally generated threadId
      userId: user._id,
      assistantId: assistant.assistantId,
      active: true,
    });
    await session.save();
    console.log(
      `Voice Call >> Created new session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${threadId}`,
    );
  }

  // print received message
  console.log(req.body);

  const response = await handleSessionMessage(
    Body,
    session.id, // session.id is typically session._id.toString()
    session.channel as ChannelType,
  );

  let responseText: string;
  if (typeof response === 'string') {
    responseText = response;
  } else {
    // Assuming StreamTextResult has a 'text' property that resolves to the full string
    responseText = await response.text;
  }
  const limitedResponse = responseText.substring(0, 1600); // Limit response to 1600 characters

  if (!twilioClient || !twilioPhoneNumber) {
    console.error('Twilio client or phone number not initialized. Cannot send WhatsApp reply via Twilio.');
    // Depending on the desired behavior, you might want to send an error response
    // or simply log and not attempt to send via Twilio.
    // For now, just logging and not sending.
    return; 
  }

  twilioClient.messages
    .create({
      body: limitedResponse,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: From,
    })
    .then((message) => console.log(message.sid));
});

export { messagingRouter };
