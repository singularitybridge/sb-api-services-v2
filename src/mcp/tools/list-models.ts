/**
 * List Models Tool
 *
 * Lists all available LLM models that can be used when creating or updating agents.
 * Models are grouped by provider (OpenAI, Anthropic, Google).
 */

import { z } from 'zod';
import {
  MODEL_CONFIGS,
  MODEL_DESCRIPTIONS as SHARED_DESCRIPTIONS,
  LEGACY_MODELS,
} from '../../services/assistant/provider.service';
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

const MODEL_DESCRIPTIONS = SHARED_DESCRIPTIONS;

/**
 * List all available LLM models
 */
export async function listModels(
  input: ListModelsInput,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const models: ModelInfo[] = [];

    for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
      if (LEGACY_MODELS.has(modelId)) continue;
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
