import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile } from '../services/jsonbin.service';

export const createJSONBinActions = (context: ActionContext): FunctionFactory => ({
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
