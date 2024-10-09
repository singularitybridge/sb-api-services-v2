import { Session } from '../models/Session';
import { ChannelType } from '../types/ChannelType';
import { getApiKey } from './api.key.service';
import { getOpenAIClient } from './assistant/openai-client.service';
import {
  getAssistants,
  getAssistantById,
  updateAllowedActions,
  deleteAssistant,
  createDefaultAssistant
} from './assistant/assistant-management.service';
import { getSessionMessages } from './assistant/session-management.service';
import { handleSessionMessage } from './assistant/message-handling.service';
import { sendTelegramMessage } from './assistant/telegram.service';

export {
  getOpenAIClient,
  getAssistants,
  getAssistantById,
  updateAllowedActions,
  deleteAssistant,
  createDefaultAssistant,
  getSessionMessages,
  handleSessionMessage // Add this line to export handleSessionMessage
};

export const sendMessageToAgent = async (
  sessionId: string,
  message: string
) => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const apiKey = await getApiKey(session.companyId.toString(), 'openai') as string;
    const response = await handleSessionMessage(apiKey, message, sessionId, session.channel);
    
    // Send the response to the appropriate channel
    switch (session.channel) {
      case ChannelType.TELEGRAM:
        await sendTelegramMessage(session.userId.toString(), response, session.companyId.toString());
        break;
      case ChannelType.WEB:
        console.log(`Message sent to Web channel: ${response}`);
        break;
      // Add cases for other channel types as needed
      default:
        console.log(`Message sent to channel ${session.channel}: ${response}`);
    }

    return response;
  } catch (error) {
    console.error('Error sending message to agent:', error);
    throw error;
  }
};