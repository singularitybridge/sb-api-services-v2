import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import { fetchGcpFileContent as fetchGcpFileContentService } from './gcp_file_fetcher.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface FetchFileContentParams {
  fileId: string;
  // returnAs is not exposed by this action, defaults to string content from service
}

// R type for StandardActionResult<R>
interface FetchFileContentResponseData {
  fileContent: string;
}

// S type for serviceCall lambda's response for executeAction
interface ServiceCallLambdaResponse {
  success: boolean;
  data?: FetchFileContentResponseData; // Optional because it's not present on failure
  description?: string; // Used by executeAction if success is false
  error?: string; // For clarity, matches one of the service's return fields
}

const SERVICE_NAME = 'gcpFileFetcherService';

export const createGcpFileFetcherActions = (context: ActionContext): FunctionFactory => ({
  fetchFileContent: {
    description: 'Fetches the content of a previously uploaded file (as text) from GCP storage.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file (MongoDB ObjectId as a string) whose content needs to be fetched.',
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
    function: async (params: FetchFileContentParams): Promise<StandardActionResult<FetchFileContentResponseData>> => {
      if (!context.sessionId) {
        throw new ActionValidationError('Session ID is missing from context.');
      }
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }
      if (!params.fileId) {
        // Service also validates this, but good practice for action to check its direct input
        throw new ActionValidationError('fileId parameter is required.');
      }

      return executeAction<FetchFileContentResponseData, ServiceCallLambdaResponse>(
        'fetchFileContent',
        async (): Promise<ServiceCallLambdaResponse> => {
          // Service returns Promise<{ success: boolean; data?: string | Buffer; error?: string }>
          // It throws for most errors, but returns { success: false, error: ... } for PDF parsing errors.
          const serviceResult = await fetchGcpFileContentService(context.sessionId!, context.companyId!, params);

          if (!serviceResult.success) {
            // This handles the PDF parsing error case specifically.
            return { success: false, description: serviceResult.error, error: serviceResult.error };
          }

          // If serviceResult.success is true, serviceResult.data should be string | Buffer.
          // This action expects to return string content.
          if (typeof serviceResult.data !== 'string') {
            // This could happen if the file was not text-based and not PDF, or if returnAs: 'buffer' was somehow used.
            // For this action, we expect string content.
            throw new Error('Fetched file content was not returned as a string by the service.');
          }
          
          return { success: true, data: { fileContent: serviceResult.data } };
        },
        { 
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work with the lambda's return structure.
        }
      );
    },
  },
});
