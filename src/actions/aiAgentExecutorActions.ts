import axios, { AxiosError } from 'axios';
import { ActionType, ActionContext, FunctionFactory } from './types';

interface AIAgentExecutorResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Enhanced error handling with detailed logging
const handleError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.error(`API Error: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`);
    return axiosError.response?.data?.message || axiosError.message || 'An error occurred with the API request';
  }
  console.error(`Unexpected error: ${error}`);
  return error instanceof Error ? error.message : 'An unknown error occurred';
};

const createAIAgentExecutorActions = (context: ActionContext): FunctionFactory => {
  // Base URL for the AI Agent Executor API
  const baseUrl = process.env.AI_AGENT_EXECUTOR_URL || 'http://localhost:3001';

  // Common headers for all requests
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.AI_AGENT_EXECUTOR_TOKEN}`
  });

  const executeCommand: FunctionFactory[ActionType.EXECUTE_COMMAND] = {
    description: 'Execute a whitelisted command on the AI Agent Executor',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        workingDirectory: { type: 'string', optional: true }
      },
      required: ['command']
    },
    function: async ({ command, workingDirectory }: { command: string; workingDirectory?: string }): Promise<AIAgentExecutorResponse> => {
      try {
        const response = await axios.post(
          `${baseUrl}/execute`,
          { command, workingDirectory, sessionId: context.sessionId, companyId: context.companyId },
          { headers: getHeaders() }
        );
        return { success: true, data: response.data };
      } catch (error: unknown) {
        return { success: false, error: handleError(error) };
      }
    }
  };

  const fileOperation: FunctionFactory[ActionType.FILE_OPERATION] = {
    description: 'Perform a file operation on the AI Agent Executor',
    parameters: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string',
          enum: ['list', 'read', 'write', 'createFile', 'update', 'deleteFile', 'createDir', 'deleteDirectory', 'checkExistence']
        },
        path: { type: 'string' },
        content: { type: 'string', optional: true },
        recursive: { type: 'boolean', optional: true },
        mode: { type: 'string', enum: ['overwrite', 'append'], optional: true }
      },
      required: ['operation', 'path']
    },
    function: async ({ operation, path, content, recursive, mode }: { 
      operation: string; 
      path: string; 
      content?: string; 
      recursive?: boolean;
      mode?: 'overwrite' | 'append';
    }): Promise<AIAgentExecutorResponse> => {
      try {
        const response = await axios.post(
          `${baseUrl}/file-operation`,
          { operation, path, content, recursive, mode, sessionId: context.sessionId, companyId: context.companyId },
          { headers: getHeaders() }
        );
        return { success: true, data: response.data };
      } catch (error: unknown) {
        return { success: false, error: handleError(error) };
      }
    }
  };

  const stopExecution: FunctionFactory[ActionType.STOP_EXECUTION] = {
    description: 'Stop execution on the AI Agent Executor',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    function: async (): Promise<AIAgentExecutorResponse> => {
      try {
        const response = await axios.post(
          `${baseUrl}/stop-execution`,
          { sessionId: context.sessionId, companyId: context.companyId },
          { headers: getHeaders() }
        );
        return { success: true, data: response.data };
      } catch (error: unknown) {
        return { success: false, error: handleError(error) };
      }
    }
  };

  return {
    [ActionType.EXECUTE_COMMAND]: executeCommand,
    [ActionType.FILE_OPERATION]: fileOperation,
    [ActionType.STOP_EXECUTION]: stopExecution,
  };
};

// Security measures:
// 1. All operations run within a Docker container on the server side
// 2. Commands are whitelisted (git, npm, node, python, pip)
// 3. File access is controlled and limited to a specific working directory
// 4. Input sanitization is implemented to prevent injection attacks
// 5. Authentication is required to access the API (using AUTH_TOKEN)
// 6. Rate limiting is implemented on the server side (100 requests per minute per client)

export default createAIAgentExecutorActions;