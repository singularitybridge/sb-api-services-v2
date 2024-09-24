import { FunctionFactory, ActionContext, FunctionDefinition } from '../integrations/actions/types';
import { handleUserQuery } from '../services/mongodb.query.service';
import { logger } from '../utils/logger';

interface MongoDbQueryArgs {
  input: string;
}

const runMongoDbQuery = async (args: MongoDbQueryArgs) => {
  try {
    const results = await handleUserQuery(args.input);
    return {
      success: true,
      data: results,
      message: 'Query executed successfully',
      logs: logger.getLogs(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      message: 'Failed to execute MongoDB query',
      logs: logger.getLogs(),
    };
  } finally {
    logger.clearLogs();
  }
};

export const createMongoDbActions = (_context: ActionContext): FunctionFactory => {
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