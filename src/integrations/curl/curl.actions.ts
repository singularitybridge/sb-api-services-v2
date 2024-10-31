import { ActionContext, FunctionFactory } from '../actions/types';
import { performCurlRequest } from './curl.service';

interface CurlRequestArgs {
  curlCommand: string;
  maxResponseChars?: number;
}

export interface CurlActionResponse {
  status: number;
  data: any;
  headers: { [key: string]: string };
  error?: string;
}

export const createCurlActions = (context: ActionContext): FunctionFactory => ({
  performCurlRequest: {
    description: 'Execute a curl command',
    parameters: {
      type: 'object',
      properties: {
        curlCommand: {
          type: 'string',
          description: 'The complete curl command to execute',
        },
        maxResponseChars: {
          type: 'number',
          description: 'Maximum number of characters to return in the response',
        },
      },
      required: ['curlCommand'],
      additionalProperties: false,
    },
    function: async (args: CurlRequestArgs): Promise<CurlActionResponse> => {
      try {
        const { curlCommand, maxResponseChars } = args;

        // Call the service to perform the request
        const response = await performCurlRequest(context, curlCommand);

        // Create the result object
        const result: CurlActionResponse = {
          status: response.status,
          data: response.data,
          headers: response.headers
        };

        // If maxResponseChars is specified, truncate the response data
        if (maxResponseChars && typeof result.data === 'string' && result.data.length > maxResponseChars) {
          result.data = result.data.substring(0, maxResponseChars) + '...';
        }

        // Only set error if HTTP status indicates an error
        if (response.status >= 400) {
          result.error = response.error;
        }

        return result;
      } catch (error: any) {
        console.error('performCurlRequest: Error performing request', error);
        return {
          status: 500,
          data: null,
          headers: {},
          error: `Request failed: ${error.message || 'An unexpected error occurred'}`
        };
      }
    },
  },
});
