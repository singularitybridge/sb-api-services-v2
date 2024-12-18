import { AuthenticatedSocket } from '../../types';
import { handleSessionMessage } from '../../../assistant/message-handling.service';
import { getSessionOrCreate } from '../../../session.service';
import { ChannelType } from '../../../../types/ChannelType';
import { registerRpcMethod } from '../utils';
import { getApiKey } from '../../../api.key.service';

const processSessionMessage = async (apiKey: string, socket: AuthenticatedSocket, userInput: string) => {
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
    userInput,
    socket.sessionId!,
    ChannelType.WEB
  );

  return {
    response,
    timestamp: new Date().toISOString()
  };
};

// Register the RPC method
registerRpcMethod('handleSessionMessage', async (socket: AuthenticatedSocket, params: any) => {
  if (!params?.userInput) {
    throw new Error('userInput is required');
  }

  const { companyId } = socket.decodedToken!;
  const apiKey = await getApiKey(companyId, 'openai_api_key') as string;

  return processSessionMessage(apiKey, socket, params.userInput);
});
