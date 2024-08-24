import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile, createFile } from '../services/jsonbin.service';

export const createJSONBinActions = (context: ActionContext): FunctionFactory => ({
  createJSONBinFile: {
    description: 'Create a new file in JSONBin',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        data: { 
          type: 'object',
          description: 'The data to write to the new file, must be a valid JSON object',
        },
        name: {
          type: 'string',
          description: 'Name for the bin (1-128 characters), englsih letters, numbers, and underscores only',
        },
      },
      required: ['data', 'name'],
      additionalProperties: false,
    },
    function: async (args) => {
      console.log('createJSONBinFile called with arguments:', JSON.stringify(args, null, 2));

      const { data, name } = args;

      // Check if all required properties are present
      if (data === undefined || name === undefined) {
        console.error('createJSONBinFile: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'Both data and name parameters are required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['data', 'name'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('createJSONBinFile: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
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

      // Verify that name is a string and within the correct length
      if (typeof name !== 'string' || name.length < 1 || name.length > 128) {
        console.error('createJSONBinFile: Invalid name', name);
        return {
          error: 'Invalid name',
          message: 'The name must be a string between 1 and 128 characters long.',
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
