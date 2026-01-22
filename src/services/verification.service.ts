import { verifyOpenAiKey } from './oai.assistant.service';
import { verifyElevenLabsKey } from '../integrations/elevenlabs/elevenlabs.service';
import { verifyPerplexityKey } from '../integrations/perplexity/perplexity.service';
import axios from 'axios';

export type ApiKey = string;

type VerificationFunction = (key: ApiKey) => Promise<boolean>;

/**
 * Verify Google Gemini API key by listing available models
 */
export async function verifyGoogleGeminiKey(apiKey: ApiKey): Promise<boolean> {
  if (typeof apiKey !== 'string') {
    return false;
  }

  try {
    // Use the Google Generative AI REST API to list models
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        timeout: 10000,
      },
    );
    return response.status === 200 && Array.isArray(response.data?.models);
  } catch (error: any) {
    // Log the error for debugging but return false
    console.error(
      'Google Gemini key verification error:',
      error.response?.status,
      error.response?.data?.error?.message || error.message,
    );
    return false;
  }
}

/**
 * Verify Anthropic API key by making a minimal messages request
 */
export async function verifyAnthropicKey(apiKey: ApiKey): Promise<boolean> {
  if (typeof apiKey !== 'string') {
    return false;
  }

  try {
    // Make a minimal request to verify the key
    // Using the smallest model and minimal tokens to reduce cost
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 10000,
      },
    );
    return response.status === 200;
  } catch (error: any) {
    const status = error.response?.status;
    // 401 or 403 means invalid/unauthorized key
    if (status === 401 || status === 403) {
      return false;
    }
    // Log other errors for debugging
    console.error(
      'Anthropic key verification error:',
      status,
      error.response?.data?.error?.message || error.message,
    );
    return false;
  }
}

const services: Record<string, VerificationFunction> = {
  openai_api_key: verifyOpenAiKey,
  labs11_api_key: verifyElevenLabsKey,
  perplexity_api_key: verifyPerplexityKey,
  google_api_key: verifyGoogleGeminiKey,
  anthropic_api_key: verifyAnthropicKey,
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
