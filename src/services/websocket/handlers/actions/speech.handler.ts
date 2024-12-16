import { AuthenticatedSocket, WebSocketMessage } from '../../types';
import { SpeechFactory } from '../../../speech/speech.factory';
import { sendMessage } from '../messageHandler';
import { getApiKey } from '../../../api.key.service';

export const handleSpeechAction = async (
  socket: AuthenticatedSocket,
  message: WebSocketMessage,
  openAiApiKey: string
): Promise<void> => {
  const { requestId, data, action } = message;

  if (!data?.text) {
    throw new Error('text is required for generateSpeech action');
  }

  const { text, voice, model, textLimit, filename, provider = 'openai' } = data;
  
  let apiKey = openAiApiKey;
  if (provider === 'elevenlabs') {
    const { companyId } = socket.decodedToken!;
    apiKey = await getApiKey(companyId, 'labs11_api_key') as string;
  }

  const speechProvider = SpeechFactory.getProvider(provider, apiKey);
  const audioUrl = await speechProvider.generateSpeech(text, {
    voice,
    model,
    textLimit,
    filename
  });

  sendMessage(socket, {
    type: 'UPDATE',
    requestId,
    action,
    data: {
      audioUrl,
      timestamp: new Date().toISOString()
    }
  });
};
