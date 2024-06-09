import { SaveToFileResponse, saveToFile } from '../utils/file.upload.util';
import { getOpenAIClient } from './assistant.service';

export const generateSpeech = async (
  apiKey: string,
  text: string,  
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
  model: string = 'tts-1',
): Promise<SaveToFileResponse> => {
  const openaiClient = getOpenAIClient(apiKey);
  const mp3 = await openaiClient.audio.speech.create({
    input: text,
    model,
    voice,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  return saveToFile(buffer);
};
