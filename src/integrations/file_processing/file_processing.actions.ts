import { ActionContext, FunctionFactory } from '../actions/types';
import {
  processFile,
  ProcessFileRequest,
  ProcessFileResponse,
} from './file_processing.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

export const createFileProcessingActions = (
  context: ActionContext,
): FunctionFactory => ({
  processFile: {
    description:
      'Processes a file and returns its content. Supports text files and Excel spreadsheets. For external files, use the full HTTP/HTTPS URL exactly as provided (e.g., http://localhost:3004/file.csv). For uploaded files in the system, use just the filename. The sandbox: prefix is only for CodeSandbox integration.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description:
            'The file URL or filename. For external files, use the complete HTTP/HTTPS URL (e.g., http://example.com/file.csv). For uploaded files, use just the filename. Do NOT add sandbox: prefix unless specifically for CodeSandbox.',
        },
        fileType: {
          type: 'string',
          description:
            'The type of file to process. Currently supports "text" and "excel". Defaults to "text".',
          enum: ['text', 'excel'],
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    function: async (params: { url: string; fileType?: 'text' | 'excel' }) => {
      const actionName = 'processFile';

      if (!params.url) {
        throw new ActionValidationError('url is required.', {
          fieldErrors: { url: 'url is required.' },
        });
      }

      const processRequest: ProcessFileRequest = {
        url: params.url,
        fileType: params.fileType,
      };

      return executeAction<ProcessFileResponse>(
        actionName,
        async () => {
          const serviceResult = await processFile(
            context.companyId,
            processRequest,
          );
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'FileProcessingService' },
      );
    },
  },
});
