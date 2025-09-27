import { verifyOpenAiKey } from './oai.assistant.service';
// import { TwilioKeys, verifyTwilioKeys } from './twilio/voice.service'; // Removed - Twilio dependency removed
import { verifyElevenLabsKey } from '../integrations/elevenlabs/elevenlabs.service';

export type ApiKey = string;

type VerificationFunction = (key: ApiKey) => Promise<boolean>;

const services: Record<string, VerificationFunction> = {
  //   'gcp_key': verifyGcpKey,
  openai_api_key: verifyOpenAiKey,
  // twilio_auth_token: verifyTwilioKeys, // Removed - Twilio dependency removed
  labs11_api_key: verifyElevenLabsKey,
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
