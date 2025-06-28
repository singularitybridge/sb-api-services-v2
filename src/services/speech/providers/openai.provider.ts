import { generateSpeech as openAiGenerateSpeech } from '../../oai.speech.service';
import {
  SpeechProvider,
  SpeechGenerationOptions,
  OpenAIVoice,
  OpenAIModel,
} from '../types';

export class OpenAISpeechProvider implements SpeechProvider {
  constructor(private readonly apiKey: string) {}

  async generateSpeech(
    text: string,
    options?: Partial<SpeechGenerationOptions>,
  ): Promise<string> {
    return openAiGenerateSpeech(
      this.apiKey,
      text,
      (options?.voice || 'alloy') as OpenAIVoice,
      (options?.model || 'tts-1') as OpenAIModel,
      options?.textLimit,
      options?.filename,
    );
  }
}
