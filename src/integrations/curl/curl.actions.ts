import { ActionContext, FunctionFactory } from '../actions/types';
import { performCurlRequest } from './curl.service';

interface CurlRequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: { [key: string]: string };
  body?: string;
  timeout?: number;
}

export const createCurlActions = (context: ActionContext): FunctionFactory => ({
  performCurlRequest: {
    description: 'Perform an HTTP request to a specified URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to send the request to',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'The HTTP method to use',
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Additional headers to include in the request',
        },
        body: {
          type: 'string',
          description: 'The body of the request (for POST, PUT, PATCH methods)',
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    function: async (args: CurlRequestArgs) => {
      console.log('performCurlRequest called with arguments:', JSON.stringify(args, null, 2));

      // Validate required parameters
      const { url, method = 'GET', headers = {}, body = '', timeout = 5000 } = args;

      // Input validation
      if (!/^https?:\/\//i.test(url)) {
        return {
          error: 'Invalid URL',
          message: 'The URL must start with http:// or https://',
        };
      }

      // Security considerations:
      // - Prevent accessing internal networks
      // - Optional: Implement URL whitelisting or blacklisting
      // - Limit the timeout and response size

      // Call the service to perform the request
      try {
        const response = await performCurlRequest(context, { url, method, headers, body, timeout });
        return { response };
      } catch (error: any) {
        console.error('performCurlRequest: Error performing request', error);
        return {
          error: 'Request failed',
          message: error.message || 'Failed to perform the HTTP request.',
        };
      }
    },
  },
});