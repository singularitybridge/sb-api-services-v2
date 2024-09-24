import { ActionContext, FunctionFactory } from '../actions/types';
import { performPerplexitySearch } from './perplexity.service';

interface PerplexitySearchArgs {
  model: 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online';
  query: string;
}

export const createPerplexityActions = (context: ActionContext): FunctionFactory => ({
  perplexitySearch: {
    description: 'Perform a search using the Perplexity API',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          enum: ['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'],
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
    function: async (args: PerplexitySearchArgs) => {
      console.log('perplexitySearch called with arguments:', JSON.stringify(args, null, 2));

      const { model, query } = args;

      // Check if all required properties are present
      if (model === undefined || query === undefined) {
        console.error('perplexitySearch: Missing required parameter');
        return {
          error: 'Missing parameter',
          message: 'Both model and query parameters are required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['model', 'query'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('perplexitySearch: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      // Verify that model is a string and one of the allowed values
      if (typeof model !== 'string' || !['llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-large-128k-online'].includes(model)) {
        console.error('perplexitySearch: Invalid model', model);
        return {
          error: 'Invalid model',
          message: 'The model must be either "llama-3.1-sonar-small-128k-online" or "llama-3.1-sonar-large-128k-online".',
        };
      }

      // Verify that query is a string
      if (typeof query !== 'string') {
        console.error('perplexitySearch: Invalid query type', typeof query);
        return {
          error: 'Invalid query',
          message: 'The query must be a string.',
        };
      }

      try {
        console.log('perplexitySearch: Calling performPerplexitySearch service');
        const result = await performPerplexitySearch(context.companyId, model, query);
        return { result };
      } catch (error) {
        console.error('perplexitySearch: Error performing search', error);
        return {
          error: 'Search failed',
          message: 'Failed to perform the search using Perplexity API.',
        };
      }
    },
  },
});