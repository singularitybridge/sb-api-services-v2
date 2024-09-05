import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile, createFile, updateArrayElement } from '../services/jsonbin.service';

export const createJSONBinActions = (context: ActionContext): FunctionFactory => ({
  createJSONBinFile: {
    description: 'Create a new file in JSONBin',
    strict: false,
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
    strict: false,
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
      additionalProperties: false,
    },
    function: async (args) => {
      console.log('updateJSONBinFile called with arguments:', JSON.stringify(args, null, 2));

      const { binId, data } = args;

      // Check if all required properties are present
      if (binId === undefined || data === undefined) {
        console.error('updateJSONBinFile: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'Both binId and data parameters are required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['binId', 'data'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('updateJSONBinFile: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      // Verify that data is a valid JSON object
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        console.error('updateJSONBinFile: Invalid data type', typeof data);
        return {
          error: 'Invalid JSON data',
          message: `The provided data must be a valid JSON object. Received type: ${typeof data}`,
        };
      }

      // Verify that binId is a string
      if (typeof binId !== 'string') {
        console.error('updateJSONBinFile: Invalid binId', binId);
        return {
          error: 'Invalid binId',
          message: 'The binId must be a string.',
        };
      }
      
      try {
        // Attempt to stringify and parse the data to ensure it's valid JSON
        JSON.parse(JSON.stringify(data));
      } catch (error) {
        console.error('updateJSONBinFile: Error stringifying data', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided data could not be converted to a valid JSON string.',
        };
      }
      
      // If we've reached this point, the data is valid JSON
      console.log('updateJSONBinFile: Calling updateFile with valid data');
      return await updateFile(context.companyId, binId, data);
    },
  },
  readJSONBinFile: {
    description: 'Read a file from JSONBin',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        binId: { type: 'string' },
      },
      required: ['binId'],
      additionalProperties: false,
    },
    function: async ({ binId }) => {
      return await readFile(context.companyId, binId);
    },
  },
  updateJSONBinArrayElement: {
    description: 'Update a specific element in an array within a JSONBin file',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        binId: { 
          type: 'string',
          description: 'The ID of the file to update',
        },
        arrayKey: {
          type: 'string',
          description: 'The key of the array in the JSON object',
        },
        elementId: {
          type: 'string',
          description: 'The ID of the element to update within the array',
        },
        updateData: {
          type: 'object',
          description: 'The data to update the element with',
        },
      },
      required: ['binId', 'arrayKey', 'elementId', 'updateData'],
      additionalProperties: false,
    },
    function: async (args) => {
      console.log('updateJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));

      const { binId, arrayKey, elementId, updateData } = args;

      // Check if all required properties are present
      if (binId === undefined || arrayKey === undefined || elementId === undefined || updateData === undefined) {
        console.error('updateJSONBinArrayElement: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'All parameters (binId, arrayKey, elementId, updateData) are required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['binId', 'arrayKey', 'elementId', 'updateData'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('updateJSONBinArrayElement: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      // Verify that binId, arrayKey, and elementId are strings
      if (typeof binId !== 'string' || typeof arrayKey !== 'string' || typeof elementId !== 'string') {
        console.error('updateJSONBinArrayElement: Invalid parameter types', { binId, arrayKey, elementId });
        return {
          error: 'Invalid parameter types',
          message: 'binId, arrayKey, and elementId must be strings.',
        };
      }

      // Verify that updateData is a valid JSON object
      if (typeof updateData !== 'object' || updateData === null || Array.isArray(updateData)) {
        console.error('updateJSONBinArrayElement: Invalid updateData type', typeof updateData);
        return {
          error: 'Invalid JSON data',
          message: `The provided updateData must be a valid JSON object. Received type: ${typeof updateData}`,
        };
      }

      try {
        // Attempt to stringify and parse the updateData to ensure it's valid JSON
        JSON.parse(JSON.stringify(updateData));
      } catch (error) {
        console.error('updateJSONBinArrayElement: Error stringifying updateData', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided updateData could not be converted to a valid JSON string.',
        };
      }

      // If we've reached this point, all parameters are valid
      console.log('updateJSONBinArrayElement: Calling updateArrayElement with valid data');
      try {
        const result = await updateArrayElement(context.companyId, binId, arrayKey, elementId, updateData);
        return result;
      } catch (error) {
        console.error('updateJSONBinArrayElement: Error updating array element', error);
        return {
          error: 'Update failed',
          message: error instanceof Error ? error.message : 'An unknown error occurred while updating the array element.',
        };
      }
    },
  },
});
