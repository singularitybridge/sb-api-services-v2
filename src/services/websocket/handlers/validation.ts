import { Socket } from 'socket.io';
import { WebSocketMessage } from '../types';
import { sendMessage } from './messageHandler';

export const validateMessage = (
  socket: Socket,
  message: WebSocketMessage
): boolean => {
  const { type, action, requestId } = message;

  if (type !== 'REQUEST') {
    sendMessage(socket, {
      requestId,
      type: 'ERROR',
      error: {
        code: 'INVALID_MESSAGE_TYPE',
        message: 'Only REQUEST type messages are accepted'
      }
    });
    return false;
  }

  if (!action) {
    sendMessage(socket, {
      requestId,
      type: 'ERROR',
      error: {
        code: 'MISSING_ACTION',
        message: 'Action is required'
      }
    });
    return false;
  }

  return true;
};
