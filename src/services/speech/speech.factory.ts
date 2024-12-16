import { OpenAISpeechProvider } from './providers/openai.provider';
import { ElevenLabsSpeechProvider } from './providers/elevenlabs.provider';
import { SpeechProvider } from './types';

export class SpeechFactory {
  private static providers: Map<string, SpeechProvider> = new Map();

  static getProvider(provider: string, apiKey: string): SpeechProvider {
    const key = `${provider}-${apiKey}`;
    
    if (!this.providers.has(key)) {
      switch (provider) {
        case 'openai':
          this.providers.set(key, new OpenAISpeechProvider(apiKey));
          break;
        case 'elevenlabs':
          this.providers.set(key, new ElevenLabsSpeechProvider(apiKey));
          break;
        default:
          throw new Error(`Unsupported speech provider: ${provider}`);
      }
    }

    return this.providers.get(key)!;
  }
}
