import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { performPerplexitySearch as performPerplexitySearchService } from './perplexity.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import axios from 'axios';
import { TestConnectionResult } from '../../services/integration-config.service';

/**
 * Validate Perplexity connection with a minimal API call
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.perplexity_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'Perplexity API key is not configured',
    };
  }

  try {
    // Make a minimal API call with very short prompt
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      },
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        timeout: 10000,
      },
    );

    if (response.status === 200) {
      return {
        success: true,
        message: 'Connected successfully to Perplexity API',
      };
    }

    return {
      success: false,
      error: 'Unexpected response from Perplexity API',
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Invalid API key. Please check your Perplexity API key.',
      };
    }
    if (error.response?.status === 429) {
      return {
        success: true, // Key is valid, just rate limited
        message: 'API key is valid (rate limit reached)',
      };
    }
    return {
      success: false,
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to connect to Perplexity',
    };
  }
}

interface PerplexitySearchArgs {
  model:
    | 'sonar'
    | 'sonar-pro'
    | 'sonar-reasoning'
    | 'sonar-reasoning-pro'
    | 'sonar-deep-research';
  query: string;
  search_mode?: 'academic' | 'sec' | 'web';
  return_related_questions?: boolean;
  reasoning_effort?: 'low' | 'medium' | 'high';
}

// R type for StandardActionResult<R>
interface PerplexityResponseData {
  searchResult: string;
  relatedQuestions?: string[];
}

// S type for serviceCall lambda's response
interface ServiceCallLambdaResponse {
  success: boolean;
  data: PerplexityResponseData;
  description?: string;
}

const SERVICE_NAME = 'perplexityService';
const ALLOWED_MODELS = [
  'sonar',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-reasoning-pro',
  'sonar-deep-research',
];

export const createPerplexityActions = (
  context: ActionContext,
): FunctionFactory => ({
  perplexitySearch: {
    description: 'Perform a search using the Perplexity API',
    strict: true, // This implies additionalProperties: false is handled by a higher layer if strict mode is enforced
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          enum: ALLOWED_MODELS,
          description: 'The Perplexity model to use for the search',
        },
        query: {
          type: 'string',
          description: 'The search query',
        },
        search_mode: {
          type: 'string',
          enum: ['academic', 'sec', 'web'],
          description:
            'Search mode: academic (academic sources), sec (SEC filings), web (general web). Default: web',
        },
        return_related_questions: {
          type: 'boolean',
          description: 'Return related follow-up questions. Default: false',
        },
        reasoning_effort: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description:
            'Reasoning effort for sonar-deep-research model. Default: medium',
        },
      },
      required: ['model', 'query'],
      additionalProperties: false,
    },
    function: async (
      args: PerplexitySearchArgs,
    ): Promise<StandardActionResult<PerplexityResponseData>> => {
      const {
        model,
        query,
        search_mode = 'web',
        return_related_questions = false,
        reasoning_effort = 'medium',
      } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      // Parameter validation (already defined in schema, but good for explicit server-side check)
      if (model === undefined || query === undefined) {
        throw new ActionValidationError(
          'Both model and query parameters are required.',
        );
      }

      // Check for additional properties manually if strict mode isn't fully relied upon for arg shape
      const argKeys = Object.keys(args);
      const allowedProps = [
        'model',
        'query',
        'search_mode',
        'return_related_questions',
        'reasoning_effort',
      ];
      const extraProps = argKeys.filter((prop) => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        throw new ActionValidationError(
          `Additional properties are not allowed: ${extraProps.join(', ')}`,
        );
      }

      if (typeof model !== 'string' || !ALLOWED_MODELS.includes(model)) {
        throw new ActionValidationError(
          `The model must be one of: ${ALLOWED_MODELS.join(', ')}.`,
        );
      }

      if (typeof query !== 'string' || query.trim() === '') {
        throw new ActionValidationError(
          'The query must be a non-empty string.',
        );
      }

      return executeAction<PerplexityResponseData, ServiceCallLambdaResponse>(
        'perplexitySearch',
        async (): Promise<ServiceCallLambdaResponse> => {
          // performPerplexitySearchService throws on error or returns the search result
          const result = await performPerplexitySearchService(
            context.companyId!,
            model,
            query,
            search_mode,
            return_related_questions,
            reasoning_effort,
          );
          return { success: true, data: result };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        },
      );
    },
  },
});
