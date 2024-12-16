import { AuthenticatedSocket, WebSocketMessage } from '../../types';
import { handleSessionMessage } from '../../../assistant/message-handling.service';
import { getSessionOrCreate } from '../../../session.service';
import { ChannelType } from '../../../../types/ChannelType';
import { sendMessage } from '../messageHandler';

export const handleSessionAction = async (
  socket: AuthenticatedSocket,
  message: WebSocketMessage,
  apiKey: string
): Promise<void> => {
  const { requestId, data, action } = message;

  if (!data?.userInput) {
    throw new Error('userInput is required for handleSessionMessage action');
  }

  const { userId, companyId } = socket.decodedToken!;
  
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
};
