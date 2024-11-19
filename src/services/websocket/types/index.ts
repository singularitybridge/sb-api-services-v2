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

export type WebSocketMessage = {
  type: 'REQUEST' | 'RESPONSE' | 'UPDATE' | 'ERROR';
  requestId: string;
  action?: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
};
