/// file_path: /src/actions/types.ts

export type ActionContext = {
  sessionId: string;
  companyId: string;
};

export type FunctionDefinition = {
  description: string;
  strict?: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  function: (...args: any[]) => Promise<any>;
};

export type FunctionFactory = Record<string, FunctionDefinition>;

export enum ActionType {
  // ... existing action types ...
  EXECUTE_COMMAND = 'EXECUTE_COMMAND',
  FILE_OPERATION = 'FILE_OPERATION',
  STOP_EXECUTION = 'STOP_EXECUTION',
}
