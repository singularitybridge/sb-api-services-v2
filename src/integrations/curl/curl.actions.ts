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
        maxResponseChars: {
          type: 'number',
          description: 'Maximum number of characters to return in the response',
        },
      },
      required: ['curlCommand'],
      additionalProperties: false,
    },
    function: async (args: CurlRequestArgs) => {
      try {
        const { curlCommand, maxResponseChars } = args;

        // Call the service to perform the request
        const response = await performCurlRequest(context, curlCommand);

        // Create the result object with original status and data
        const result: CurlActionResponse & { success: boolean } = {
          status: response.status,
          data: response.data,
          headers: response.headers,
          success: response.status >= 200 && response.status < 300 // Set success based on HTTP status code
        };

        // Only handle truncation if specified
        if (maxResponseChars && typeof result.data === 'string') {
          if (result.data.length > maxResponseChars) {
            result.data = result.data.substring(0, maxResponseChars);
            result.truncated = true;
          }
        }

        return result;
      } catch (error: any) {
        console.error('performCurlRequest: Error performing request', error);
        throw error; // Let the error propagate up to be handled by the actions layer
      }
    },
  },
});
