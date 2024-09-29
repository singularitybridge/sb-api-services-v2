import { ActionContext, FunctionFactory } from '../../integrations/actions/types';
import { runMongoDbQuery } from './mongodb.service';

export const createMongoDbActions = (context: ActionContext): FunctionFactory => ({
  runMongoDbQuery: {
    description: 'Run a MongoDB query based on user input',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'The query input string',
        },
      },
      required: ['input'],
      additionalProperties: false,
    },
    function: async (params: { input: string }) => {
      try {
        const result = await runMongoDbQuery(context.sessionId, context.companyId, params.input);
        return result;
      } catch (error) {
        console.error('Error in runMongoDbQuery:', error);
        return { success: false, error: 'Failed to execute MongoDB query' };
      }
    },
  },
});