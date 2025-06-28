import { Session } from '../models/Session';
import { ChannelType } from '../types/ChannelType';
import { getApiKey } from './api.key.service';
import { getOpenAIClient } from './assistant/openai-client.service';
import {
  getAssistants,
  getAssistantById,
  updateAllowedActions,
  deleteAssistant,
  createDefaultAssistant,
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
  handleSessionMessage, // Add this line to export handleSessionMessage
};

export const sendMessageToAgent = async (
  sessionId: string,
  message: string,
) => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // const apiKey = await getApiKey(session.companyId.toString(), 'openai_api_key') as string; // apiKey is no longer needed here
    // The refactored handleSessionMessage fetches the API key internally.
    // When called without streaming metadata, handleSessionMessage returns Promise<string>.
    const response = await handleSessionMessage(
      message,
      sessionId,
      session.channel as ChannelType /*, no metadata for streaming */,
    );

    if (typeof response === 'string') {
      // Send the response to the appropriate channel
      switch (session.channel) {
        case ChannelType.TELEGRAM:
          await sendTelegramMessage(
            session.userId.toString(),
            response,
            session.companyId.toString(),
          );
          break;
        case ChannelType.WEB:
          // For WEB channel, if not SSE, this is how it might be logged or handled.
          // The SSE route itself handles WEB channel streaming separately.
          console.log(
            `Message processed for Web channel (non-SSE): ${response}`,
          );
          break;
        // Add cases for other channel types as needed
        default:
          console.log(
            `Message sent to channel ${session.channel}: ${response}`,
          );
      }
      return response; // Return the string response
    } else {
      // This case implies handleSessionMessage returned a StreamTextResult object,
      // which should not happen here as sendMessageToAgent does not request streaming.
      console.error(
        'sendMessageToAgent received a stream object from handleSessionMessage unexpectedly. ' +
          'This function is intended for non-streaming message handling.',
      );
      // Potentially throw an error or handle this unexpected state appropriately.
      // For now, logging and throwing an error to make it explicit.
      throw new Error(
        'Internal error: Unexpected response type in sendMessageToAgent. Expected string, got stream object.',
      );
    }
  } catch (error) {
    console.error('Error sending message to agent:', error);
    throw error;
  }
};
