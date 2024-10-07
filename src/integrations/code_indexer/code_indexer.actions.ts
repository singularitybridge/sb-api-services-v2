import { ActionContext, FunctionFactory } from '../actions/types';
import {
  scanCodeProject,
  queryRelevantFiles,
  getFileContent,
  editAndSaveFile,
  CodeFileSummary,
  listIndexedFiles,
  clearIndexedFiles
} from './code_indexer.service';

export const createCodeIndexerActions = (context: ActionContext): FunctionFactory => ({
  scanCodeProject: {
    description: 'Scan a code project directory and index file summaries',
    parameters: {
      type: 'object',
      properties: {
        directoryPath: { type: 'string', description: 'Path to the code project directory' },
        includePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Glob patterns to include',
          optional: true,
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Glob patterns to exclude',
          optional: true,
        },
        maxFileSize: {
          type: 'number',
          description: 'Maximum file size in bytes to process',
          optional: true,
        },
      },
      required: ['directoryPath'],
      additionalProperties: false,
    },
    function: async (params) => {
      try {
        await scanCodeProject({
          ...params,
          companyId: context.companyId,
        });
        return { success: true };
      } catch (error) {
        console.error('Error scanning code project:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },

  queryRelevantFiles: {
    description: 'Query indexed files relevant to a task',
    parameters: {
      type: 'object',
      properties: {
        taskDescription: { type: 'string', description: 'Description of the task' },
        limit: { type: 'number', description: 'Maximum number of files to return', optional: true },
      },
      required: ['taskDescription'],
      additionalProperties: false,
    },
    function: async (params) => {
      try {
        const files = await queryRelevantFiles(
          params.taskDescription,
          context.companyId,
          params.limit
        );
        return { success: true, files };
      } catch (error) {
        console.error('Error querying relevant files:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },

  getFileContent: {
    description: 'Get the content of a specific file',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    function: async (params) => {
      try {
        const content = await getFileContent(params.filePath);
        return { success: true, content };
      } catch (error) {
        console.error('Error getting file content:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },

  editAndSaveFile: {
    description: 'Edit and save a specific file',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file' },
        newContent: { type: 'string', description: 'New content for the file' },
      },
      required: ['filePath', 'newContent'],
      additionalProperties: false,
    },
    function: async (params) => {
      try {
        await editAndSaveFile(params.filePath, params.newContent);
        return { success: true };
      } catch (error) {
        console.error('Error editing and saving file:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },

  listIndexedFiles: {
    description: 'List indexed files (file name, path, summary)',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of files to return', optional: true },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (params) => {
      try {
        const files = await listIndexedFiles(context.companyId, params.limit);
        return { success: true, files };
      } catch (error) {
        console.error('Error listing indexed files:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },

  clearIndexedFiles: {
    description: 'Clear indexed files to allow re-indexing later',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        await clearIndexedFiles(context.companyId);
        return { success: true, message: 'Indexed files cleared successfully' };
      } catch (error) {
        console.error('Error clearing indexed files:', error);
        return { success: false, error: (error as Error).message };
      }
    },
  },
});