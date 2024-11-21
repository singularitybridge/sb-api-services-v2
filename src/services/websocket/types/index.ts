import { Socket } from 'socket.io';

export type DecodedToken = {
  userId: string;
  companyId: string;
};

export type AuthenticatedSocket = Socket & {
  decodedToken?: DecodedToken;
  sessionId?: string;
};

export type CompletionRequestData = {
  systemPrompt: string;
  userInput: string;
  model?: string;
  temperature?: number;
};

export type GenerateSpeechData = {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  textLimit?: number;
  filename?: string;
};

export type WebSocketAction = 
  | 'handleSessionMessage'
  | 'completion'
  | 'generateSpeech';

export type WebSocketMessage = {
  type: 'REQUEST' | 'RESPONSE' | 'UPDATE' | 'ERROR';
  requestId: string;
  action?: WebSocketAction;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
};
