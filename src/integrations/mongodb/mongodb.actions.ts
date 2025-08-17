import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../../integrations/actions/types';
import {
  runMongoDbQuery as runMongoDbQueryService,
  mongoDbService,
} from './mongodb.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor'; // Corrected path
import { ActionValidationError } from '../../utils/actionErrors';

const SERVICE_NAME = 'mongoDbService';

// Define R types for StandardActionResult<R>
interface QueryResultData {
  data?: any;
  logs?: string;
  message?: string;
}
interface DbNameData {
  dbName: string;
}
interface StringListData {
  list: string[];
}
interface CollectionStatsData {
  stats: any;
}
interface CountData {
  count: number;
}
interface MessageData {
  message: string;
}

// Define S type (service call lambda's response) for executeAction
interface ServiceLambdaResponse<R_Payload = any> {
  success: boolean;
  data?: R_Payload;
  error?: string;
  description?: string;
  logs?: string;
  message?: string;
}

export const createMongoDbActions = (
  context: ActionContext,
): FunctionFactory => ({
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
    function: async (params: {
      input: string;
    }): Promise<StandardActionResult<QueryResultData>> => {
      if (!context.sessionId || !context.companyId)
        throw new ActionValidationError(
          'SessionID and CompanyID are required.',
        );
      if (!params.input)
        throw new ActionValidationError('Input parameter is required.');

      return executeAction<
        QueryResultData,
        ServiceLambdaResponse<QueryResultData>
      >(
        'runMongoDbQuery',
        async () => {
          const res = await runMongoDbQueryService(
            context.sessionId!,
            context.companyId!,
            params.input,
          );
          return {
            success: res.success,
            data: { data: res.data, logs: res.logs, message: res.message },
            description: res.error,
            error: res.error,
            logs: res.logs,
            message: res.message,
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (): Promise<StandardActionResult<DbNameData>> => {
      return executeAction<DbNameData, ServiceLambdaResponse<DbNameData>>(
        'getCurrentDatabase',
        async () => {
          const dbName = await mongoDbService.getCurrentDatabase();
          return { success: true, data: { dbName } };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (): Promise<StandardActionResult<StringListData>> => {
      return executeAction<
        StringListData,
        ServiceLambdaResponse<StringListData>
      >(
        'listDatabases',
        async () => {
          const databases = await mongoDbService.listDatabases();
          return { success: true, data: { list: databases } };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (params: {
      dbName: string;
    }): Promise<StandardActionResult<MessageData>> => {
      if (!params.dbName)
        throw new ActionValidationError('dbName parameter is required.');
      return executeAction<MessageData, ServiceLambdaResponse<MessageData>>(
        'useDatabase',
        async () => {
          await mongoDbService.useDatabase(params.dbName);
          return {
            success: true,
            data: { message: `Switched to database ${params.dbName}` },
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (): Promise<StandardActionResult<StringListData>> => {
      return executeAction<
        StringListData,
        ServiceLambdaResponse<StringListData>
      >(
        'listCollections',
        async () => {
          const collections = await mongoDbService.listCollections();
          return { success: true, data: { list: collections } };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (params: {
      collectionName: string;
    }): Promise<StandardActionResult<CollectionStatsData>> => {
      if (!params.collectionName)
        throw new ActionValidationError(
          'collectionName parameter is required.',
        );
      return executeAction<
        CollectionStatsData,
        ServiceLambdaResponse<CollectionStatsData>
      >(
        'describeCollection',
        async () => {
          const collStats = await mongoDbService.describeCollection(
            params.collectionName,
          );
          return { success: true, data: { stats: collStats } };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  countDocuments: {
    description:
      'Count the number of documents in a specific MongoDB collection',
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
    function: async (params: {
      collectionName: string;
    }): Promise<StandardActionResult<CountData>> => {
      if (!params.collectionName)
        throw new ActionValidationError(
          'collectionName parameter is required.',
        );
      return executeAction<CountData, ServiceLambdaResponse<CountData>>(
        'countDocuments',
        async () => {
          const count = await mongoDbService.countDocuments(
            params.collectionName,
          );
          return { success: true, data: { count } };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (params: {
      collectionName: string;
      pipeline: any[];
    }): Promise<StandardActionResult<QueryResultData>> => {
      if (!params.collectionName || !params.pipeline)
        throw new ActionValidationError(
          'collectionName and pipeline are required.',
        );
      return executeAction<
        QueryResultData,
        ServiceLambdaResponse<QueryResultData>
      >(
        'runAggregation',
        async () => {
          const res = await mongoDbService.runAggregation(
            params.collectionName,
            params.pipeline,
          );
          return {
            success: res.success,
            data: { data: res.data, logs: res.logs, message: res.message },
            description: res.error,
            error: res.error,
            logs: res.logs,
            message: res.message,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  connectToDatabase: {
    description: 'Connect to a new MongoDB database instance',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        connectionString: {
          type: 'string',
          description:
            'The MongoDB connection string (e.g., mongodb://user:pass@host:port/db)',
        },
      },
      required: ['connectionString'],
      additionalProperties: false,
    },
    function: async (params: {
      connectionString: string;
    }): Promise<StandardActionResult<MessageData>> => {
      if (!params.connectionString)
        throw new ActionValidationError(
          'connectionString parameter is required.',
        );

      return executeAction<MessageData, ServiceLambdaResponse<MessageData>>(
        'connectToDatabase',
        async () => {
          await mongoDbService.connectToDatabase(params.connectionString);
          const dbName = await mongoDbService.getCurrentDatabase();
          return {
            success: true,
            data: { message: `Successfully connected to database: ${dbName}` },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
