import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProviderKey } from '../../types/assistant.types';

// Model configurations - Updated January 2026
// Based on latest available models from OpenAI, Anthropic, and Google
const MODEL_CONFIGS: Record<string, any> = {
  // === OpenAI GPT-5.2 (Latest - Late 2025) ===
  'gpt-5.2': { provider: 'openai', baseModel: 'gpt-5.2' },
  'gpt-5.2-pro': { provider: 'openai', baseModel: 'gpt-5.2-pro' },

  // === OpenAI GPT-5.1 ===
  'gpt-5.1': { provider: 'openai', baseModel: 'gpt-5.1' },

  // === OpenAI GPT-5 ===
  'gpt-5': { provider: 'openai', baseModel: 'gpt-5' },
  'gpt-5-mini': { provider: 'openai', baseModel: 'gpt-5-mini' },
  'gpt-5-nano': { provider: 'openai', baseModel: 'gpt-5-nano' },

  // === OpenAI O-Series Reasoning ===
  o3: { provider: 'openai', baseModel: 'o3' },
  'o3-pro': { provider: 'openai', baseModel: 'o3-pro' },
  'o4-mini': { provider: 'openai', baseModel: 'o4-mini' },
  'o3-mini': { provider: 'openai', baseModel: 'o3-mini' },

  // === OpenAI GPT-4.1 (Non-reasoning, 1M context) ===
  'gpt-4.1': { provider: 'openai', baseModel: 'gpt-4.1' },
  'gpt-4.1-mini': { provider: 'openai', baseModel: 'gpt-4.1-mini' },
  'gpt-4.1-nano': { provider: 'openai', baseModel: 'gpt-4.1-nano' },

  // === OpenAI GPT-4o (Legacy but still supported) ===
  'gpt-4o': { provider: 'openai', baseModel: 'gpt-4o' },
  'gpt-4o-mini': { provider: 'openai', baseModel: 'gpt-4o-mini' },

  // === Google Gemini 3 (Latest - Preview) ===
  'gemini-3-pro-preview': {
    provider: 'google',
    baseModel: 'gemini-3-pro-preview',
  },
  'gemini-3-flash-preview': {
    provider: 'google',
    baseModel: 'gemini-3-flash-preview',
  },

  // === Google Gemini 2.5 (Stable - Retiring Jun-Jul 2026) ===
  'gemini-2.5-pro': { provider: 'google', baseModel: 'gemini-2.5-pro' },
  'gemini-2.5-flash': { provider: 'google', baseModel: 'gemini-2.5-flash' },
  'gemini-2.5-flash-lite': {
    provider: 'google',
    baseModel: 'gemini-2.5-flash-lite',
  },

  // === Anthropic Claude 4.5 (Latest - Current) ===
  'claude-opus-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-opus-4-5-20251101',
  },
  'claude-sonnet-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-sonnet-4-5-20250929',
  },
  'claude-haiku-4-5': {
    provider: 'anthropic',
    baseModel: 'claude-haiku-4-5-20251001',
  },

  // === Anthropic Claude 4 (Legacy - Retiring May 2026) ===
  'claude-sonnet-4-0': {
    provider: 'anthropic',
    baseModel: 'claude-sonnet-4-20250514',
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
