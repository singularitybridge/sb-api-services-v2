import { generateSpeech as elevenLabsGenerateSpeech } from '../../../integrations/elevenlabs/elevenlabs.service';
import { SpeechProvider, SpeechGenerationOptions } from '../types';

export class ElevenLabsSpeechProvider implements SpeechProvider {
  constructor(private readonly apiKey: string) {}

  async generateSpeech(
    text: string,
    options?: Partial<SpeechGenerationOptions>
  ): Promise<string> {
    return elevenLabsGenerateSpeech(
      { apiKey: this.apiKey },
      {
        text,
        voiceId: options?.voice,
        modelId: options?.model,
        filename: options?.filename
      }
    );
  }
}
