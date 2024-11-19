import { Socket } from 'socket.io';
import { handleSessionMessage } from '../../assistant/message-handling.service';
import { getApiKey } from '../../api.key.service';
import { ChannelType } from '../../../types/ChannelType';
import { getSessionOrCreate } from '../../session.service';
import { AuthenticatedSocket, WebSocketMessage, CompletionRequestData } from '../types';
import { getCompletionResponse } from '../../oai.completion.service';

export const sendMessage = (socket: Socket, message: WebSocketMessage): void => {
  socket.emit('message', JSON.stringify(message));
};

export const handleMessage = async (socket: AuthenticatedSocket, message: WebSocketMessage): Promise<void> => {
  const { type, action, requestId, data } = message;

  if (type !== 'REQUEST') {
    return sendMessage(socket, {
      requestId,
      type: 'ERROR',
      error: {
        code: 'INVALID_MESSAGE_TYPE',
        message: 'Only REQUEST type messages are accepted'
      }
    });
  }

  if (!action) {
    return sendMessage(socket, {
      requestId,
      type: 'ERROR',
      error: {
        code: 'MISSING_ACTION',
        message: 'Action is required'
      }
    });
  }

  try {
    // Send immediate acknowledgment
    sendMessage(socket, {
      type: 'RESPONSE',
      requestId,
      data: { status: 'accepted' }
    });

    const { companyId } = socket.decodedToken!;
    const apiKey = await getApiKey(companyId, 'openai_api_key') as string;

    if (action === 'handleSessionMessage') {
      if (!data?.userInput) {
        throw new Error('userInput is required for handleSessionMessage action');
      }

      const { userId } = socket.decodedToken!;
      
      // Get or create session if not already set
      if (!socket.sessionId) {
        const session = await getSessionOrCreate(
          apiKey,
          userId,
          companyId,
          ChannelType.WEB,
          'en'
        );
        socket.sessionId = session._id.toString();
      }

      const response = await handleSessionMessage(
        apiKey,
        data.userInput,
        socket.sessionId!,
        ChannelType.WEB
      );

      sendMessage(socket, {
        type: 'UPDATE',
        requestId,
        action,
        data: {
          response,
          timestamp: new Date().toISOString()
        }
      });
    } else if (action === 'completion') {
      const completionData = data as CompletionRequestData;
      
      if (!completionData.systemPrompt || !completionData.userInput) {
        throw new Error('systemPrompt and userInput are required for completion action');
      }

      const response = await getCompletionResponse(
        apiKey,
        completionData.systemPrompt,
        completionData.userInput,
        completionData.model || 'gpt-4',
        completionData.temperature
      );

      sendMessage(socket, {
        type: 'UPDATE',
        requestId,
        action,
        data: {
          content: response,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Send demo response for other actions
      sendMessage(socket, {
        type: 'UPDATE',
        requestId,
        action,
        data: {
          message: 'Demo response',
          timestamp: new Date().toISOString(),
          receivedAction: action,
          authenticatedUser: {
            userId: socket.decodedToken?.userId,
            companyId: socket.decodedToken?.companyId
          }
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    sendMessage(socket, {
      requestId,
      type: 'ERROR',
      error: {
        code: 'ACTION_FAILED',
        message: errorMessage
      }
    });
  }
};
