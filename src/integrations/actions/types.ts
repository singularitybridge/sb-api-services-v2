import { SupportedLanguage } from '../../services/discovery.service';

export interface ActionContext {
  sessionId: string;
  companyId: string;
  language: SupportedLanguage;
  userId?: string;
  isStateless?: boolean;
}

export interface FunctionDefinition<T = any> {
  description: string;
  strict?: boolean;
  actionType?: ActionType;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
  function: (args: T) => Promise<unknown>;
}

export type FunctionFactory = Record<string, FunctionDefinition<any>>;

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
