import { verifyOpenAiKey } from './oai.assistant.service';
import { TwilioKeys, verifyTwilioKeys } from './twilio/voice.service';
import { verifyJsonBinKey } from './jsonbin.service';
import axios from 'axios';
import { verifyElevenLabsKey } from '../integrations/elevenlabs/elevenlabs.service';

// To do: verifyGcpKey, verifyNotionKey

export type ApiKey = string | TwilioKeys;

type VerificationFunction = (key: ApiKey) => Promise<boolean>;

const services: Record<string, VerificationFunction> = {
  //   'gcp_key': verifyGcpKey,
  openai_api_key: verifyOpenAiKey,
  //   'notion_api_key': verifyNotionKey,
  twilio_auth_token: verifyTwilioKeys,
  labs11_api_key: verifyElevenLabsKey,
  jsonbin_api_key: verifyJsonBinKey,
  telegram_bot_api_key: verifyTelegramBotToken,
};

export async function verifyApiKey(
  apiKey: ApiKey,
  serviceName: string,
): Promise<boolean> {
  if (!services[serviceName]) {
    throw new Error(`Service not supported: ${serviceName}`);
  }
  return services[serviceName](apiKey);
}

async function verifyTelegramBotToken(token: ApiKey): Promise<boolean> {
  if (typeof token !== 'string') {
    return false;
  }
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    return response.data.ok === true;
  } catch (error) {
    console.error('Error verifying Telegram bot token:', error);
    return false;
  }
}
