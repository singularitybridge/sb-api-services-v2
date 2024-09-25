import axios, { AxiosError } from 'axios';
import { ActionContext, FunctionFactory } from '../actions/types';

interface AIAgentExecutorResponse {
  success: boolean;
  data?: any;
  error?: string;
}

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
  // Base URL for the AI Agent Executor API
  const baseUrl = process.env.AI_AGENT_EXECUTOR_URL || 'http://localhost:3001';

  // Common headers for all requests
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.AI_AGENT_EXECUTOR_TOKEN}`,
  });

  return {
    executeCommand: {
      description: 'Execute a command on the AI Agent Executor. Optionally run in background.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
          runInBackground: {
            type: 'boolean',
            description: 'Whether to run the command in background',
            optional: true,
          },
        },
        required: ['command'],
      },
      function: async ({
        command,
        runInBackground,
      }: {
        command: string;
        runInBackground?: boolean;
      }): Promise<AIAgentExecutorResponse> => {
        try {
          const response = await axios.post(
            `${baseUrl}/execute`,
            { command, runInBackground },
            { headers: getHeaders() }
          );
          const data = response.data;
          if (data.result) {
            // Foreground execution result
            return { success: true, data: data.result };
          } else if (data.pid) {
            // Background execution result
            return { success: true, data: { message: data.message, pid: data.pid } };
          } else {
            return { success: false, error: 'Unknown response format from execute command.' };
          }
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },

    getProcessStatus: {
      description: 'Get the status of a background process',
      parameters: {
        type: 'object',
        properties: {
          pid: { type: 'string', description: 'The process ID returned when the process was started' },
        },
        required: ['pid'],
      },
      function: async ({ pid }: { pid: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const response = await axios.get(`${baseUrl}/process/${pid}`, {
            headers: getHeaders(),
          });
          return { success: true, data: response.data };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },

    stopProcess: {
      description: 'Stop a background process',
      parameters: {
        type: 'object',
        properties: {
          pid: { type: 'string', description: 'The process ID of the process to stop' },
        },
        required: ['pid'],
      },
      function: async ({ pid }: { pid: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const response = await axios.post(
            `${baseUrl}/process/${pid}/stop`,
            {},
            { headers: getHeaders() }
          );
          return { success: true, data: response.data };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },

    fileOperation: {
      description: 'Perform a file operation on the AI Agent Executor',
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
              'checkExistence',
            ],
            description: 'The file operation to perform',
          },
          path: { type: 'string', description: 'The path to the file or directory' },
          content: {
            type: 'string',
            description: 'Content for write, createFile, or update operations',
            optional: true,
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to perform the operation recursively (for list operation)',
            optional: true,
          },
          mode: {
            type: 'string',
            enum: ['overwrite', 'append'],
            description: 'Mode for update operation',
            optional: true,
          },
        },
        required: ['operation', 'path'],
      },
      function: async ({
        operation,
        path,
        content,
        recursive,
        mode,
      }: {
        operation: string;
        path: string;
        content?: string;
        recursive?: boolean;
        mode?: 'overwrite' | 'append';
      }): Promise<AIAgentExecutorResponse> => {
        try {
          const response = await axios.post(
            `${baseUrl}/file-operation`,
            { operation, path, content, recursive, mode },
            { headers: getHeaders() }
          );
          const data = response.data;
          return { success: true, data: data.result };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },

    stopExecution: {
      description: 'Stop all running processes and shut down the AI Agent Executor',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      function: async (): Promise<AIAgentExecutorResponse> => {
        try {
          const response = await axios.post(
            `${baseUrl}/stop-execution`,
            {},
            { headers: getHeaders() }
          );
          return { success: true, data: response.data.message };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },
  };
};
