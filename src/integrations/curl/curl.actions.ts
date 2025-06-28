import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { performCurlRequest as performCurlRequestService } from './curl.service'; // Renamed to avoid conflict
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface CurlRequestArgs {
  curlCommand: string;
}

// This will be the R type for StandardActionResult<R>
export interface CurlActionResponseData {
  status: number;
  data: any;
  headers: { [key: string]: string };
  error?: string;
  truncated: boolean; // Ensure this is part of the final data payload
}

// This is the S type, the raw result from our serviceCall lambda for executeAction
interface ServiceCallLambdaResponse {
  success: boolean;
  data: CurlActionResponseData; // This data will be extracted by executeAction
  description?: string;
}

const SERVICE_NAME = 'curlService';

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
    function: async (
      args: CurlRequestArgs,
    ): Promise<StandardActionResult<CurlActionResponseData>> => {
      const { curlCommand } = args;

      if (
        !curlCommand ||
        typeof curlCommand !== 'string' ||
        !curlCommand.trim()
      ) {
        throw new ActionValidationError(
          'curlCommand parameter is required and must be a non-empty string.',
        );
      }
      // The service itself validates if it starts with "curl" and returns an error object if not.
      // We'll let executeAction handle that based on the success flag from the service call lambda.

      return executeAction<CurlActionResponseData, ServiceCallLambdaResponse>(
        'performCurlRequest',
        async (): Promise<ServiceCallLambdaResponse> => {
          const serviceResponse = await performCurlRequestService(
            context,
            curlCommand,
          );

          const isSuccess =
            serviceResponse.status >= 200 &&
            serviceResponse.status < 300 &&
            !serviceResponse.error;

          const responseData: CurlActionResponseData = {
            status: serviceResponse.status,
            data: serviceResponse.data,
            headers: serviceResponse.headers,
            error: serviceResponse.error,
            truncated: false, // As per original logic
          };

          return {
            success: isSuccess,
            data: responseData,
            description: isSuccess
              ? 'Curl request successful.'
              : serviceResponse.error ||
                `Curl request failed with status ${serviceResponse.status}`,
          };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work because our lambda returns data shaped as CurlActionResponseData
        },
      );
    },
  },
});
