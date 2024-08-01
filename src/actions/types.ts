/// file_path: /src/actions/types.ts


export type ActionContext = {
  sessionId: string;
  // You can add more context properties here if needed
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