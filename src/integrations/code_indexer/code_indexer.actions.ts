import { ActionContext, FunctionFactory } from '../actions/types';
import {
  scanCodeProject,
  queryRelevantFiles,
  getFileContent,
  editAndSaveFile,
  listIndexedFiles,
  clearIndexedFiles,
  dryRunScanCodeProject,
} from './code_indexer.service';
import { CodeFileSummary } from './code_indexer.types';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors'; // ActionValidationError might be used if specific arg validation is needed

// Define data shapes for StandardActionResult for clarity
interface DryRunScanResultData {
  scannedFiles: any[]; // Replace any[] with actual type if known (e.g., string[] or specific file info type)
}
interface QueryRelevantFilesData {
  files: CodeFileSummary[];
}
interface GetFileContentData {
  content: string;
}
interface ListIndexedFilesData {
  files: CodeFileSummary[];
}

// handleError is no longer needed as executeAction will handle errors.
// const handleError = (error: unknown, errorMessage: string) => ({ ... });

export const createCodeIndexerActions = (
  context: ActionContext,
): FunctionFactory => ({
  scanCodeProject: {
    description: 'Scan a code project directory and index file summaries',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description: 'Path to the code project directory',
        },
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
      const actionName = 'scanCodeProject';
      return executeAction<void>( // No specific data returned on success
        actionName,
        async () => {
          await scanCodeProject({ ...params, companyId: context.companyId });
          return { success: true };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  dryRunScanCodeProject: {
    description:
      'Perform a dry run scan of a code project directory and return the list of files that would be scanned',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        directoryPath: {
          type: 'string',
          description: 'Path to the code project directory',
        },
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
      const actionName = 'dryRunScanCodeProject';
      return executeAction<DryRunScanResultData>(
        actionName,
        async () => {
          const scannedFiles = await dryRunScanCodeProject(params);
          // Original action returned { success: true, scannedFiles }, so data should be { scannedFiles }
          return { success: true, data: { scannedFiles } };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  queryRelevantFiles: {
    description: 'Query indexed files relevant to a task',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        taskDescription: {
          type: 'string',
          description: 'Description of the task',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of files to return',
          optional: true,
        },
      },
      required: ['taskDescription'],
      additionalProperties: false,
    },
    function: async (params) => {
      const actionName = 'queryRelevantFiles';
      return executeAction<QueryRelevantFilesData>(
        actionName,
        async () => {
          const files = await queryRelevantFiles(
            params.taskDescription,
            context.companyId,
            params.limit,
          );
          // Original action returned { success: true, files }, so data should be { files }
          return { success: true, data: { files } };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  getFileContent: {
    description: 'Get the content of a specific file',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file' },
      },
      required: ['filePath'],
      additionalProperties: false,
    },
    function: async (params) => {
      const actionName = 'getFileContent';
      return executeAction<GetFileContentData>(
        actionName,
        async () => {
          const content = await getFileContent(params.filePath);
          // Original action returned { success: true, content }, so data should be { content }
          return { success: true, data: { content } };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  editAndSaveFile: {
    description: 'Edit and save a specific file',
    strict: true,
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
      const actionName = 'editAndSaveFile';
      return executeAction<void>( // No specific data returned on success
        actionName,
        async () => {
          await editAndSaveFile(params.filePath, params.newContent);
          return { success: true };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  listIndexedFiles: {
    description: 'List indexed files (file name, path, summary)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of files to return',
          optional: true,
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (params) => {
      const actionName = 'listIndexedFiles';
      return executeAction<ListIndexedFilesData>(
        actionName,
        async () => {
          const files = await listIndexedFiles(context.companyId, params.limit);
          // Original action returned { success: true, files }, so data should be { files }
          return { success: true, data: { files } };
        },
        { serviceName: 'CodeIndexerService' },
      );
    },
  },

  clearIndexedFiles: {
    description: 'Clear indexed files to allow re-indexing later',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      const actionName = 'clearIndexedFiles';
      return executeAction<void>( // No specific data, success message handled by executeAction option
        actionName,
        async () => {
          await clearIndexedFiles(context.companyId);
          return { success: true };
        },
        {
          serviceName: 'CodeIndexerService',
          successMessage: 'Indexed files cleared successfully',
        },
      );
    },
  },
});
