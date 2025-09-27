import { Session } from '../models/Session';
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
      sessionId /* no metadata */,
    );

    if (typeof response === 'string') {
      console.log(`Message processed for session ${session._id}: ${response}`);
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
