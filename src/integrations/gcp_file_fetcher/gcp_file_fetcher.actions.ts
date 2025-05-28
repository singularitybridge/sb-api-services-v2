import { ActionContext, FunctionFactory } from '../actions/types';
import { fetchGcpFileContent } from './gcp_file_fetcher.service';

interface FetchFileContentParams {
  fileId: string;
}

export const createGcpFileFetcherActions = (context: ActionContext): FunctionFactory => ({
  fetchFileContent: {
    description: 'Fetches the content of a previously uploaded file from GCP storage.',
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
    function: async (params: FetchFileContentParams) => {
      // Input validation for fileId is handled by the service function.
      // The service function will throw an error if fileId is missing or invalid.
      // The action layer should let errors propagate.
      
      const result = await fetchGcpFileContent(context.sessionId, context.companyId, params);
      
      // The service function now throws errors directly, so we expect 'success: true' here.
      // If an error occurred, it would have been thrown and caught by the executor.
      return result; // This will be { success: true, data: fileContentString }
    },
  },
});
