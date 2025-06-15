import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import { readContentFiles, writeContentFile, removeContentFile, getFileContentText } from './content_file.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors'; // ActionServiceError might not be needed here if executeAction handles it
import { IContentFile } from '../../models/ContentFile';

const SERVICE_NAME = 'contentFileService';

export const createContentFileActions = (context: ActionContext): FunctionFactory => ({
  readFiles: {
    description: 'Retrieves all content files associated with the company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<IContentFile[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }
      // Type for service call result S
      type ServiceResultType = { success: boolean; data: IContentFile[] };
      return executeAction<IContentFile[], ServiceResultType>(
        'readFiles',
        async () => readContentFiles(context.sessionId, context.companyId!),
        { serviceName: SERVICE_NAME } // Default dataExtractor (res.data) should work
      );
    },
  },

  getFile: {
    description: "Retrieves a specific content file's text content by ID",
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file whose content is to be retrieved (MongoDB ObjectId as a string)',
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
    function: async (params: { fileId: string }): Promise<StandardActionResult<string | null>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }
      if (!params.fileId) {
        throw new ActionValidationError('File ID parameter is missing.');
      }
      // Type for service call result S, which is the return type of getFileContentText
      type ServiceResultType = { success: boolean; data: string | null };
      return executeAction<string | null, ServiceResultType>(
        'getFile',
        async () => getFileContentText(context.sessionId, context.companyId!, params.fileId),
        { serviceName: SERVICE_NAME } // Default dataExtractor (res.data) will work
      );
    },
  },

  writeFile: {
    description: 'Creates a new content file or updates an existing one. If fileId is provided and valid (a 24-character hex string MongoDB ObjectId), it will update the existing file; otherwise, it will create a new file with a new ObjectId.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Optional ID of an existing file to update. Should be a valid 24-character hex string MongoDB ObjectId. If not provided or invalid, a new ObjectId will be generated.',
        },
        title: {
          type: 'string',
          description: 'The title of the content file',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        description: {
          type: 'string',
          description: 'Optional description of the content file',
        },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
    function: async (params: {
      fileId?: string;
      title: string;
      content: string;
      description?: string;
    }): Promise<StandardActionResult<Partial<IContentFile>>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }
      if (!params.title || !params.content) {
        throw new ActionValidationError('Title and content parameters are required.');
      }
      // Type for service call result S
      type ServiceResultType = { success: boolean; data: Partial<IContentFile> };
      return executeAction<Partial<IContentFile>, ServiceResultType>(
        'writeFile',
        async () => writeContentFile(context.sessionId, context.companyId!, params),
        { serviceName: SERVICE_NAME } // Default dataExtractor (res.data) should work
      );
    },
  },

  deleteFile: {
    description: 'Deletes a specific content file',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file to delete (MongoDB ObjectId as a string)',
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
    function: async (params: { fileId: string }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }
      if (!params.fileId) {
        throw new ActionValidationError('File ID parameter is missing.');
      }
      // Type for service call result S for removeContentFile is { success: boolean }
      // We want R to be { message: string }
      // The serviceCall lambda needs to return a structure that executeAction can use.
      // Specifically, its 'data' property should be what we want for R.
      type ServiceLambdaReturnType = { success: boolean; data: { message: string } };

      return executeAction<{ message: string }, ServiceLambdaReturnType>(
        'deleteFile',
        async (): Promise<ServiceLambdaReturnType> => {
          await removeContentFile(context.sessionId, context.companyId!, params.fileId);
          // If removeContentFile throws, executeAction handles it.
          // If it succeeds, it returns { success: true }. We shape the response for executeAction here.
          return { success: true, data: { message: 'File deleted successfully.' } };
        },
        { serviceName: SERVICE_NAME } // Default dataExtractor (res.data) will pick up data: { message: ... }
      );
    },
  },
});
