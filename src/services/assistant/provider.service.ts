import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProviderKey } from '../../types/assistant.types';

// Model configurations with built-in capabilities for v5
const MODEL_CONFIGS: Record<string, any> = {
  // === OpenAI GPT-5.x family ===
  'gpt-5.2': { provider: 'openai', baseModel: 'gpt-5.2' },
  'gpt-5': { provider: 'openai', baseModel: 'gpt-5' },
  'gpt-5-mini': { provider: 'openai', baseModel: 'gpt-5-mini' },
  'gpt-5-nano': { provider: 'openai', baseModel: 'gpt-5-nano' },

  // === OpenAI GPT-4.x family ===
  'gpt-4.1': { provider: 'openai', baseModel: 'gpt-4.1' },
  'gpt-4.1-mini': { provider: 'openai', baseModel: 'gpt-4.1-mini' },
  'gpt-4.1-nano': { provider: 'openai', baseModel: 'gpt-4.1-nano' },
  'gpt-4o': { provider: 'openai', baseModel: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', baseModel: 'gpt-4o-mini' },
  'gpt-4-turbo': { provider: 'openai', baseModel: 'gpt-4-turbo' },
  'gpt-3.5-turbo': { provider: 'openai', baseModel: 'gpt-3.5-turbo' },

  // === Google Gemini 3 (preview) ===
  'gemini-3-pro-preview': {
    provider: 'google',
    baseModel: 'gemini-3-pro-preview',
  },
  'gemini-3-flash-preview': {
    provider: 'google',
    baseModel: 'gemini-3-flash-preview',
  },

  // === Google Gemini 2.5 (stable) ===
  'gemini-2.5-pro': { provider: 'google', baseModel: 'gemini-2.5-pro' },
  'gemini-2.5-flash': { provider: 'google', baseModel: 'gemini-2.5-flash' },
  'gemini-2.5-flash-lite': {
    provider: 'google',
    baseModel: 'gemini-2.5-flash-lite',
  },

  // === Google Gemini 2.0 (legacy) ===
  'gemini-2.0-flash': { provider: 'google', baseModel: 'gemini-2.0-flash' },

  // === Anthropic Claude 4.5 ===
  'claude-sonnet-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-sonnet-4-5-20250929',
  },
  'claude-haiku-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-haiku-4-5-20251001',
  },
  'claude-opus-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-opus-4-5-20251101',
  },

  // === Anthropic Claude 4.1 ===
  'claude-opus-4-1': {
    provider: 'anthropic',
    baseModel: 'claude-opus-4-1-20250805',
  },

  // === Anthropic Claude 4 ===
  'claude-sonnet-4-0': {
    provider: 'anthropic',
    baseModel: 'claude-sonnet-4-20250514',
  },
  'claude-opus-4-0': {
    provider: 'anthropic',
    baseModel: 'claude-opus-4-20250514',
  },

  // === Anthropic Claude 3 (legacy) ===
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    baseModel: 'claude-3-haiku-20240307',
  },
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    baseModel: 'claude-3-5-sonnet-latest',
  },
  'claude-3-5-haiku': {
    provider: 'anthropic',
    baseModel: 'claude-3-5-haiku-latest',
  },
  'claude-3-opus': { provider: 'anthropic', baseModel: 'claude-3-opus-latest' },
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
