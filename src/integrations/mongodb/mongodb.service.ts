import { handleUserQuery } from './mongodb.query.service';
import { logger } from '../../utils/logger';
import mongoose, { Connection } from 'mongoose';

let aoiConnection: Connection | null = null;

export const getAoiConnection = (): Connection => {
  if (!aoiConnection) {
    throw new Error(
      'No active MongoDB connection. Please use the connectToDatabase action first.',
    );
  }
  return aoiConnection;
};

interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  logs?: string;
}

export const mongoDbService = {
  async connectToDatabase(connectionString: string): Promise<void> {
    try {
      if (aoiConnection) {
        await aoiConnection.close();
        aoiConnection = null;
        logger.info('Closed existing AOI MongoDB connection.');
      }

      logger.info(`Attempting to connect to new MongoDB instance...`);
      const newConnection = await mongoose
        .createConnection(connectionString)
        .asPromise();
      aoiConnection = newConnection;
      logger.info(`Successfully connected to new MongoDB instance.`);
    } catch (error) {
      logger.error('Error connecting to new MongoDB instance:', error);
      throw new Error('Failed to connect to new MongoDB instance');
    }
  },

  async getCurrentDatabase(): Promise<string> {
    try {
      const conn = getAoiConnection();
      return conn.db.databaseName;
    } catch (error) {
      logger.error('Error getting current database:', error);
      throw new Error('Failed to get current database name');
    }
  },

  async listDatabases(): Promise<string[]> {
    try {
      const conn = getAoiConnection();
      const adminDb = conn.db.admin();
      const dbs = await adminDb.listDatabases();
      return dbs.databases.map((db) => db.name);
    } catch (error) {
      logger.error('Error listing databases:', error);
      throw new Error('Failed to list databases');
    }
  },

  async useDatabase(dbName: string): Promise<void> {
    try {
      const conn = getAoiConnection();
      await conn.useDb(dbName, { useCache: true });
      console.log(`Switched to database ${dbName}`);
    } catch (error) {
      logger.error(`Error switching to database ${dbName}:`, error);
      throw new Error(`Failed to switch to database ${dbName}`);
    }
  },

  async listCollections(): Promise<string[]> {
    try {
      const conn = getAoiConnection();
      const collections = await conn.db.listCollections().toArray();
      return collections.map((col) => col.name);
    } catch (error) {
      logger.error('Error listing collections:', error);
      throw new Error('Failed to list collections');
    }
  },

  async describeCollection(collectionName: string): Promise<any> {
    try {
      const conn = getAoiConnection();
      return await conn.db.command({
        collStats: collectionName,
      });
    } catch (error) {
      logger.error(`Error describing collection ${collectionName}:`, error);
      throw new Error(`Failed to describe collection ${collectionName}`);
    }
  },

  async countDocuments(collectionName: string): Promise<number> {
    try {
      const conn = getAoiConnection();
      return await conn.db.collection(collectionName).countDocuments();
    } catch (error) {
      logger.error(
        `Error counting documents in collection ${collectionName}:`,
        error,
      );
      throw new Error(
        `Failed to count documents in collection ${collectionName}`,
      );
    }
  },

  async runQuery(input: string): Promise<QueryResult> {
    try {
      if (!input || input.trim() === '') {
        throw new Error('Query input cannot be empty');
      }

      const results = await handleUserQuery(input);
      return {
        success: true,
        data: results,
        message: 'Query executed successfully',
        logs: logger.getLogs(),
      };
    } catch (error) {
      logger.error('Error in runQuery:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to execute MongoDB query',
        logs: logger.getLogs(),
      };
    } finally {
      logger.clearLogs();
    }
  },

  async runAggregation(
    collectionName: string,
    pipeline: any[],
  ): Promise<QueryResult> {
    try {
      if (!collectionName || !pipeline || !Array.isArray(pipeline)) {
        throw new Error('Invalid aggregation parameters');
      }
      const conn = getAoiConnection();
      const collection = conn.db.collection(collectionName);
      const results = await collection.aggregate(pipeline).toArray();

      return {
        success: true,
        data: results,
        message: 'Aggregation executed successfully',
        logs: logger.getLogs(),
      };
    } catch (error) {
      logger.error('Error in runAggregation:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to execute MongoDB aggregation',
        logs: logger.getLogs(),
      };
    } finally {
      logger.clearLogs();
    }
  },
};

export const runMongoDbQuery = async (
  sessionId: string,
  companyId: string,
  input: string,
): Promise<QueryResult> => {
  const lowerInput = input.toLowerCase().trim();
  const parts = lowerInput.split(' ');

  try {
    switch (parts[0]) {
      case 'show':
        if (parts[1] === 'tables' || parts[1] === 'collections') {
          const collections = await mongoDbService.listCollections();
          return {
            success: true,
            data: collections,
            message: 'Collections listed successfully',
          };
        } else if (parts[1] === 'databases' || parts[1] === 'dbs') {
          const dbs = await mongoDbService.listDatabases();
          return {
            success: true,
            data: dbs,
            message: 'Databases listed successfully',
          };
        }
        break;

      case 'use':
        if (parts[1]) {
          await mongoDbService.useDatabase(parts[1]);
          return { success: true, message: `Switched to database ${parts[1]}` };
        }
        break;

      case 'describe':
        if (parts[1]) {
          const collStats = await mongoDbService.describeCollection(parts[1]);
          return {
            success: true,
            data: collStats,
            message: `Collection ${parts[1]} described successfully`,
          };
        }
        break;

      case 'count':
        if (parts[1]) {
          const count = await mongoDbService.countDocuments(parts[1]);
          return {
            success: true,
            data: count,
            message: `${count} documents in ${parts[1]}`,
          };
        }
        break;

      case 'db':
        if (parts[1] === 'getname()' || parts[1] === 'getname') {
          const dbName = await mongoDbService.getCurrentDatabase();
          return {
            success: true,
            data: dbName,
            message: `Current database: ${dbName}`,
          };
        }
        // If it's just 'db', return information about the current database
        const dbName = await mongoDbService.getCurrentDatabase();
        const collections = await mongoDbService.listCollections();
        return {
          success: true,
          data: { name: dbName, collections },
          message: 'Current database info retrieved',
        };

      default:
        return await mongoDbService.runQuery(input);
    }

    throw new Error('Invalid command');
  } catch (error) {
    logger.error('Error in runMongoDbQuery:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unknown error occurred',
      message: 'Failed to execute MongoDB operation',
      logs: logger.getLogs(),
    };
  } finally {
    logger.clearLogs();
  }
};
