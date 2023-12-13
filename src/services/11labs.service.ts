import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';
import { saveToFile } from '../utils/file.upload.util';

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
          'xi-api-key': '55a34e51010dc1f6ab29485805ef67eb',
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
