import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google'; // Changed to createGoogleGenerativeAI
import { createAnthropic } from '@ai-sdk/anthropic';

// Define ProviderKey type if it's not already defined elsewhere
// For example: export type ProviderKey = 'openai' | 'google' | 'anthropic';
// Assuming ProviderKey is defined in a relevant types file, e.g., src/types/assistant.types.ts
// If not, it should be defined here or in an appropriate shared types file.
import { ProviderKey } from '../../types/assistant.types'; // Reverting to the standard relative path

export function getProvider(pk: ProviderKey, model: string, key: string) {
  switch (pk) {
    case 'google':
      // Assuming createGoogleGenerativeAI returns the provider instance directly
      // or an object that has a .chat() method similar to other providers.
      // The exact API might differ slightly, but this is a common pattern.
      return createGoogleGenerativeAI({ apiKey: key }).chat(model);
    case 'anthropic':
      return createAnthropic({ apiKey: key }).chat(model);
    case 'openai': // Defaulting to openai, or you can make it explicit
    default:
      // For o3-mini models, we need to use just 'o3-mini' as the model name
      // The reasoning effort (low/medium/high) should be passed via providerOptions
      let actualModel = model;
      if (model.startsWith('o3-mini-')) {
        actualModel = 'o3-mini';
      }
      return createOpenAI({ apiKey: key }).chat(actualModel);
  }
}
