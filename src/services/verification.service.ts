import { verify11LabsKey } from './11labs.service';
import { verifyOpenAiKey } from './oai.assistant.service';
import { TwilioKeys, verifyTwilioKeys } from './twilio/voice.service';

// To do: verifyGcpKey, verifyNotionKey

export type ApiKey = string | TwilioKeys;

type VerificationFunction = (key: ApiKey) => Promise<boolean>;

const services: Record<string, VerificationFunction> = {
  //   'gcp_key': verifyGcpKey,
  openai_api_key: verifyOpenAiKey,
  //   'notion_api_key': verifyNotionKey,
  twilio_auth_token: verifyTwilioKeys,
  labs11_api_key: verify11LabsKey,
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
