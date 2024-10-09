import { ActionContext, FunctionFactory } from '../../integrations/actions/types';
import { runMongoDbQuery, mongoDbService } from './mongodb.service';

export const createMongoDbActions = (context: ActionContext): FunctionFactory => ({
  runMongoDbQuery: {
    description: 'Run a MongoDB query or command based on user input',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'The query input string or command',
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
        return { success: false, error: 'Failed to execute MongoDB query or command' };
      }
    },
  },

  getCurrentDatabase: {
    description: 'Get the name of the current MongoDB database',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const dbName = await mongoDbService.getCurrentDatabase();
        return { success: true, data: dbName, message: `Current database: ${dbName}` };
      } catch (error) {
        console.error('Error in getCurrentDatabase:', error);
        return { success: false, error: 'Failed to get current database name' };
      }
    },
  },

  listDatabases: {
    description: 'List all available MongoDB databases',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const databases = await mongoDbService.listDatabases();
        return { success: true, data: databases, message: 'Databases listed successfully' };
      } catch (error) {
        console.error('Error in listDatabases:', error);
        return { success: false, error: 'Failed to list databases' };
      }
    },
  },

  useDatabase: {
    description: 'Switch to a different MongoDB database',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        dbName: {
          type: 'string',
          description: 'The name of the database to switch to',
        },
      },
      required: ['dbName'],
      additionalProperties: false,
    },
    function: async (params: { dbName: string }) => {
      try {
        await mongoDbService.useDatabase(params.dbName);
        return { success: true, message: `Switched to database ${params.dbName}` };
      } catch (error) {
        console.error('Error in useDatabase:', error);
        return { success: false, error: `Failed to switch to database ${params.dbName}` };
      }
    },
  },

  listCollections: {
    description: 'List all collections in the current MongoDB database',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const collections = await mongoDbService.listCollections();
        return { success: true, data: collections, message: 'Collections listed successfully' };
      } catch (error) {
        console.error('Error in listCollections:', error);
        return { success: false, error: 'Failed to list collections' };
      }
    },
  },

  describeCollection: {
    description: 'Get detailed information about a specific MongoDB collection',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        collectionName: {
          type: 'string',
          description: 'The name of the collection to describe',
        },
      },
      required: ['collectionName'],
      additionalProperties: false,
    },
    function: async (params: { collectionName: string }) => {
      try {
        const collStats = await mongoDbService.describeCollection(params.collectionName);
        return { success: true, data: collStats, message: `Collection ${params.collectionName} described successfully` };
      } catch (error) {
        console.error('Error in describeCollection:', error);
        return { success: false, error: `Failed to describe collection ${params.collectionName}` };
      }
    },
  },

  countDocuments: {
    description: 'Count the number of documents in a specific MongoDB collection',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        collectionName: {
          type: 'string',
          description: 'The name of the collection to count documents in',
        },
      },
      required: ['collectionName'],
      additionalProperties: false,
    },
    function: async (params: { collectionName: string }) => {
      try {
        const count = await mongoDbService.countDocuments(params.collectionName);
        return { success: true, data: count, message: `${count} documents in ${params.collectionName}` };
      } catch (error) {
        console.error('Error in countDocuments:', error);
        return { success: false, error: `Failed to count documents in collection ${params.collectionName}` };
      }
    },
  },

  runAggregation: {
    description: 'Run an aggregation pipeline on a specific MongoDB collection',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        collectionName: {
          type: 'string',
          description: 'The name of the collection to run the aggregation on',
        },
        pipeline: {
          type: 'array',
          description: 'The aggregation pipeline to execute',
          items: {
            type: 'object',
          },
        },
      },
      required: ['collectionName', 'pipeline'],
      additionalProperties: false,
    },
    function: async (params: { collectionName: string; pipeline: any[] }) => {
      try {
        const result = await mongoDbService.runAggregation(params.collectionName, params.pipeline);
        return result;
      } catch (error) {
        console.error('Error in runAggregation:', error);
        return { success: false, error: `Failed to run aggregation on collection ${params.collectionName}` };
      }
    },
  },
});