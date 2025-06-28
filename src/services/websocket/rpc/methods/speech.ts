import { AuthenticatedSocket } from '../../types';
import { SpeechFactory } from '../../../speech/speech.factory';
import { registerRpcMethod } from '../utils';
import { getApiKey } from '../../../api.key.service';

// Register the RPC method
registerRpcMethod(
  'generateSpeech',
  async (socket: AuthenticatedSocket, params: any) => {
    if (!params?.text) {
      throw new Error('text is required');
    }

    const {
      text,
      voice,
      model,
      textLimit,
      filename,
      provider = 'openai',
    } = params;
    const { companyId } = socket.decodedToken!;

    // Get appropriate API key based on provider
    let apiKey;
    if (provider === 'elevenlabs') {
      apiKey = (await getApiKey(companyId, 'labs11_api_key')) as string;
    } else {
      apiKey = (await getApiKey(companyId, 'openai_api_key')) as string;
    }

    const speechProvider = SpeechFactory.getProvider(provider, apiKey);
    const audioUrl = await speechProvider.generateSpeech(text, {
      voice,
      model,
      textLimit,
      filename,
    });

    return {
      audioUrl,
      timestamp: new Date().toISOString(),
    };
  },
);
