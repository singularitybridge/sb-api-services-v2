import { AuthenticatedSocket } from '../../types';
import { getCompletionResponse } from '../../../oai.completion.service';
import { registerRpcMethod } from '../utils';
import { getApiKey } from '../../../api.key.service';

// Register the RPC method
registerRpcMethod('completion', async (socket: AuthenticatedSocket, params: any) => {
  if (!params?.systemPrompt || !params?.userInput) {
    throw new Error('systemPrompt and userInput are required');
  }

  const { companyId } = socket.decodedToken!;
  const apiKey = await getApiKey(companyId, 'openai_api_key') as string;

  const response = await getCompletionResponse(
    apiKey,
    params.systemPrompt,
    params.userInput,
    params.model || 'gpt-4',
    params.temperature,
    params.pdfUrl
  );

  return {
    content: response,
    timestamp: new Date().toISOString()
  };
});
