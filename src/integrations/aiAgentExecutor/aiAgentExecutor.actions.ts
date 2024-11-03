import axios, { AxiosError } from 'axios';
import { ActionContext, FunctionFactory } from '../actions/types';
import { getApiKey } from '../../services/api.key.service';

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
      description: 'Execute a command on the AI Agent Executor.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
        },
        required: ['command'],
      },
      function: async ({ command }: { command: string }): Promise<AIAgentExecutorResponse> => {
        try {
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/execute`,
            { command },
            { headers }
          );
          const data = response.data;
          if (data.result) {
            return { success: true, data: data.result };
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
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.get(`${baseUrl}/process/${pid}`, {
            headers,
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
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/process/${pid}/stop`,
            {},
            { headers }
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
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/file-operation`,
            { operation, path, content, recursive, mode },
            { headers }
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
          const baseUrl = await getBaseUrl();
          const headers = await getHeaders();
          
          const response = await axios.post(
            `${baseUrl}/stop-execution`,
            {},
            { headers }
          );
          return { success: true, data: response.data.message };
        } catch (error: unknown) {
          return { success: false, error: handleError(error) };
        }
      },
    },
  };
};
