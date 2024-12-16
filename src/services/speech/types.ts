export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type OpenAIModel = 'tts-1' | 'tts-1-hd';

export interface SpeechGenerationOptions {
  text: string;
  voice?: string;
  model?: string;
  textLimit?: number;
  filename?: string;
  provider?: 'openai' | 'elevenlabs';
}

export interface OpenAISpeechOptions extends Omit<SpeechGenerationOptions, 'voice' | 'model'> {
  voice?: OpenAIVoice;
  model?: OpenAIModel;
}

export interface SpeechProvider {
  generateSpeech(text: string, options?: Partial<SpeechGenerationOptions>): Promise<string>;
}
