import { AuthenticatedSocket, WebSocketMessage, CompletionRequestData } from '../../types';
import { getCompletionResponse } from '../../../oai.completion.service';
import { sendMessage } from '../messageHandler';

export const handleCompletionAction = async (
  socket: AuthenticatedSocket,
  message: WebSocketMessage,
  apiKey: string
): Promise<void> => {
  const { requestId, data, action } = message;
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
};
