import { ActionContext, FunctionFactory } from '../actions/types';
import { performCurlRequest } from './curl.service';

interface CurlRequestArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: { [key: string]: string };
  body?: string | object;
  timeout?: number;
  max_response_chars?: number;
}

export interface CurlActionResponse {
  status: number;
  data: any;
  headers: { [key: string]: string };
  error?: string;
  truncated?: boolean;
}

const processBody = (body: string | object | undefined): string => {
  if (body === undefined) {
    return '';
  }
  
  if (typeof body === 'string') {
    try {
      // Check if it's already a JSON string
      JSON.parse(body);
      return body; // If it parses successfully, it's already JSON, return as-is
    } catch {
      return body; // If parsing fails, it's a regular string, return as-is
    }
  }
  
  // If it's an object, stringify it
  return JSON.stringify(body);
};

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
          oneOf: [
            { type: 'string' },
            { type: 'object' }
          ],
          description: 'The body of the request (for POST, PUT, PATCH methods)',
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds',
        },
        max_response_chars: {
          type: 'number',
          description: 'Maximum number of characters in the response. Responses longer than this will be truncated.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    function: async (args: CurlRequestArgs): Promise<CurlActionResponse> => {

      try {
        // Validate required parameters
        const { url, method = 'GET', headers = {}, body, timeout = 5000, max_response_chars } = args;

        // Input validation
        if (!/^https?:\/\//i.test(url)) {
          return {
            status: 400,
            data: null,
            headers: {},
            error: 'Invalid URL: The URL must start with http:// or https://',
            truncated: false
          };
        }

        // Process the body to prevent double serialization
        const processedBody = processBody(body);

        // Ensure headers are properly handled
        const sanitizedHeaders: { [key: string]: string } = {
          'Content-Type': 'application/json',
          ...Object.entries(headers).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: String(value) // Ensure all header values are strings
          }), {})
        };

        // Call the service to perform the request
        const response = await performCurlRequest(context, {
          url,
          method,
          headers: sanitizedHeaders,
          body: processedBody,
          timeout,
          max_response_chars
        });

        // Return the full response, including error if status is >= 400
        if (response.status >= 400) {
          return {
            status: response.status,
            data: response.data,
            headers: response.headers,
            error: `HTTP ${response.status}: ${response.data?.message || 'Request failed'}`,
            truncated: response.truncated
          };
        }

        // Return the successful response
        return {
          status: response.status,
          data: response.data,
          headers: response.headers,
          truncated: response.truncated
        };
      } catch (error: any) {
        console.error('performCurlRequest: Error performing request', error);
        return {
          status: 500,
          data: null,
          headers: {},
          error: `Request failed: ${error.message || 'An unexpected error occurred'}`,
          truncated: false
        };
      }
    },
  },
});
