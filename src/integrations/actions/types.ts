import { SupportedLanguage } from '../../services/discovery.service';

export interface ActionContext {
  sessionId: string;
  companyId: string;
  language: SupportedLanguage;
  userId?: string;
  isStateless?: boolean;
}

// New interface for a standardized successful action result
export interface StandardActionResult<D = any> {
  success: true; // Explicitly true for successful outcomes
  message?: string; // Optional human-readable message for UI or logs
  data?: D; // The primary payload/data of the action
  // uiHints?: Record<string, any>; // Example: Future extension for UI rendering hints
}

export interface FunctionDefinition<T = any, R = any> {
  // Added R for the data type of StandardActionResult
  description: string;
  strict?: boolean;
  actionType?: ActionType;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
  // The function should now return a Promise of StandardActionResult for successful outcomes.
  // Errors should be thrown as exceptions, not returned as { success: false, ... } by the action function itself.
  function: (args: T) => Promise<StandardActionResult<R>>; // R is the type of the 'data' payload
}

// FunctionFactory now uses the updated FunctionDefinition which includes the result type R
export type FunctionFactory = Record<string, FunctionDefinition<any, any>>;

export enum ActionType {
  EXECUTE_COMMAND = 'EXECUTE_COMMAND',
  FILE_OPERATION = 'FILE_OPERATION',
  STOP_EXECUTION = 'STOP_EXECUTION',
  JOURNAL_OPERATION = 'JOURNAL_OPERATION',
  GET_PROCESS_STATUS = 'GET_PROCESS_STATUS',
  STOP_PROCESS = 'STOP_PROCESS',
}

export interface ActionInfo {
  serviceName: string;
  actionTitle: string;
  description: string;
  icon?: string;
}

export interface ExecutionDetails {
  id: string;
  actionId: string;
  serviceName: string;
  actionTitle: string;
  actionDescription: string;
  icon: string;
  args: Record<string, unknown>;
  originalActionId: string;
  language: string;
  input: Record<string, unknown>;
  output?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface FunctionCall {
  function: {
    name: string;
    arguments: string;
  };
}
