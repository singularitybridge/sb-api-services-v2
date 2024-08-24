import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile, createFile } from '../services/jsonbin.service';

export const createJSONBinActions = (context: ActionContext): FunctionFactory => ({
  createJSONBinFile: {
    description: 'Create a new file in JSONBin',
    parameters: {
      type: 'object',
      properties: {
        data: { 
          type: 'object',
          description: 'The data to write to the new file, must be a valid JSON object',
         },
        name: {
          type: 'string',
          description: 'Optional name for the bin (1-128 characters)',
        },
      },
      required: ['name', 'data'],
    },
    function: async (args) => {
      console.log('createJSONBinFile called with arguments:', JSON.stringify(args, null, 2));

      const { data, name } = args;

      if (data === undefined) {
        console.error('createJSONBinFile: data parameter is missing');
        return {
          error: 'Missing data',
          message: 'The required data parameter is missing.',
        };
      }

      // Verify that data is a valid JSON object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        console.error('createJSONBinFile: Invalid data type', typeof data);
        return {
          error: 'Invalid JSON data',
          message: `The provided data must be a valid JSON object. Received type: ${typeof data}`,
        };
      }
      
      try {
        // Attempt to stringify and parse the data to ensure it's valid JSON
        JSON.parse(JSON.stringify(data));
      } catch (error) {
        console.error('createJSONBinFile: Error stringifying data', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided data could not be converted to a valid JSON string.',
        };
      }
      
      // If we've reached this point, the data is valid JSON
      console.log('createJSONBinFile: Calling createFile with valid data');
      return await createFile(context.companyId, data, name);
    },
  },
  updateJSONBinFile: {
    description: 'Update a file in JSONBin',
    parameters: {
      type: 'object',
      properties: {
        binId: { 
          type: 'string',
          description: 'The ID of the file to update',
         },
        data: { 
          type: 'object',
          description: 'The new data to write to the file, always replace the entire JSON content',
         },
      },
      required: ['binId', 'data'],
    },
    function: async ({ binId, data }) => {
      // Verify that data is a valid JSON object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return {
          error: 'Invalid JSON data',
          message: 'The provided data must be a valid JSON object.',
        };
      }
      
      try {
        // Attempt to stringify and parse the data to ensure it's valid JSON
        JSON.parse(JSON.stringify(data));
      } catch (error) {
        return {
          error: 'Invalid JSON data',
          message: 'The provided data could not be converted to a valid JSON string.',
        };
      }
      
      // If we've reached this point, the data is valid JSON
      return await updateFile(context.companyId, binId, data);
    },
  },
  readJSONBinFile: {
    description: 'Read a file from JSONBin',
    parameters: {
      type: 'object',
      properties: {
        binId: { type: 'string' },
      },
      required: ['binId'],
    },
    function: async ({ binId }) => {
      return await readFile(context.companyId, binId);
    },
  },
});
