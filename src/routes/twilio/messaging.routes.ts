import express, { NextFunction } from "express";
import { Twilio } from "twilio";
import { Assistant, IAssistant } from "../../models/Assistant";
import { IUser, User } from "../../models/User";
import { ISession, Session } from "../../models/Session";
// import { createNewThread, deleteThread } from "../../services/oai.thread.service"; // Removed, OpenAI specific
import { ChannelType } from "../../types/ChannelType"; // Added import
import mongoose from 'mongoose'; // Added for ObjectId generation

import { file } from "googleapis/build/src/apis/file";
import { transcribeAudioWhisper } from "../../services/speech.recognition.service";
import { handleSessionMessage } from "../../services/assistant.service";

let twilioClient: Twilio | undefined;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioMessagingRouter = express.Router();
const waitingSoundTick = "https://red-labradoodle-6369.twil.io/assets/tick1.wav";

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  twilioMessagingRouter.get("/whatsapp", (req, res) => {
    if (!twilioClient) {
      return res.status(503).send("Twilio client not initialized");
    }
    twilioClient.messages.list().then((messages) => res.send(messages));
  });

  twilioMessagingRouter.post("/whatsapp/reply", async (req, res) => {
    if (!twilioClient) {
      return res.status(503).send("Twilio client not initialized");
    }
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
  const apiKey = req.headers['openai-api-key'] as string;

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
      `Voice Call >> Created new session for assistant: ${assistant.name}, user: ${user.name}, threadId: ${threadId}`
    );
  }

  // print received message
  console.log(req.body);

  // TODO: Determine appropriate ChannelType for Twilio WhatsApp. Using WEB as placeholder.
  // Consider ChannelType.TELEGRAM if WhatsApp is handled similarly, or add ChannelType.WHATSAPP.
  const response = await handleSessionMessage(Body, session.id, ChannelType.WEB);

  if (typeof response === 'string') {
    const limitedResponse = response.substring(0, 1600); // Limit response to 1600 characters

    if (!twilioClient || !twilioPhoneNumber) {
      console.error('Twilio client or phone number not initialized. Cannot send WhatsApp reply.');
      return res.status(503).send("Twilio client or phone number not initialized");
    }

    twilioClient.messages
      .create({
        body: limitedResponse,
        from: `whatsapp:${twilioPhoneNumber}`,
        to: From,
      })
      .then((message) => {
        console.log(`Twilio message sent: ${message.sid}`);
      })
      .catch((error) => {
        console.error('Error sending Twilio message:', error);
        // Potentially send an error response back to Twilio if appropriate, though res.send() is not used here.
      });
    // Twilio typically expects a quick response to the webhook.
    // If we need to send something back to Twilio's HTTP request:
    res.status(200).send(); // Acknowledge receipt of the webhook
  } else {
    // Handle cases where response is not a string (should not happen with non-streaming call)
    console.error('handleSessionMessage did not return a string for Twilio WhatsApp reply.');
    // Twilio expects a response. Send an empty 200 OK or an error message if appropriate.
    // Depending on Twilio's error handling, sending nothing or an error status might be better.
    // For now, sending an empty 200 to acknowledge the webhook.
    res.status(200).send(); 
  }
});
} else {
  console.warn("Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) not found. Twilio messaging routes will not be available.");
  // Optionally, define placeholder routes or a message indicating the service is unavailable
  twilioMessagingRouter.use((req, res) => {
    res.status(503).send("Twilio messaging service is not configured on the server.");
  });
}

export { twilioMessagingRouter };
