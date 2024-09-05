import axios, { AxiosError } from 'axios';
import { ActionType, ActionContext, FunctionFactory } from './types';

interface AIAgentExecutorResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const handleError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message;
  }
  return error instanceof Error ? error.message : 'An unknown error occurred';
};

const createAIAgentExecutorActions = (context: ActionContext): FunctionFactory => {
  const executeCommand: FunctionFactory[ActionType.EXECUTE_COMMAND] = {
    description: 'Execute a command on the AI Agent Executor',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      },
      required: ['command']
    },
    function: async ({ command }: { command: string }): Promise<AIAgentExecutorResponse> => {
      try {
        const response = await axios.post(
          `http://localhost:3000/execute`,
          { command, sessionId: context.sessionId, companyId: context.companyId },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.AI_AGENT_EXECUTOR_TOKEN}`
            }
          }
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
        operation: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string', optional: true },
        recursive: { type: 'boolean', optional: true }
      },
      required: ['operation', 'path']
    },
    function: async ({ operation, path, content, recursive }: { operation: string; path: string; content?: string; recursive?: boolean }): Promise<AIAgentExecutorResponse> => {
      try {
        const response = await axios.post(
          `http://localhost:3000/file-operation`,
          { operation, path, content, recursive, sessionId: context.sessionId, companyId: context.companyId },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.AI_AGENT_EXECUTOR_TOKEN}`
            }
          }
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
          `http://localhost:3000/stop-execution`,
          { sessionId: context.sessionId, companyId: context.companyId },
          {
            headers: {
              'Authorization': `Bearer ${process.env.AI_AGENT_EXECUTOR_TOKEN}`
            }
          }
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

export default createAIAgentExecutorActions;