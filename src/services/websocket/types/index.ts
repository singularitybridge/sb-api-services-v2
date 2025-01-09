import { Socket } from 'socket.io';

export type DecodedToken = {
  userId: string;
  companyId: string;
};

export type AuthenticatedSocket = Socket & {
  decodedToken?: DecodedToken;
  sessionId?: string;
};

// Request data types for type checking
export type CompletionRequestData = {
  systemPrompt: string;
  userInput: string;
  model?: string;
  temperature?: number;
};

export type GenerateSpeechData = {
  text: string;
  voice?: string; // Removed specific voice types to support both OpenAI and ElevenLabs
  provider?: 'openai' | 'elevenlabs';
  textLimit?: number;
  filename?: string;
};
