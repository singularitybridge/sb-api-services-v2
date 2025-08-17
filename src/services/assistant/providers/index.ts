import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';

export function getProvider(
  providerKey: string | undefined,
  modelName: string,
  apiKey: string,
): LanguageModel {
  switch (providerKey) {
    case 'google':
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelName);
    case 'anthropic':
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelName);
    case 'openai':
    default:
      const openai = createOpenAI({ apiKey });
      return openai(modelName);
  }
}
