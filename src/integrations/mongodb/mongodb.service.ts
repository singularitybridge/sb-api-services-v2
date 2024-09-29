import { handleUserQuery } from './mongodb.query.service';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

interface SpecialCommandResult {
  result: any;
  newDbName?: string;
}

const handleSpecialCommands = async (input: string, currentDbName: string): Promise<SpecialCommandResult | null> => {
  const lowerInput = input.toLowerCase().trim();
  const parts = lowerInput.split(' ');

  try {
    switch (parts[0]) {
      case 'show':
        if (parts[1] === 'tables' || parts[1] === 'collections') {
          const collections = await mongoose.connection.db.listCollections().toArray();
          return { result: collections.map(col => col.name) };
        } else if (parts[1] === 'databases' || parts[1] === 'dbs') {
          const adminDb = mongoose.connection.db.admin();
          const dbs = await adminDb.listDatabases();
          return { result: dbs.databases.map(db => db.name) };
        }
        break;

      case 'use':
        if (parts[1]) {
          await mongoose.connection.useDb(parts[1], { useCache: true });
          return { result: `Switched to database ${parts[1]}`, newDbName: parts[1] };
        }
        break;

      case 'describe':
        if (parts[1]) {
          const collStats = await mongoose.connection.db.command({ collStats: parts[1] });
          return { result: collStats };
        }
        break;

      case 'count':
        if (parts[1]) {
          const count = await mongoose.connection.db.collection(parts[1]).countDocuments();
          return { result: `${count} documents in ${parts[1]}` };
        }
        break;

      case 'db':
        if (parts[1] === 'getname()' || parts[1] === 'getname') {
          return { result: mongoose.connection.db.databaseName };
        }
        // If it's just 'db', return information about the current database
        return { result: {
          name: mongoose.connection.db.databaseName,
          collections: await mongoose.connection.db.listCollections().toArray()
        }};
    }
  } catch (error) {
    if (error instanceof Error) {
      return { result: `Error executing special command: ${error.message}` };
    }
    return { result: 'An unknown error occurred while executing the special command' };
  }

  return null; // Return null if it's not a special command
};

export const runMongoDbQuery = async (sessionId: string, companyId: string, input: string): Promise<{ success: boolean; data?: any; error?: string; message?: string; logs?: string }> => {
  let currentDbName = mongoose.connection.db.databaseName;

  try {
    // Input validation
    if (!input || input.trim() === '') {
      throw new Error('Query input cannot be empty');
    }

    const specialCommandResult = await handleSpecialCommands(input, currentDbName);
    
    if (specialCommandResult !== null) {
      if (specialCommandResult.newDbName) {
        currentDbName = specialCommandResult.newDbName;
      }
      return {
        success: true,
        data: specialCommandResult.result,
        message: 'Special command executed successfully',
        logs: logger.getLogs(),
      };
    }
    
    const results = await handleUserQuery(input);
    return {
      success: true,
      data: results,
      message: 'Query executed successfully',
      logs: logger.getLogs(),
    };
  } catch (error) {
    logger.error('Error in runMongoDbQuery:', error);
    let errorMessage = 'An unknown error occurred';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    }

    return {
      success: false,
      error: errorMessage,
      message: 'Failed to execute MongoDB query',
      logs: `${logger.getLogs()}\n\nError details:\n${errorDetails}`,
    };
  } finally {
    logger.clearLogs();
  }
};