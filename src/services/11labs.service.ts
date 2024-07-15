/// file_path: src/services/11labs.service.ts
import axios from 'axios';
import { ApiKey } from './verification.service';
import { uploadImage } from './google.storage.service';

export const generateAudio = async (
  apikey: string,
  text: string,
  voiceId: string = 'gbTBNCAEwTTleGFPK23L',
  modelId: string = 'eleven_turbo_v2',
): Promise<string> => {
  console.log('generateAudio ...', text);

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
        responseType: 'arraybuffer', // Changed from 'stream' to 'arraybuffer'
      },
    );

    const buffer = Buffer.from(response.data);

    // Create a mock Express.Multer.File object
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

    // Upload the file to cloud storage
    const publicUrl = await uploadImage(file);
    return publicUrl;

  } catch (error) {
    console.error('Error generating audio with ElevenLabs:', error);
    throw error;
  }
};

export const verify11LabsKey = async (apiKey: ApiKey) => {
  try {
    if (typeof apiKey !== 'string') {
      throw new Error('Invalid API key type for 11labs verification');
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
