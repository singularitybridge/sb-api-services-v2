import textToSpeech from '@google-cloud/text-to-speech';
import { SaveToFileResponse, saveToFile } from '../utils/file.upload.util';

const textToSpeechClient = new textToSpeech.TextToSpeechClient();

export async function synthesizeText(
  text: string,
  voiceLanguageCode: string = 'en-US',
  voiceName: string = 'en-US-Wavenet-A',
): Promise<SaveToFileResponse> {
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
    return saveToFile(response.audioContent as Buffer);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error synthesizing speech');
  }
}
