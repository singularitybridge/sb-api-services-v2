import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProviderKey } from '../../types/assistant.types';

// Model configurations with built-in capabilities for v5
const MODEL_CONFIGS: Record<string, any> = {
  // O3-mini models - v5 handles strict mode automatically
  'o3-mini': {
    provider: 'openai',
    baseModel: 'o3-mini',
    providerOptions: {
      openai: { reasoningEffort: 'medium' },
    },
  },
  'o3-mini-low': {
    provider: 'openai',
    baseModel: 'o3-mini',
    providerOptions: {
      openai: { reasoningEffort: 'low' },
    },
  },
  'o3-mini-medium': {
    provider: 'openai',
    baseModel: 'o3-mini',
    providerOptions: {
      openai: { reasoningEffort: 'medium' },
    },
  },
  'o3-mini-high': {
    provider: 'openai',
    baseModel: 'o3-mini',
    providerOptions: {
      openai: { reasoningEffort: 'high' },
    },
  },
  // GPT models
  'gpt-4o': { provider: 'openai', baseModel: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', baseModel: 'gpt-4o-mini' },
  'gpt-4.1-mini': { provider: 'openai', baseModel: 'gpt-4.1-mini' },
  'gpt-4-turbo': { provider: 'openai', baseModel: 'gpt-4-turbo' },
  'gpt-3.5-turbo': { provider: 'openai', baseModel: 'gpt-3.5-turbo' },
  // Claude models
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    baseModel: 'claude-3-5-sonnet-latest',
  },
  'claude-3-5-haiku': {
    provider: 'anthropic',
    baseModel: 'claude-3-5-haiku-latest',
  },
  'claude-3-opus': { provider: 'anthropic', baseModel: 'claude-3-opus-latest' },
  // Gemini models
  'gemini-2.0-flash': {
    provider: 'google',
    baseModel: 'gemini-2.0-flash-latest',
  },
  'gemini-1.5-pro': { provider: 'google', baseModel: 'gemini-1.5-pro-latest' },
  'gemini-1.5-flash': {
    provider: 'google',
    baseModel: 'gemini-1.5-flash-latest',
  },
};

export function getProvider(pk: ProviderKey, model: string, key: string) {
  // Check if we have a specific configuration for this model
  const config = MODEL_CONFIGS[model];

  if (config) {
    // Use the configured provider and model
    switch (config.provider) {
      case 'google':
        return createGoogleGenerativeAI({ apiKey: key })(config.baseModel);
      case 'anthropic':
        return createAnthropic({ apiKey: key })(config.baseModel);
      case 'openai':
      default:
        return createOpenAI({ apiKey: key })(config.baseModel);
    }
  }

  // Fallback to direct model usage based on provider key
  switch (pk) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey: key })(model);
    case 'anthropic':
      return createAnthropic({ apiKey: key })(model);
    case 'openai':
    default:
      // For unknown o3-mini variants, convert to base o3-mini
      let actualModel = model;
      if (model.startsWith('o3-mini-')) {
        actualModel = 'o3-mini';
      }
      return createOpenAI({ apiKey: key })(actualModel);
  }
}

// Export model configs for use in message handling
export { MODEL_CONFIGS };
