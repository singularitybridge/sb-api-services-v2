import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import { performPerplexitySearch as performPerplexitySearchService } from './perplexity.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface PerplexitySearchArgs {
  model: 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online';
  query: string;
  // No other properties allowed due to additionalProperties: false in schema
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
const ALLOWED_MODELS = ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'];

export const createPerplexityActions = (context: ActionContext): FunctionFactory => ({
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
      additionalProperties: false, // Explicitly defined here
    },
    function: async (args: PerplexitySearchArgs): Promise<StandardActionResult<PerplexityResponseData>> => {
      const { model, query } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      // Parameter validation (already defined in schema, but good for explicit server-side check)
      if (model === undefined || query === undefined) {
        throw new ActionValidationError('Both model and query parameters are required.');
      }
      
      // Check for additional properties manually if strict mode isn't fully relied upon for arg shape
      const argKeys = Object.keys(args);
      if (argKeys.length > 2 || !argKeys.every(key => ['model', 'query'].includes(key))) {
          const allowedProps = ['model', 'query'];
          const extraProps = argKeys.filter(prop => !allowedProps.includes(prop));
          if (extraProps.length > 0) {
            throw new ActionValidationError(`Additional properties are not allowed: ${extraProps.join(', ')}`);
          }
      }
      
      if (typeof model !== 'string' || !ALLOWED_MODELS.includes(model)) {
        throw new ActionValidationError(`The model must be one of: ${ALLOWED_MODELS.join(', ')}.`);
      }

      if (typeof query !== 'string' || query.trim() === '') {
        throw new ActionValidationError('The query must be a non-empty string.');
      }

      return executeAction<PerplexityResponseData, ServiceCallLambdaResponse>(
        'perplexitySearch',
        async (): Promise<ServiceCallLambdaResponse> => {
          // performPerplexitySearchService throws on error or returns the search result string
          const searchResultString = await performPerplexitySearchService(context.companyId!, model, query);
          return { success: true, data: { searchResult: searchResultString } };
        },
        { 
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        }
      );
    },
  },
});
