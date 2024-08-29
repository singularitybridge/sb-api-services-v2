import { FunctionFactory, ActionContext, FunctionDefinition } from './types';
import { handleUserQuery, connectToMongoDB } from '../services/mongodb.query.service';

const runMongoDbQuery = async (args: { input: string }) => {
  try {
    const results = await handleUserQuery(args.input);
    return {
      success: true,
      data: results,
      message: 'Query executed successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      message: 'Failed to execute MongoDB query',
    };
  }
};

export const createMongoDbActions = (_context: ActionContext): FunctionFactory => {
  // Ensure MongoDB connection is established
  connectToMongoDB().catch(console.error);

  const actions: FunctionFactory = {
    runMongoDbQuery: {
      function: runMongoDbQuery,
      description: 'Run a MongoDB query based on user input',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'The query input string',
          },
        },
        required: ['input'],
      },
    } as FunctionDefinition,
  };

  return actions;
};