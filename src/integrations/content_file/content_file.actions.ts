import { ActionContext, FunctionFactory } from '../actions/types';
import { readContentFiles, writeContentFile, removeContentFile, getContentFileById } from './content_file.service';

export const createContentFileActions = (context: ActionContext): FunctionFactory => ({
  readFiles: {
    description: 'Retrieves all content files associated with the company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      return await readContentFiles(context.sessionId, context.companyId);
    },
  },

  getFile: {
    description: 'Retrieves a specific content file by ID',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file to retrieve (MongoDB ObjectId as a string)',
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
    function: async (params: { fileId: string }) => {
      return await getContentFileById(context.sessionId, context.companyId, params.fileId);
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
    }) => {
      try {
        return await writeContentFile(context.sessionId, context.companyId, params);
      } catch (error) {
        console.error('Error in writeFile action:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
      }
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
    function: async (params: { fileId: string }) => {
      return await removeContentFile(context.sessionId, context.companyId, params.fileId);
    },
  },
});
