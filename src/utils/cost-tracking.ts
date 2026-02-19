// Cost tracking utility for AI model usage
// Prices are in USD per 1000 tokens

export interface ModelPricing {
  inputCost: number; // Cost per 1000 input tokens
  outputCost: number; // Cost per 1000 output tokens
}

// Pricing last validated: 2026-02-18 (source: OpenRouter API + Perplexity research + official docs)
// To update: run pricing-validator agent or check CLAUDE.md "Monthly Task: Pricing Validation"
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // === OpenAI GPT-5.2 (Latest) ===
  'gpt-5.2': { inputCost: 0.00175, outputCost: 0.014 },
  'gpt-5.2-pro': { inputCost: 0.021, outputCost: 0.168 },

  // === OpenAI GPT-5.1 ===
  'gpt-5.1': { inputCost: 0.00125, outputCost: 0.01 },

  // === OpenAI GPT-5 ===
  'gpt-5': { inputCost: 0.00125, outputCost: 0.01 },
  'gpt-5-mini': { inputCost: 0.00025, outputCost: 0.002 },
  'gpt-5-nano': { inputCost: 0.00005, outputCost: 0.0004 },

  // === OpenAI O-Series Reasoning ===
  o3: { inputCost: 0.002, outputCost: 0.008 },
  'o3-pro': { inputCost: 0.02, outputCost: 0.08 },
  'o4-mini': { inputCost: 0.0011, outputCost: 0.0044 },
  'o3-mini': { inputCost: 0.0011, outputCost: 0.0044 },

  // === OpenAI GPT-4.1 ===
  'gpt-4.1': { inputCost: 0.0025, outputCost: 0.01 },
  'gpt-4.1-mini': { inputCost: 0.00005, outputCost: 0.0002 },
  'gpt-4.1-nano': { inputCost: 0.0001, outputCost: 0.0004 },

  // === OpenAI GPT-4o (Legacy) ===
  'gpt-4o': { inputCost: 0.0025, outputCost: 0.01 },
  'gpt-4o-mini': { inputCost: 0.00015, outputCost: 0.0006 },

  // === Anthropic Claude 4.6 (Current) ===
  'claude-opus-4-6': { inputCost: 0.005, outputCost: 0.025 },
  'claude-sonnet-4-6': { inputCost: 0.003, outputCost: 0.015 },

  // === Anthropic Claude 4.5 (Legacy) — both date-stamped and short names ===
  'claude-opus-4-5-20251101': { inputCost: 0.005, outputCost: 0.025 },
  'claude-opus-4-5': { inputCost: 0.005, outputCost: 0.025 },
  'claude-sonnet-4-5-20250929': { inputCost: 0.003, outputCost: 0.015 },
  'claude-sonnet-4-5': { inputCost: 0.003, outputCost: 0.015 },
  'claude-haiku-4-5-20251001': { inputCost: 0.001, outputCost: 0.005 },
  'claude-haiku-4-5': { inputCost: 0.001, outputCost: 0.005 },

  // === Anthropic Claude 4 (Legacy) ===
  'claude-opus-4-1-20250514': { inputCost: 0.005, outputCost: 0.025 },
  'claude-opus-4-1': { inputCost: 0.005, outputCost: 0.025 },
  'claude-sonnet-4-20250514': { inputCost: 0.003, outputCost: 0.015 },
  'claude-sonnet-4': { inputCost: 0.003, outputCost: 0.015 },

  // === Google Gemini 3 (Preview) — both plain and models/-prefixed ===
  'gemini-3-pro-preview': { inputCost: 0.00125, outputCost: 0.01 },
  'models/gemini-3-pro-preview': { inputCost: 0.00125, outputCost: 0.01 },
  'gemini-3-flash-preview': { inputCost: 0.0005, outputCost: 0.003 },
  'models/gemini-3-flash-preview': { inputCost: 0.0005, outputCost: 0.003 },

  // === Google Gemini 2.5 (Stable) — both plain and models/-prefixed ===
  'gemini-2.5-pro': { inputCost: 0.00125, outputCost: 0.01 },
  'models/gemini-2.5-pro': { inputCost: 0.00125, outputCost: 0.01 },
  'gemini-2.5-flash': { inputCost: 0.0003, outputCost: 0.0025 },
  'models/gemini-2.5-flash': { inputCost: 0.0003, outputCost: 0.0025 },
  'gemini-2.5-flash-lite': { inputCost: 0.00015, outputCost: 0.001 },
  'models/gemini-2.5-flash-lite': { inputCost: 0.00015, outputCost: 0.001 },

  // === OpenRouter Models (verified 2026-02-13 against openrouter.ai/api/v1/models) ===
  'meta-llama/llama-4-maverick': { inputCost: 0.00015, outputCost: 0.0006 },
  'meta-llama/llama-4-scout': { inputCost: 0.00008, outputCost: 0.0003 },
  'deepseek/deepseek-v3.2': { inputCost: 0.00025, outputCost: 0.00038 },
  'deepseek/deepseek-r1-0528': { inputCost: 0.0004, outputCost: 0.00175 },
  'deepseek/deepseek-chat-v3-0324': { inputCost: 0.00019, outputCost: 0.00087 },
  'deepseek/deepseek-r1': { inputCost: 0.0007, outputCost: 0.0025 },
  'mistralai/mistral-large-2512': { inputCost: 0.0005, outputCost: 0.0015 },
  'mistralai/codestral-2508': { inputCost: 0.0003, outputCost: 0.0009 },
  'mistralai/mistral-large': { inputCost: 0.002, outputCost: 0.006 },
  'mistralai/codestral': { inputCost: 0.0003, outputCost: 0.0009 },
  'qwen/qwen3-235b-a22b': { inputCost: 0.0003, outputCost: 0.0012 },
  'qwen/qwen3-30b-a3b': { inputCost: 0.00006, outputCost: 0.00022 },
  'qwen/qwen3-coder': { inputCost: 0.00022, outputCost: 0.001 },
  'moonshotai/kimi-k2.5': { inputCost: 0.00045, outputCost: 0.00225 },
  'z-ai/glm-5': { inputCost: 0.0008, outputCost: 0.00256 },

  // Default pricing for unknown models
  default: { inputCost: 0.001, outputCost: 0.002 },
};

export interface CostTrackingInfo {
  companyId: string;
  assistantId: string;
  sessionId: string;
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: Date;
  duration?: number; // Duration in milliseconds
  toolCalls?: number; // Number of tool calls made
  cached?: boolean; // Whether cached tokens were used
  requestType?: 'streaming' | 'non-streaming' | 'stateless';
}

// Dynamic pricing overrides (populated from OpenRouter API at startup)
const dynamicPricing: Record<string, ModelPricing> = {};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  // Dynamic pricing (from OpenRouter API) takes priority over hardcoded
  const pricing =
    dynamicPricing[model] || MODEL_PRICING[model] || MODEL_PRICING['default'];

  const inputCost = (inputTokens / 1000) * pricing.inputCost;
  const outputCost = (outputTokens / 1000) * pricing.outputCost;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
  };
}

/**
 * Fetch live pricing from OpenRouter's /api/v1/models endpoint.
 * Updates dynamicPricing map for all OpenRouter models.
 * Called at startup and refreshed every 24 hours.
 */
export async function refreshOpenRouterPricing(): Promise<void> {
  try {
    const axios = (await import('axios')).default;
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      timeout: 15000,
    });

    const models = response.data?.data;
    if (!Array.isArray(models)) return;

    let updated = 0;
    for (const m of models) {
      const pricing = m.pricing;
      if (!pricing?.prompt || !pricing?.completion) continue;

      // OpenRouter returns per-token pricing; convert to per-1K tokens
      const inputCost = parseFloat(pricing.prompt) * 1000;
      const outputCost = parseFloat(pricing.completion) * 1000;

      if (inputCost >= 0 && outputCost >= 0) {
        dynamicPricing[m.id] = { inputCost, outputCost };
        updated++;
      }
    }

    console.log(
      `[COST_TRACKING] OpenRouter pricing refreshed: ${updated} models updated`,
    );
  } catch (error: any) {
    console.warn(
      `[COST_TRACKING] Failed to fetch OpenRouter pricing: ${error.message}`,
    );
    // Non-fatal — hardcoded prices will be used as fallback
  }
}

export function startPricingRefresh(): void {
  // Initial fetch
  refreshOpenRouterPricing();
  // Refresh every 24h
  setInterval(refreshOpenRouterPricing, 24 * 60 * 60 * 1000);
}

import { saveCostTracking } from '../services/cost-tracking.service';

export async function logCostTracking(info: CostTrackingInfo): Promise<void> {
  // Simplified cost tracking log - single line, less verbose
  console.log(
    `[COST] ${info.model}: $${info.totalCost.toFixed(4)} (${info.totalTokens} tokens)`,
  );

  // Save to MongoDB
  try {
    await saveCostTracking(info);
  } catch (error) {
    console.error('[COST_TRACKING] Failed to save to database:', error);
    // Don't throw - we don't want to break the request if cost tracking fails
  }
}

// Perplexity Sonar model pricing (USD per 1000 tokens)
// Source: https://docs.perplexity.ai/docs/pricing
const PERPLEXITY_PRICING: Record<string, ModelPricing> = {
  sonar: { inputCost: 0.001, outputCost: 0.001 },
  'sonar-pro': { inputCost: 0.003, outputCost: 0.015 },
  'sonar-reasoning': { inputCost: 0.001, outputCost: 0.005 },
  'sonar-reasoning-pro': { inputCost: 0.002, outputCost: 0.008 },
  'sonar-deep-research': { inputCost: 0.002, outputCost: 0.008 },
};

export function calculatePerplexityCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PERPLEXITY_PRICING[model] || PERPLEXITY_PRICING['sonar'];
  const inputCost = (inputTokens / 1000) * pricing.inputCost;
  const outputCost = (outputTokens / 1000) * pricing.outputCost;
  return parseFloat((inputCost + outputCost).toFixed(6));
}

// Google Maps Platform pricing (USD per request)
// Source: https://developers.google.com/maps/billing-and-pricing/pricing
// Prices reflect standard (non-discounted) SKU rates
const GOOGLE_MAPS_PRICING: Record<string, number> = {
  'places-text-search': 0.032,        // Text Search
  'place-details': 0.017,             // Place Details (Basic + Contact + Atmosphere)
  'place-photos': 0.007,              // Place Photos
  'nearby-search': 0.032,             // Nearby Search
  'directions': 0.01,                 // Routes: Compute Routes
  'geocoding': 0.005,                 // Geocoding
  'reverse-geocoding': 0.005,         // Reverse Geocoding
  'distance-matrix': 0.01,            // Distance Matrix (per element)
  'timezone': 0.005,                  // Timezone
  'static-map': 0.002,               // Static Maps
  'street-view': 0.007,              // Street View Static
};

export function calculateGoogleMapsCost(
  apiEndpoint: string,
  units: number = 1,
): number {
  const baseCost = GOOGLE_MAPS_PRICING[apiEndpoint] || 0;
  return parseFloat((baseCost * units).toFixed(6));
}

export function formatCostMessage(info: CostTrackingInfo): string {
  return `AI Usage - Model: ${info.model}, Input: ${
    info.inputTokens
  } tokens ($${info.inputCost.toFixed(6)}), Output: ${
    info.outputTokens
  } tokens ($${info.outputCost.toFixed(6)}), Total: $${info.totalCost.toFixed(
    6,
  )}`;
}
