// Cost tracking utility for AI model usage
// Prices are in USD per 1000 tokens

interface ModelPricing {
  inputCost: number; // Cost per 1000 input tokens
  outputCost: number; // Cost per 1000 output tokens
}

// Pricing as of January 2025 (subject to change)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4o': { inputCost: 0.0025, outputCost: 0.01 },
  'gpt-4o-mini': { inputCost: 0.00015, outputCost: 0.0006 },
  'gpt-4-turbo': { inputCost: 0.01, outputCost: 0.03 },
  'gpt-4': { inputCost: 0.03, outputCost: 0.06 },
  'gpt-3.5-turbo': { inputCost: 0.0005, outputCost: 0.0015 },
  'gpt-4o-2024-08-06': { inputCost: 0.0025, outputCost: 0.01 },

  // O3 Models (estimated based on your actual costs - these are expensive!)
  'o3-mini': { inputCost: 0.001, outputCost: 0.002 }, // Estimated, adjust based on actual pricing
  'o3-mini-high': { inputCost: 0.001, outputCost: 0.002 }, // Your log shows ~$0.001/1k input, ~$0.002/1k output
  o3: { inputCost: 0.015, outputCost: 0.06 }, // Estimated for full O3 model

  // Anthropic Models
  'claude-3-5-sonnet-20241022': { inputCost: 0.003, outputCost: 0.015 },
  'claude-3-5-haiku-20241022': { inputCost: 0.001, outputCost: 0.005 },
  'claude-3-opus-20240229': { inputCost: 0.015, outputCost: 0.075 },
  'claude-3-sonnet-20240229': { inputCost: 0.003, outputCost: 0.015 },
  'claude-3-haiku-20240307': { inputCost: 0.00025, outputCost: 0.00125 },

  // Google Models
  'gemini-1.5-pro': { inputCost: 0.00125, outputCost: 0.005 },
  'gemini-1.5-flash': { inputCost: 0.000075, outputCost: 0.0003 },
  'gemini-1.5-flash-8b': { inputCost: 0.0000375, outputCost: 0.00015 },
  'gemini-2.0-flash-exp': { inputCost: 0.000075, outputCost: 0.0003 },

  // Add default pricing for unknown models
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

  console.log(`[COST_TRACKING] AI Request:`, JSON.stringify(costInfo, null, 2));

  // Log a summary line for easy grepping
  console.log(
    `[COST_TRACKING_SUMMARY] Company: ${info.companyId} | Assistant: ${
      info.assistantId
    } | Model: ${info.model} | Cost: $${info.totalCost.toFixed(6)} | Tokens: ${
      info.totalTokens
    }`,
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
