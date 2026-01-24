// Cost tracking utility for AI model usage
// Prices are in USD per 1000 tokens

export interface ModelPricing {
  inputCost: number; // Cost per 1000 input tokens
  outputCost: number; // Cost per 1000 output tokens
}

// Pricing last validated: 2026-01-24 (source: Perplexity research + official docs)
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
  'o3': { inputCost: 0.002, outputCost: 0.008 },
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

  // === Anthropic Claude 4.5 (Current) ===
  'claude-opus-4-5-20251101': { inputCost: 0.005, outputCost: 0.025 },
  'claude-sonnet-4-5-20250929': { inputCost: 0.003, outputCost: 0.015 },
  'claude-haiku-4-5-20251001': { inputCost: 0.001, outputCost: 0.005 },

  // === Anthropic Claude 4 (Legacy) ===
  'claude-sonnet-4-20250514': { inputCost: 0.003, outputCost: 0.015 },

  // === Google Gemini 3 (Preview) ===
  'gemini-3-pro-preview': { inputCost: 0.00125, outputCost: 0.01 },
  'gemini-3-flash-preview': { inputCost: 0.0003, outputCost: 0.0025 },

  // === Google Gemini 2.5 (Stable) ===
  'gemini-2.5-pro': { inputCost: 0.00125, outputCost: 0.01 },
  'gemini-2.5-flash': { inputCost: 0.0003, outputCost: 0.0025 },
  'gemini-2.5-flash-lite': { inputCost: 0.00015, outputCost: 0.001 },

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

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];

  const inputCost = (inputTokens / 1000) * pricing.inputCost;
  const outputCost = (outputTokens / 1000) * pricing.outputCost;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
  };
}

import { saveCostTracking } from '../services/cost-tracking.service';

export async function logCostTracking(info: CostTrackingInfo): Promise<void> {
  const costInfo = {
    ...info,
    inputCostFormatted: `$${info.inputCost.toFixed(6)}`,
    outputCostFormatted: `$${info.outputCost.toFixed(6)}`,
    totalCostFormatted: `$${info.totalCost.toFixed(6)}`,
    durationSeconds: info.duration
      ? (info.duration / 1000).toFixed(2)
      : undefined,
  };

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

export function formatCostMessage(info: CostTrackingInfo): string {
  return `AI Usage - Model: ${info.model}, Input: ${
    info.inputTokens
  } tokens ($${info.inputCost.toFixed(6)}), Output: ${
    info.outputTokens
  } tokens ($${info.outputCost.toFixed(6)}), Total: $${info.totalCost.toFixed(
    6,
  )}`;
}
