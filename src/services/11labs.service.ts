/// file_path: src/services/11labs.service.ts
import axios from 'axios';
import { saveToFile } from '../utils/file.upload.util';
import { ApiKey } from './verification.service';

export const generatedFilesBaseURL = 'https://sb-api.ngrok.app/tts/files';

export const generateAudio = async (
  text: string,
  voiceId: string = 'gbTBNCAEwTTleGFPK23L',
  modelId: string = 'eleven_turbo_v2',
) => {
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
          'xi-api-key': process.env.NOTION_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'stream', // Ensure you get the data as a stream
      },
    );

    return saveToFile(response.data as Buffer);
  } catch (error) {
    console.error(error);
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
