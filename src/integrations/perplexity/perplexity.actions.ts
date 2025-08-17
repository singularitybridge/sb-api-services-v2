import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { performPerplexitySearch as performPerplexitySearchService } from './perplexity.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface PerplexitySearchArgs {
  model:
    | 'sonar'
    | 'sonar-pro'
    | 'sonar-reasoning'
    | 'sonar-reasoning-pro'
    | 'sonar-deep-research';
  query: string;
  // searchMode deprecated - removed to avoid API errors
}

// R type for StandardActionResult<R>
interface PerplexityResponseData {
  searchResult: string;
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
      },
      required: ['model', 'query'],
      additionalProperties: false,
    },
    function: async (
      args: PerplexitySearchArgs,
    ): Promise<StandardActionResult<PerplexityResponseData>> => {
      const { model, query } = args;

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
      const allowedProps = ['model', 'query'];
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
          // performPerplexitySearchService throws on error or returns the search result string
          const searchResultString = await performPerplexitySearchService(
            context.companyId!,
            model,
            query,
          );
          return { success: true, data: { searchResult: searchResultString } };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        },
      );
    },
  },
});
