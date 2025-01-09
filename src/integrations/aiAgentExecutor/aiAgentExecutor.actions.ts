import axios, { AxiosError } from 'axios';
import { ActionContext, FunctionFactory } from '../actions/types';
import { getApiKey } from '../../services/api.key.service';

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

interface AIAgentExecutorResponse {
  success: boolean;
  data?: any;
  error?: string;
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

// Enhanced error handling with detailed logging
const handleError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string }>;
    console.error(`API Error: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`);
    return (
      axiosError.response?.data?.error ||
      axiosError.message ||
      'An error occurred with the API request'
    );
  }
  console.error(`Unexpected error: ${error}`);
  return error instanceof Error ? error.message : 'An unknown error occurred';
};

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
      function: async ({ command }: { command: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post<ExecuteResponse>(
            `${baseUrl}/execute`,
            { command },
            { headers }
          );

          // Handle both immediate and long-running task responses
          if (response.data.taskId) {
            return {
              success: true,
              data: {
                taskId: response.data.taskId,
                initialOutput: response.data.initialOutput,
                isLongRunning: true
              }
            };
          }

          return {
            success: true,
            data: {
              output: response.data.output,
              exitCode: response.data.exitCode,
              completed: response.data.completed
            }
          };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
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
      }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post<FileOperationResponse>(
            `${baseUrl}/file-operation`,
            { operation, path, content, recursive },
            { headers }
          );

          return {
            success: response.data.success,
            data: response.data.result,
            error: response.data.error
          };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
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
      function: async ({ taskId }: { taskId: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.get<TaskResponse>(
            `${baseUrl}/tasks/${taskId}`,
            { headers }
          );

          return { success: true, data: response.data };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
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
      function: async ({ taskId }: { taskId: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/tasks/${taskId}/end`,
            {},
            { headers }
          );

          return {
            success: true,
            data: {
              message: response.data.message,
              taskId: response.data.taskId
            }
          };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
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
      function: async ({ newPath }: { newPath: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/change-directory`,
            { newPath },
            { headers }
          );

          return { success: true, data: response.data };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },
  };
};
