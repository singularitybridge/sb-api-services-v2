import axios from 'axios';
import { ApiKey } from '../../services/verification.service';

interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
}

interface GenerateAudioResult {
  success: boolean;
  data?: {
    audioUrl: string;
  };
  error?: string;
}

interface GenerateSpeechOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  filename?: string;
}

export const generateAudio = async (
  apiKey: string,
  text: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM',
  filename?: string
): Promise<GenerateAudioResult> => {
  try {
    const result = await generateSpeech(
      { apiKey },
      { text, voiceId, filename }
    );
    return {
      success: true,
      data: {
        audioUrl: result
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

export const generateSpeech = async (
  config: ElevenLabsConfig,
  options: GenerateSpeechOptions
): Promise<string> => {
  const {
    text,
    voiceId = '21m00Tcm4TlvDq8ikWAM', // Default voice - Rachel
    modelId = 'eleven_monolingual_v1'
  } = options;

  const baseUrl = config.baseUrl || 'https://api.elevenlabs.io/v1';
  
  try {
    const response = await axios({
      method: 'POST',
      url: `${baseUrl}/text-to-speech/${voiceId}`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      responseType: 'arraybuffer'
    });

    // Convert the audio buffer to base64
    const audioBase64 = Buffer.from(response.data).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    return audioUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`ElevenLabs API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
};

export const verifyElevenLabsKey = async (key: ApiKey): Promise<boolean> => {
  if (typeof key !== 'string') {
    return false;
  }
  
  try {
    const response = await axios({
      method: 'GET',
      url: 'https://api.elevenlabs.io/v1/voices',
      headers: {
        'xi-api-key': key
      }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};
