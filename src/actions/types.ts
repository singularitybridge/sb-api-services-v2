/// file_path: /src/actions/types.ts

export type ActionContext = {
  sessionId: string;
  companyId: string;
};

export type FunctionDefinition = {
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  function: (...args: any[]) => Promise<any>;
};

export type FunctionFactory = Record<string, FunctionDefinition>;
