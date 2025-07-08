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
    description: 'Processes a file and returns its content. Supports text files and Excel spreadsheets. Accepts HTTP/HTTPS URLs, sandbox: URLs, or plain filenames for uploaded files.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The file to process. Can be an HTTP/HTTPS URL, a sandbox: URL, or a filename for an uploaded file.',
        },
        fileType: {
          type: 'string',
          description: 'The type of file to process. Currently supports "text" and "excel". Defaults to "text".',
          enum: ['text', 'excel'],
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    function: async (params: {
      url: string;
      fileType?: 'text' | 'excel';
    }) => {
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