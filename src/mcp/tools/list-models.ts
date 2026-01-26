/**
 * List Models Tool
 *
 * Lists all available LLM models that can be used when creating or updating agents.
 * Models are grouped by provider (OpenAI, Anthropic, Google).
 */

import { z } from 'zod';
import { MODEL_CONFIGS } from '../../services/assistant/provider.service';
import { MODEL_PRICING } from '../../utils/cost-tracking';

/**
 * Input schema for the list_models tool
 */
export const listModelsSchema = z.object({
  provider: z
    .enum(['openai', 'anthropic', 'google'])
    .optional()
    .describe('Filter models by provider (optional)'),
});

export type ListModelsInput = z.infer<typeof listModelsSchema>;

interface ModelInfo {
  id: string;
  provider: 'openai' | 'anthropic' | 'google';
  baseModel: string;
  description: string;
  pricing: {
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
    inputCostFormatted: string;
    outputCostFormatted: string;
  };
}

// Model descriptions for better context
const MODEL_DESCRIPTIONS: Record<string, string> = {
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

  // Anthropic Claude 4 (Legacy)
  'claude-sonnet-4-0': 'Claude Sonnet 4.0 (Legacy, retiring May 2026)',
};

/**
 * List all available LLM models
 */
export async function listModels(
  input: ListModelsInput,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const models: ModelInfo[] = [];

    for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
      // Filter by provider if specified
      if (input.provider && config.provider !== input.provider) {
        continue;
      }

      // Get pricing - try baseModel first (for full model names), then modelId, then default
      const pricing =
        MODEL_PRICING[config.baseModel] ||
        MODEL_PRICING[modelId] ||
        MODEL_PRICING['default'];

      models.push({
        id: modelId,
        provider: config.provider,
        baseModel: config.baseModel,
        description: MODEL_DESCRIPTIONS[modelId] || modelId,
        pricing: {
          inputCostPer1kTokens: pricing.inputCost,
          outputCostPer1kTokens: pricing.outputCost,
          inputCostFormatted: `$${pricing.inputCost.toFixed(5)}/1K tokens`,
          outputCostFormatted: `$${pricing.outputCost.toFixed(5)}/1K tokens`,
        },
      });
    }

    // Group by provider for better organization
    const grouped = {
      openai: models.filter((m) => m.provider === 'openai'),
      anthropic: models.filter((m) => m.provider === 'anthropic'),
      google: models.filter((m) => m.provider === 'google'),
    };

    // Build response based on filter
    const response = input.provider
      ? {
          provider: input.provider,
          models: grouped[input.provider],
          count: grouped[input.provider].length,
        }
      : {
          models: grouped,
          count: models.length,
          byProvider: {
            openai: grouped.openai.length,
            anthropic: grouped.anthropic.length,
            google: grouped.google.length,
          },
        };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('MCP list models error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to list models',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const listModelsTool = {
  name: 'list_models',
  description:
    "List all available LLM models that can be used when creating or updating agents. Returns models grouped by provider (OpenAI, Anthropic, Google) with their IDs, base model names, descriptions, and pricing (cost per 1K tokens for input/output). Use the model ID when setting an agent's llmModel field.",
  inputSchema: listModelsSchema,
};
