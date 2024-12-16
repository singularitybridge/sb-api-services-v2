import { Socket } from 'socket.io';
import { AuthenticatedSocket, WebSocketMessage } from '../types';
import { getApiKey } from '../../api.key.service';
import { validateMessage } from './validation';
import { handleSessionAction } from './actions/session.handler';
import { handleCompletionAction } from './actions/completion.handler';
import { handleSpeechAction } from './actions/speech.handler';

export const sendMessage = (socket: Socket, message: WebSocketMessage): void => {
  socket.emit('message', JSON.stringify(message));
};

export const handleMessage = async (socket: AuthenticatedSocket, message: WebSocketMessage): Promise<void> => {
  if (!validateMessage(socket, message)) {
    return;
  }

  const { requestId, action, data } = message;

  try {
    // Send immediate acknowledgment
    sendMessage(socket, {
      type: 'RESPONSE',
      requestId,
      data: { status: 'accepted' }
    });

    const { companyId } = socket.decodedToken!;
    const apiKey = await getApiKey(companyId, 'openai_api_key') as string;

    switch (action) {
      case 'handleSessionMessage':
        await handleSessionAction(socket, message, apiKey);
        break;
      
      case 'completion':
        await handleCompletionAction(socket, message, apiKey);
        break;
      
      case 'generateSpeech':
        await handleSpeechAction(socket, message, apiKey);
        break;
      
      default:
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
