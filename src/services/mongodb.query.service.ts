import { MongoClient, Collection, Filter, Sort } from 'mongodb';

// Define the type for query parameters
type QueryParams = {
  collection: string;
  filter: Filter<any>;
  limit?: number;
  skip?: number;
  sort?: Sort;
};

// MongoDB connection string should be stored in an environment variable
const MONGODB_URI = process.env.MONGODB_URI || '';


// Create a MongoDB client
const client = new MongoClient(MONGODB_URI);

// Connect to MongoDB
const connectToMongoDB = async (): Promise<void> => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
};

// Get a collection
const getCollection = (collectionName: string): Collection => {
  return client.db().collection(collectionName);
};

// Execute a query
const executeQuery = async ({ collection, filter, limit = 0, skip = 0, sort }: QueryParams): Promise<any[]> => {
  try {
    const result = await getCollection(collection)
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sort || {})
      .toArray();
    return result;
  } catch (error) {
    console.error('Error executing query', error);
    throw error;
  }
};

// Parse user input to create a query
const parseUserInput = (input: string): QueryParams => {
  // This is a simplified parser. In a real-world scenario, you'd want to use a more robust parsing mechanism.
  const [collection, ...rest] = input.split(' ');
  const filterString = rest.join(' ');
  
  // Very basic filter parsing - this should be much more sophisticated in a real application
  const filter: Filter<any> = {};
  if (filterString.includes('finished onboarding')) {
    filter.onboardingCompleted = true;
  }
  
  return { collection, filter };
};

// Main function to handle user input and execute query
const handleUserQuery = async (input: string): Promise<any[]> => {
  const queryParams = parseUserInput(input);
  return executeQuery(queryParams);
};

export { connectToMongoDB, handleUserQuery };