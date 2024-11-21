import axios from 'axios';
import { uploadFile } from '../../services/google.storage.service';
import { ApiKey } from '../../services/verification.service';

const verifyVoiceId = async (apikey: string, voiceId: string): Promise<boolean> => {
  try {
    const response = await axios.get(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      headers: {
        'xi-api-key': apikey,
      },
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export const generateAudio = async (
  apikey: string,
  text: string,
  voiceId: string = 'gbTBNCAEwTTleGFPK23L',
  modelId: string = 'eleven_turbo_v2',
): Promise<{ success: boolean; data?: { audioUrl: string }; error?: string }> => {
  const isValidVoice = await verifyVoiceId(apikey, voiceId);
  if (!isValidVoice) {
    return { success: false, error: `Invalid voice ID: ${voiceId}` };
  }

  const data = {
    model_id: modelId,
    text: text,
    voice_settings: {
      similarity_boost: 0.5,
      stability: 0.5,
      style: 1,
      use_speaker_boost: true,
    },
  };

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      data,
      {
        headers: {
          'xi-api-key': apikey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      },
    );

    const buffer = Buffer.from(response.data);

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: `elevenlabs_audio_${Date.now()}.mp3`,
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      buffer: buffer,
      size: buffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const publicUrl = await uploadFile(file);
    return { success: true, data: { audioUrl: publicUrl } };

  } catch (error) {
    return { success: false, error: 'Failed to generate audio with ElevenLabs' };
  }
};

export const verifyElevenLabsKey = async (apiKey: ApiKey): Promise<boolean> => {
  try {
    if (typeof apiKey !== 'string') {
      return false;
    }
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    return response.status === 200;
  } catch (error) {
    return false;
  }
};
