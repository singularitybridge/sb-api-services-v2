import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ProviderKey } from '../../types/assistant.types';

// Model configurations - Updated February 2026
// Based on latest available models from OpenAI, Anthropic, Google, and OpenRouter
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

  // === Anthropic Claude 4 ===
  'claude-opus-4-1': {
    provider: 'anthropic',
    baseModel: 'claude-opus-4-1-20250514',
  },
  'claude-sonnet-4-0': {
    provider: 'anthropic',
    baseModel: 'claude-sonnet-4-20250514',
  },

  // === OpenRouter — Meta Llama 4 ===
  'meta-llama/llama-4-maverick': {
    provider: 'openrouter',
    baseModel: 'meta-llama/llama-4-maverick',
  },
  'meta-llama/llama-4-scout': {
    provider: 'openrouter',
    baseModel: 'meta-llama/llama-4-scout',
  },

  // === OpenRouter — DeepSeek ===
  'deepseek/deepseek-chat-v3-0324': {
    provider: 'openrouter',
    baseModel: 'deepseek/deepseek-chat-v3-0324',
  },
  'deepseek/deepseek-r1': {
    provider: 'openrouter',
    baseModel: 'deepseek/deepseek-r1',
  },

  // === OpenRouter — Mistral ===
  'mistralai/mistral-large': {
    provider: 'openrouter',
    baseModel: 'mistralai/mistral-large',
  },
  'mistralai/codestral': {
    provider: 'openrouter',
    baseModel: 'mistralai/codestral',
  },

  // === OpenRouter — Qwen ===
  'qwen/qwen3-235b-a22b': {
    provider: 'openrouter',
    baseModel: 'qwen/qwen3-235b-a22b',
  },
  'qwen/qwen3-30b-a3b': {
    provider: 'openrouter',
    baseModel: 'qwen/qwen3-30b-a3b',
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
      case 'openrouter':
        return createOpenAI({
          apiKey: key,
          baseURL: 'https://openrouter.ai/api/v1',
          headers: {
            'HTTP-Referer': 'https://singularitybridge.net',
            'X-Title': 'Agent Hub',
          },
        })(config.baseModel);
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
    case 'openrouter':
      return createOpenAI({
        apiKey: key,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': 'https://singularitybridge.net',
          'X-Title': 'Agent Hub',
        },
      })(model);
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

// Model descriptions for API/UI display
export const MODEL_DESCRIPTIONS: Record<string, string> = {
  // OpenAI GPT-5.2
  'gpt-5.2': 'Latest GPT-5.2 model (Late 2025)',
  'gpt-5.2-pro': 'GPT-5.2 Pro - enhanced capabilities',

  // OpenAI GPT-5.1
  'gpt-5.1': 'GPT-5.1 model',

  // OpenAI GPT-5
  'gpt-5': 'GPT-5 base model',
  'gpt-5-mini': 'GPT-5 Mini - faster, cheaper',
  'gpt-5-nano': 'GPT-5 Nano - smallest, fastest',

  // OpenAI O-Series
  o3: 'O3 reasoning model',
  'o3-pro': 'O3 Pro - advanced reasoning',
  'o4-mini': 'O4 Mini - fast reasoning',
  'o3-mini': 'O3 Mini - compact reasoning',

  // OpenAI GPT-4.1
  'gpt-4.1': 'GPT-4.1 with 1M context',
  'gpt-4.1-mini': 'GPT-4.1 Mini',
  'gpt-4.1-nano': 'GPT-4.1 Nano',

  // OpenAI GPT-4o (Legacy)
  'gpt-4o': 'GPT-4o (legacy, still supported)',
  'gpt-4o-mini': 'GPT-4o Mini (legacy, still supported)',

  // Google Gemini 3
  'gemini-3-pro-preview': 'Gemini 3 Pro (Preview)',
  'gemini-3-flash-preview': 'Gemini 3 Flash (Preview) - fast',

  // Google Gemini 2.5
  'gemini-2.5-pro': 'Gemini 2.5 Pro (Stable)',
  'gemini-2.5-flash': 'Gemini 2.5 Flash (Stable) - fast',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite - fastest',

  // Anthropic Claude 4.5
  'claude-opus-4-5': 'Claude Opus 4.5 - most capable',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5 - balanced',
  'claude-haiku-4-5': 'Claude Haiku 4.5 - fast',

  // Anthropic Claude 4
  'claude-opus-4-1': 'Claude Opus 4.1 - powerful reasoning',
  'claude-sonnet-4-0': 'Claude Sonnet 4.0 (Legacy, retiring May 2026)',

  // OpenRouter — Meta Llama 4
  'meta-llama/llama-4-maverick': 'Llama 4 Maverick - 400B MoE, multimodal',
  'meta-llama/llama-4-scout': 'Llama 4 Scout - 109B MoE, 10M context',

  // OpenRouter — DeepSeek
  'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3 - strong general model',
  'deepseek/deepseek-r1': 'DeepSeek R1 - reasoning model',

  // OpenRouter — Mistral
  'mistralai/mistral-large': 'Mistral Large - 123B flagship',
  'mistralai/codestral': 'Codestral - code-specialized',

  // OpenRouter — Qwen
  'qwen/qwen3-235b-a22b': 'Qwen3 235B - largest Qwen model',
  'qwen/qwen3-30b-a3b': 'Qwen3 30B - efficient MoE',
};

// Default model per provider
export const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-5.1',
  google: 'gemini-3-flash-preview',
  anthropic: 'claude-sonnet-4-5',
  openrouter: 'meta-llama/llama-4-maverick',
};

// Model display labels
export const MODEL_LABELS: Record<string, string> = {
  'gpt-5.2': 'GPT-5.2',
  'gpt-5.2-pro': 'GPT-5.2 Pro',
  'gpt-5.1': 'GPT-5.1',
  'gpt-5': 'GPT-5',
  'gpt-5-mini': 'GPT-5 Mini',
  'gpt-5-nano': 'GPT-5 Nano',
  o3: 'O3',
  'o3-pro': 'O3 Pro',
  'o4-mini': 'O4 Mini',
  'o3-mini': 'O3 Mini',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4.1-mini': 'GPT-4.1 Mini',
  'gpt-4.1-nano': 'GPT-4.1 Nano',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gemini-3-pro-preview': 'Gemini 3 Pro (preview)',
  'gemini-3-flash-preview': 'Gemini 3 Flash (preview)',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
  'claude-opus-4-5': 'Claude Opus 4.5',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-opus-4-1': 'Claude Opus 4.1',
  'claude-sonnet-4-0': 'Claude Sonnet 4',

  // OpenRouter
  'meta-llama/llama-4-maverick': 'Llama 4 Maverick',
  'meta-llama/llama-4-scout': 'Llama 4 Scout',
  'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3',
  'deepseek/deepseek-r1': 'DeepSeek R1',
  'mistralai/mistral-large': 'Mistral Large',
  'mistralai/codestral': 'Codestral',
  'qwen/qwen3-235b-a22b': 'Qwen3 235B',
  'qwen/qwen3-30b-a3b': 'Qwen3 30B',
};

// Models kept in MODEL_CONFIGS for backward compatibility (existing assistants)
// but excluded from the /api/models listing and UI dropdowns.
export const LEGACY_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-0',
]);

// Export model configs for use in message handling
export { MODEL_CONFIGS };
