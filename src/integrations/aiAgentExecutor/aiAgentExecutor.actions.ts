import axios, { AxiosError } from 'axios';
import { ActionContext, FunctionFactory } from '../actions/types';
import { getApiKey } from '../../services/api.key.service';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors';

// Response interfaces to match the API structure
interface ExecuteResponse {
  output?: string;
  exitCode?: number;
  completed?: boolean;
  taskId?: string;
  initialOutput?: string;
}

interface TaskResponse {
  id: string;
  command: string;
  status: 'pending' | 'completed' | 'failed';
  output: string;
  exitCode: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileOperationResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// AIAgentExecutorResponse is no longer needed as actions will return StandardActionResult
// interface AIAgentExecutorResponse {
//   success: boolean;
//   data?: any;
//   error?: string;
// }

// Define data shapes for StandardActionResult
interface ExecuteCommandResultData extends ExecuteResponse {
  isLongRunning?: boolean; // Added for clarity if taskId is present
}
interface PerformFileOperationResultData {
  // This would be the type of 'response.data.result'
  [key: string]: any; // Or a more specific type
}
interface TaskStatusResultData extends TaskResponse {}
interface EndTaskResultData {
  message?: string;
  taskId?: string;
}
interface ChangeDirectoryResultData {
  // Define based on actual response from /change-directory
  currentPath?: string; // Example
  message?: string;
}


type FileOperation =
  | 'list'
  | 'read'
  | 'write'
  | 'createFile'
  | 'update'
  | 'deleteFile'
  | 'createDir'
  | 'deleteDirectory'
  | 'checkExistence';

// handleError is no longer needed as executeAction will handle errors.
// const handleError = (error: unknown): string => { ... };

export const createAIAgentExecutorActions = (context: ActionContext): FunctionFactory => {
  // Get headers with encrypted keys
  const getHeaders = async () => {
    const token = await getApiKey(context.companyId, 'executor_agent_token');
    if (!token) {
      throw new Error('AI Agent Executor token is missing');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Get base URL from encrypted key
  const getBaseUrl = async () => {
    const url = await getApiKey(context.companyId, 'executor_agent_url');
    if (!url) {
      throw new Error('AI Agent Executor URL is missing');
    }
    return url;
  };

  return {
    executeCommand: {
      description: 'Execute a shell command sequentially using Terminal Turtle.',
      parameters: {
        type: 'object',
        properties: {
          command: { 
            type: 'string', 
            description: 'The shell command to execute (e.g., npm install, git clone, pm2 logs)' 
          },
        },
        required: ['command'],
      },
      function: async ({ command }: { command: string }) => {
        const actionName = 'executeCommand';
        return executeAction<ExecuteCommandResultData>(
          actionName,
          async () => {
            const baseUrl = await getBaseUrl();
            const headers = await getHeaders();
            const response = await axios.post<ExecuteResponse>(
              `${baseUrl}/execute`,
              { command },
              { headers }
            );

            // Shape the data for StandardActionResult
            if (response.data.taskId) {
              return {
                success: true,
                data: {
                  taskId: response.data.taskId,
                  initialOutput: response.data.initialOutput,
                  isLongRunning: true,
                },
              };
            }
            return {
              success: true,
              data: {
                output: response.data.output,
                exitCode: response.data.exitCode,
                completed: response.data.completed,
              },
            };
          },
          { serviceName: 'AIAgentExecutorService' }
        );
      },
    },

    performFileOperation: {
      description: 'Perform file operations like listing, reading, writing, creating, updating, and deleting files or directories.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'list',
              'read',
              'write',
              'createFile',
              'update',
              'deleteFile',
              'createDir',
              'deleteDirectory',
              'checkExistence'
            ],
            description: 'The file operation to perform'
          },
          path: { 
            type: 'string', 
            description: 'The path to the file or directory' 
          },
          content: {
            type: 'string',
            description: 'Content for write, createFile, or update operations',
            optional: true
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to perform the operation recursively (for list operation)',
            optional: true
          }
        },
        required: ['operation', 'path'],
      },
      function: async ({
        operation,
        path,
        content,
        recursive
      }: {
        operation: FileOperation;
        path: string;
        content?: string;
        recursive?: boolean;
      }) => {
        const actionName = 'performFileOperation';
        return executeAction<PerformFileOperationResultData>(
          actionName,
          async () => {
            const baseUrl = await getBaseUrl();
            const headers = await getHeaders();
            const response = await axios.post<FileOperationResponse>(
              `${baseUrl}/file-operation`,
              { operation, path, content, recursive },
              { headers }
            );
            // Adapt the response for executeAction
            if (!response.data.success) {
              return { success: false, description: response.data.error, data: response.data.result };
            }
            return { success: true, data: response.data.result };
          },
          { serviceName: 'AIAgentExecutorService' }
        );
      },
    },

    getTaskStatus: {
      description: 'Check the status of a running task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { 
            type: 'string', 
            description: 'The task ID returned when the command was started' 
          },
        },
        required: ['taskId'],
      },
      function: async ({ taskId }: { taskId: string }) => {
        const actionName = 'getTaskStatus';
        return executeAction<TaskStatusResultData>(
          actionName,
          async () => {
            const baseUrl = await getBaseUrl();
            const headers = await getHeaders();
            const response = await axios.get<TaskResponse>(
              `${baseUrl}/tasks/${taskId}`,
              { headers }
            );
            return { success: true, data: response.data };
          },
          { serviceName: 'AIAgentExecutorService' }
        );
      },
    },

    endTask: {
      description: 'Terminate a running task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { 
            type: 'string', 
            description: 'The task ID of the task to terminate' 
          },
        },
        required: ['taskId'],
      },
      function: async ({ taskId }: { taskId: string }) => {
        const actionName = 'endTask';
        return executeAction<EndTaskResultData>(
          actionName,
          async () => {
            const baseUrl = await getBaseUrl();
            const headers = await getHeaders();
            // Assuming response.data is { message: string, taskId: string } or similar
            const response = await axios.post<{ message?: string; taskId?: string }>(
              `${baseUrl}/tasks/${taskId}/end`,
              {},
              { headers }
            );
            return { success: true, data: response.data };
          },
          { serviceName: 'AIAgentExecutorService' }
        );
      },
    },

    changeDirectory: {
      description: 'Change the working directory for subsequent commands.',
      parameters: {
        type: 'object',
        properties: {
          newPath: { 
            type: 'string', 
            description: 'The new directory path to change to' 
          },
        },
        required: ['newPath'],
      },
      function: async ({ newPath }: { newPath: string }) => {
        const actionName = 'changeDirectory';
        return executeAction<ChangeDirectoryResultData>(
          actionName,
          async () => {
            const baseUrl = await getBaseUrl();
            const headers = await getHeaders();
            // Assuming response.data is { currentPath: string, message: string } or similar
            const response = await axios.post<{ currentPath?: string; message?: string }>(
              `${baseUrl}/change-directory`,
              { newPath },
              { headers }
            );
            return { success: true, data: response.data };
          },
          { serviceName: 'AIAgentExecutorService' }
        );
      },
    },
  };
};
