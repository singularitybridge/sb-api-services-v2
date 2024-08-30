import mongoose from 'mongoose';
import { Collection, Filter, Sort } from 'mongodb';

// Define the type for query parameters
type QueryParams = {
  collection: string;
  filter: Filter<any>;
  limit?: number;
  skip?: number;
  sort?: Sort;
};

// Get a collection
const getCollection = (collectionName: string): Collection => {
  return mongoose.connection.db.collection(collectionName) as unknown as Collection;
};

// Execute a query
const executeQuery = async (queryParams: QueryParams): Promise<any[]> => {
  try {
    let query = getCollection(queryParams.collection).find(queryParams.filter);

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
    return result;
  } catch (error) {
    console.error('Error executing query', error);
    throw error;
  }
};

// Parse user input to create a query
const parseUserInput = (input: string): QueryParams => {
  const regex = /db\.(\w+)\.(\w+)\((.*)\)(?:\.(\w+)\((\d*)\))?(?:\.(\w+)\(\))?/;
  const match = input.match(regex);

  if (!match) {
    throw new Error('Invalid query format');
  }

  const [, collection, operation, args, limitOrSkip, limitOrSkipValue, toArray] = match;

  let filter: Filter<any> = {};
  let limit: number | undefined;
  let skip: number | undefined;

  if (operation === 'find' && args) {
    try {
      filter = JSON.parse(args);
    } catch (error) {
      console.warn('Failed to parse filter, using empty filter');
    }
  }

  if (limitOrSkip === 'limit') {
    limit = parseInt(limitOrSkipValue, 10);
  } else if (limitOrSkip === 'skip') {
    skip = parseInt(limitOrSkipValue, 10);
  }

  return { collection, filter, limit, skip };
};

// Main function to handle user input and execute query
const handleUserQuery = async (input: string): Promise<any[]> => {
  const queryParams = parseUserInput(input);
  return executeQuery(queryParams);
};

export { handleUserQuery };