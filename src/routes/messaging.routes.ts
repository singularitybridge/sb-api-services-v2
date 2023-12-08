import express from "express";
import { Twilio } from "twilio";
import { handleUserInput } from "../services/assistant.service";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const router = express.Router();

router.post("/voice", (req, res) => {

  const { firstTime } = req.query;
  const { 
    CallSid, 
    CallStatus, // ringing/in-progress/completed
    From, // +972526722216
    To // +97293762075
  } = req.body;

  const twiml = new VoiceResponse();
  
  console.log(`Voice Call >> CallSid: ${CallSid}, CallStatus: ${CallStatus}, From: ${From}, To: ${To}, firstTime: ${firstTime}`);


  if (firstTime !== "false") {
    twiml.say(
      {
        voice: "Polly.Emma",
        language: "en-US",
      },

      `Hello! Welcome to Dr. Anna's dental office. I'm Smile Assistant Eva, here to assist you with scheduling and managing appointments. May I have your name, please?`
    );
  }

  twiml.gather({
    speechTimeout: "auto", // Automatically determine the end of user speech
    speechModel: "experimental_conversations", // Use the conversation-based speech recognition model
    input: ["speech"],
    language: "en-US",
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
    Confidence
  } = req.body;

  console.log(`Voice Response >> CallSid: ${CallSid}, CallStatus: ${CallStatus}, From: ${From}, To: ${To}, SpeechResult: ${SpeechResult}, Confidence: ${Confidence}`);

  const twiml = new VoiceResponse();
  
  const response = await handleUserInput(SpeechResult);
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
  // print received message
  console.log(req.body);

  const replyTo = req.body.From; // Get the number that sent the WhatsApp message
  const messageText = req.body.Body; // Get the message text sent

  const response = await handleUserInput(messageText);
  const limitedResponse = response.substring(0, 1600); // Limit response to 1600 characters

  twilioClient.messages
    .create({
      body: limitedResponse,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: replyTo,
    })
    .then((message) => console.log(message.sid));
});

export default router;
