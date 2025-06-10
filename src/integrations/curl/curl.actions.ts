import { ActionContext, FunctionFactory } from '../actions/types';
import { performCurlRequest } from './curl.service';

interface CurlRequestArgs {
  curlCommand: string;
}

export interface CurlActionResponse {
  status: number;
  data: any;
  headers: { [key: string]: string };
  error?: string;
  truncated?: boolean;
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
      },
      required: ['curlCommand'],
      additionalProperties: false,
    },
    function: async (args: CurlRequestArgs) => {
      try {
        const { curlCommand } = args;

        // Call the service to perform the request
        const response = await performCurlRequest(context, curlCommand);

        // Create the result object with original status and data
        const result: CurlActionResponse & { success: boolean } = {
          status: response.status,
          data: response.data,
          headers: response.headers, // Note: service currently always returns {}
          error: response.error,   // Propagate error from service response
          truncated: false,          // Initialize truncated to false
          success: response.status >= 200 && response.status < 300 && !response.error // Success if 2xx and no explicit error from service
        };

        return result;
      } catch (error: any) {
        console.error('performCurlRequest: Error performing request', error);
        return {
          status: 500,
          data: null,
          headers: {},
          error: error.message || 'An unexpected error occurred performing curl request',
          success: false,
          truncated: false, // Ensure truncated is always present
        };
      }
    },
  },
});
