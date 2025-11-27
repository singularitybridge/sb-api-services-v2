import express, { NextFunction } from "express";
import { Twilio } from "twilio";
import { Assistant, IAssistant } from "../../models/Assistant";
import { IUser, User } from "../../models/User";
import { ISession, Session } from "../../models/Session";
// import { createNewThread, deleteThread } from "../../services/oai.thread.service"; // Removed, OpenAI specific
// import { ChannelType } from "../../types/ChannelType"; // Removed - not used
import mongoose from 'mongoose'; // Added for ObjectId generation

import { file } from "googleapis/build/src/apis/file";
import { transcribeAudioWhisper } from "../../services/speech.recognition.service";
import { handleSessionMessage } from "../../services/assistant.service";
import { hasAudioMedia, getAudioMediaUrls, downloadTwilioMedia } from "../../services/twilio/media.service";
import { processWhatsAppAudioMessage } from "../../services/whatsapp-jira-bridge.service";

const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioMessagingRouter = express.Router();
const waitingSoundTick = "https://red-labradoodle-6369.twil.io/assets/tick1.wav";


twilioMessagingRouter.get("/whatsapp", (req, res) => {
  twilioClient.messages.list().then((messages) => res.send(messages));
});

twilioMessagingRouter.post("/whatsapp/reply", async (req, res) => {
  // Debug: log raw request body
  console.log('🔍 [Twilio WhatsApp] Raw request body:', JSON.stringify(req.body, null, 2));

  // Extract and clean phone numbers from Twilio format
  const From = req.body.From?.trim() || ''; // whatsapp:+972544429301
  const To = req.body.To?.trim() || ''; // whatsapp:+14155238886
  const Body = req.body.Body || '';

  console.log(`📲 [Twilio WhatsApp Webhook] Incoming message from ${From}`);
  console.log(`   To: ${To}`);
  console.log(`   Message: "${Body}"`);

  try {
    // Extract phone number without whatsapp: prefix for user lookup
    // Handle both "whatsapp:+123" and "whatsapp: +123" (with space)
    const fromPhone = From.replace(/whatsapp:\s*/i, '').trim();

    // Find or create user by phone number
    let user = await User.findOne({ "identifiers.value": fromPhone });

    if (!user) {
      try {
        // Create new user for this WhatsApp number
        const companyId = new mongoose.Types.ObjectId('690b1940455d30f7a1c1002b'); // Aid Genomics
        user = new User({
          companyId: companyId,
          name: req.body.ProfileName || fromPhone,
          email: `whatsapp_${fromPhone.replace(/[^0-9]/g, '')}@temp.local`,
          identifiers: [
            {
              type: 'phone',
              value: fromPhone
            }
          ]
        });
        await user.save();
        console.log(`📝 [Twilio WhatsApp] Created new user: ${user.name} (${fromPhone})`);
      } catch (createError: any) {
        // Handle duplicate key error - user might have been created by identifier but not found by phone
        if (createError.code === 11000) {
          console.log(`📝 [Twilio WhatsApp] User already exists, fetching: ${fromPhone}`);
          user = await User.findOne({
            email: `whatsapp_${fromPhone.replace(/[^0-9]/g, '')}@temp.local`
          });
          if (!user) {
            throw new Error('User creation failed and could not find existing user');
          }
        } else {
          throw createError;
        }
      }
    }

    // Find Administration Orchestrator
    const assistant = await Assistant.findOne({
      name: 'Administration Orchestrator',
      companyId: user.companyId
    });

    if (!assistant) {
      console.error('❌ [Twilio WhatsApp] Administration Orchestrator not found');
      await twilioClient.messages.create({
        body: '⚠️ System configuration error. Please contact support.',
        from: To,
        to: From
      });
      return res.status(200).send();
    }

    // Find or create session
    let session = await Session.findOne({
      userId: user._id,
      assistantId: assistant._id,
      active: true,
    });

    if (!session) {
      const threadId = new mongoose.Types.ObjectId().toString();
      session = new Session({
        threadId: threadId,
        userId: user._id,
        assistantId: assistant._id,
        companyId: user.companyId, // ← Add companyId!
        active: true,
      });
      await session.save();
      console.log(`📝 [Twilio WhatsApp] Created session for ${assistant.name}`);
    }

    // print received message
    console.log(`🔄 [Twilio WhatsApp] Routing to ${assistant.name}`);

    // ===== AUDIO MESSAGE HANDLING (WhatsApp-Jira Bridge) =====
    if (hasAudioMedia(req.body)) {
      console.log(`🎤 [Twilio WhatsApp] Audio message detected!`);

      try {
        const audioUrls = getAudioMediaUrls(req.body);
        console.log(`📎 [Twilio WhatsApp] Found ${audioUrls.length} audio file(s)`);

        // Process first audio file (usually only one per message)
        if (audioUrls.length > 0) {
          const audioUrl = audioUrls[0];

          // Prepare metadata
          const metadata = {
            sender: From,
            senderName: req.body.ProfileName || From,
            groupName: req.body.GroupName, // Only present for group messages
            groupId: req.body.GroupId,
            audioUrl: audioUrl,
            timestamp: new Date(),
            messageId: req.body.MessageSid || req.body.SmsMessageSid
          };

          console.log(`🔄 [Twilio WhatsApp] Processing audio message...`);
          console.log(`   From: ${metadata.senderName}`);
          console.log(`   Group: ${metadata.groupName || 'Direct Message'}`);

          // Process through WhatsApp-Jira Bridge
          const result = await processWhatsAppAudioMessage(
            audioUrl,
            metadata,
            assistant.companyId.toString()
          );

          // Send confirmation back to WhatsApp
          let confirmationMessage: string;

          if (result.success) {
            confirmationMessage = result.summary ||
              `🎤 Audio processed!\n✅ Created ${result.tasksCreated || 0} Jira task(s)`;
          } else {
            confirmationMessage = `❌ Failed to process audio: ${result.error || 'Unknown error'}`;
          }

          await twilioClient.messages.create({
            body: confirmationMessage,
            from: To,
            to: From
          });

          console.log(`✅ [Twilio WhatsApp] Audio message processed and confirmation sent`);

          return res.status(200).send(); // Acknowledge webhook
        }
      } catch (error: any) {
        console.error(`❌ [Twilio WhatsApp] Error processing audio:`, error);

        // Send error message to user
        await twilioClient.messages.create({
          body: `⚠️ Error processing audio message: ${error.message}`,
          from: To,
          to: From
        });

        return res.status(200).send(); // Still acknowledge webhook
      }
    }

    // ===== TEXT MESSAGE HANDLING (Regular chat via Administration Orchestrator) =====
    console.log(`💬 [Twilio WhatsApp] Processing text message: "${Body}"`);

    const response = await handleSessionMessage(Body, session.id);

    if (typeof response === 'string') {
      // Limit response to 1600 characters for WhatsApp
      const limitedResponse = response.substring(0, 1600);

      await twilioClient.messages.create({
        body: limitedResponse,
        from: To, // Twilio number with whatsapp: prefix
        to: From, // User number with whatsapp: prefix
      });

      console.log(`✅ [Twilio WhatsApp] Response sent to ${From}`);
      console.log(`   Response preview: ${limitedResponse.substring(0, 100)}...`);
    } else {
      console.error('❌ [Twilio WhatsApp] handleSessionMessage did not return a string');
    }

    return res.status(200).send(); // Always acknowledge webhook

  } catch (error: any) {
    console.error('❌ [Twilio WhatsApp] Unexpected error:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack:', error.stack);

    try {
      // Try to send error message to user - use original From/To from request
      await twilioClient.messages.create({
        body: '⚠️ System error. Please try again later.',
        from: To, // Use cleaned To variable
        to: From  // Use cleaned From variable
      });
    } catch (sendError) {
      console.error('❌ [Twilio WhatsApp] Failed to send error message:', sendError);
    }

    return res.status(200).send(); // Still acknowledge webhook to prevent retries
  }
});

export { twilioMessagingRouter };
