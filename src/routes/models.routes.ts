import { Router, Request, Response } from 'express';
import {
  MODEL_CONFIGS,
  MODEL_DESCRIPTIONS,
  MODEL_LABELS,
  DEFAULT_MODELS,
  LEGACY_MODELS,
} from '../services/assistant/provider.service';
import { MODEL_PRICING } from '../utils/cost-tracking';

const modelsRouter = Router();

interface ModelEntry {
  id: string;
  label: string;
  description: string;
  pricing: {
    inputCostPer1kTokens: number;
    outputCostPer1kTokens: number;
  };
}

modelsRouter.get('/', (req: Request, res: Response) => {
  const providerFilter = req.query.provider as string | undefined;

  const grouped: Record<string, ModelEntry[]> = {
    openai: [],
    google: [],
    anthropic: [],
    openrouter: [],
  };

  for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
    if (LEGACY_MODELS.has(modelId)) continue;
    if (providerFilter && config.provider !== providerFilter) {
      continue;
    }

    const pricing =
      MODEL_PRICING[config.baseModel] ||
      MODEL_PRICING[modelId] ||
      MODEL_PRICING['default'];

    const entry: ModelEntry = {
      id: modelId,
      label: MODEL_LABELS[modelId] || modelId,
      description: MODEL_DESCRIPTIONS[modelId] || modelId,
      pricing: {
        inputCostPer1kTokens: pricing.inputCost,
        outputCostPer1kTokens: pricing.outputCost,
      },
    };

    if (!grouped[config.provider]) {
      grouped[config.provider] = [];
    }
    grouped[config.provider].push(entry);
  }

  const providers = Object.keys(grouped).filter(
    (p) => grouped[p].length > 0,
  );

  res.json({
    providers,
    models: grouped,
    defaults: providerFilter
      ? { [providerFilter]: DEFAULT_MODELS[providerFilter] }
      : DEFAULT_MODELS,
  });
});

export { modelsRouter };
