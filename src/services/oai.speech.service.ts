/// file_path: src/services/oai.speech.service.ts

import { uploadFile } from './google.storage.service';
import { getOpenAIClient } from './assistant.service';
import { getCompletionResponse } from './oai.completion.service';

export const generateSpeech = async (
  apiKey: string,
  text: string,  
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
  model:  'tts-1-hd' | 'tts-1' = 'tts-1-hd',
  textLimit: number = 4096 // Default limit of 4096 characters
): Promise<string> => { // Return string instead of SaveToFileResponse
  // Check if text exceeds the limit
  if (text.length > textLimit) {
    // Summarize the text
    const summarizedText = await summarizeText(apiKey, text, textLimit);
    text = summarizedText;
  }
  const openaiClient = getOpenAIClient(apiKey);
  const mp3 = await openaiClient.audio.speech.create({
    input: text,
    model,
    voice,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  
  // Create a mock Express.Multer.File object
  const file: Express.Multer.File = {
    fieldname: 'file',
    originalname: `file_${Date.now()}.mp3`,
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
  return publicUrl;
};
