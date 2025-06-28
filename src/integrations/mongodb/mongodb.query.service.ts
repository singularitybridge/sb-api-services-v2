import mongoose from 'mongoose';
import { Collection, Filter, Sort, UpdateFilter, ObjectId } from 'mongodb';
import { logger } from '../../utils/logger';

// Define the type for query parameters
type QueryParams = {
  collection: string;
  operation: 'find' | 'updateOne' | 'updateMany';
  filter: Filter<any>;
  update?: UpdateFilter<any>;
  projection?: any;
  limit?: number;
  skip?: number;
  sort?: Sort;
};

// Get a collection
const getCollection = (collectionName: string): Collection => {
  return mongoose.connection.db.collection(
    collectionName,
  ) as unknown as Collection;
};

// Execute a query
const executeQuery = async (queryParams: QueryParams): Promise<any> => {
  try {
    logger.log(
      'Executing query with params:',
      JSON.stringify(queryParams, null, 2),
    );
    logger.log('Connected to database:', mongoose.connection.db.databaseName);

    const collection = getCollection(queryParams.collection);

    if (queryParams.operation === 'find') {
      let query = collection.find(queryParams.filter, queryParams.projection);

      if (queryParams.skip) {
        query = query.skip(queryParams.skip);
      }

      if (queryParams.limit) {
        query = query.limit(queryParams.limit);
      }

      if (queryParams.sort) {
        query = query.sort(queryParams.sort);
      }

      const result = await query.toArray();
      logger.log('Raw query result:', JSON.stringify(result, null, 2));
      return result;
    } else if (
      queryParams.operation === 'updateOne' ||
      queryParams.operation === 'updateMany'
    ) {
      const result = await executeUpdate(collection, queryParams);
      logger.log('Raw update result:', JSON.stringify(result, null, 2));
      return result;
    }
  } catch (error) {
    logger.error('Error executing query', error);
    throw new Error(
      `Failed to execute query: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
};

// Execute update operation
const executeUpdate = async (
  collection: Collection,
  queryParams: QueryParams,
): Promise<any> => {
  if (!queryParams.update) {
    throw new Error('Update operation requires an update parameter');
  }

  if (queryParams.operation === 'updateOne') {
    return await collection.updateOne(queryParams.filter, queryParams.update);
  } else if (queryParams.operation === 'updateMany') {
    return await collection.updateMany(queryParams.filter, queryParams.update);
  }
};

// Helper function to replace ObjectId strings with actual ObjectId objects
const replaceObjectIds = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(replaceObjectIds);
  }

  const result: { [key: string]: any } = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      typeof value === 'string' &&
      value.startsWith('ObjectId(') &&
      value.endsWith(')')
    ) {
      const idString = value.slice(9, -1).replace(/['"]/g, '');
      result[key] = new ObjectId(idString);
    } else if (typeof value === 'object') {
      result[key] = replaceObjectIds(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

// Parse user input to create a query
const parseUserInput = (input: string): QueryParams => {
  const regex =
    /db\.(\w+)\.(\w+)\((.*?)(,\s*{.*?})?\)(?:\.limit\((\d+)\))?(?:\.skip\((\d+)\))?(?:\.sort\((.*?)\))?/;
  const match = input.match(regex);

  if (!match) {
    throw new Error(
      'Invalid query format. Expected format: db.collection.operation(filter, update/projection).limit().skip().sort()',
    );
  }

  const [
    ,
    collection,
    operation,
    filterStr,
    updateOrProjectionStr,
    limitValue,
    skipValue,
    sortValue,
  ] = match;

  let filter: Filter<any> = {};
  let update: UpdateFilter<any> | undefined;
  let projection: any = undefined;
  let limit: number | undefined;
  let skip: number | undefined;
  let sort: Sort | undefined;

  if (filterStr) {
    try {
      filter = replaceObjectIds(eval(`(${filterStr})`));
    } catch (error) {
      logger.error('Failed to parse filter:', error);
      throw new Error(
        `Invalid filter format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  if (updateOrProjectionStr) {
    try {
      const parsed = replaceObjectIds(
        eval(`(${updateOrProjectionStr.slice(1)})`),
      );
      if (operation === 'find') {
        projection = parsed;
      } else if (operation === 'updateOne' || operation === 'updateMany') {
        update = parsed;
      }
    } catch (error) {
      logger.error('Failed to parse update/projection:', error);
      throw new Error(
        `Invalid update/projection format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  if (limitValue) {
    limit = parseInt(limitValue, 10);
  }

  if (skipValue) {
    skip = parseInt(skipValue, 10);
  }

  if (sortValue) {
    try {
      sort = replaceObjectIds(eval(`(${sortValue})`));
    } catch (error) {
      logger.error('Failed to parse sort:', error);
      throw new Error(
        `Invalid sort format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  if (!['find', 'updateOne', 'updateMany'].includes(operation)) {
    throw new Error(
      `Unsupported operation: ${operation}. Supported operations are: find, updateOne, updateMany`,
    );
  }

  return {
    collection,
    operation: operation as QueryParams['operation'],
    filter,
    update,
    projection,
    limit,
    skip,
    sort,
  };
};

// Main function to handle user input and execute query
const handleUserQuery = async (input: string): Promise<any> => {
  try {
    const queryParams = parseUserInput(input);
    logger.log('Parsed query params:', JSON.stringify(queryParams, null, 2));
    return await executeQuery(queryParams);
  } catch (error) {
    logger.error('Error handling user query:', error);
    throw new Error(
      `Failed to handle user query: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
};

export { handleUserQuery };
