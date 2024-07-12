/// file_path: src/services/google.tts.service.ts

import textToSpeech from '@google-cloud/text-to-speech';
import { uploadImage } from './google.storage.service';

const textToSpeechClient = new textToSpeech.TextToSpeechClient();

export async function synthesizeText(
  text: string,
  voiceLanguageCode: string = 'he-IL',
  voiceName: string = 'he-IL-Wavenet-C',
): Promise<string> { // Return string instead of SaveToFileResponse
  const request = {
    input: { text },
    voice: {
      languageCode: voiceLanguageCode,
      name: voiceName, // Choose desired voice from list
    },
    audioConfig: { audioEncoding: 'MP3' as const },
  };

  try {
    const [response] = await textToSpeechClient.synthesizeSpeech(request);
    
    // Create a mock Express.Multer.File object
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: `file_${Date.now()}.mp3`,
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      buffer: response.audioContent as Buffer,
      size: response.audioContent?.length as number,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const publicUrl = await uploadImage(file);
    return publicUrl;
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error synthesizing speech');
  }
}
