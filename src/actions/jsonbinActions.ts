import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile, createFile, updateArrayElement, deleteArrayElement, insertArrayElement } from '../services/jsonbin.service';

// Debug logging function
const DEBUG = process.env.DEBUG === 'true';
const debug = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(`[JSONBinActions] ${message}`, ...args);
  }
};

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
      debug('createJSONBinFile called with arguments:', JSON.stringify(args, null, 2));

      const { data, name } = args;

      if (data === undefined || name === undefined) {
        debug('createJSONBinFile: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'Both data and name parameters are required.',
        };
      }

      const allowedProps = ['data', 'name'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        debug('createJSONBinFile: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        debug('createJSONBinFile: Invalid data type', typeof data);
        return {
          error: 'Invalid JSON data',
          message: `The provided data must be a valid JSON object. Received type: ${typeof data}`,
        };
      }

      if (typeof name !== 'string' || name.length < 1 || name.length > 128) {
        debug('createJSONBinFile: Invalid name', name);
        return {
          error: 'Invalid name',
          message: 'The name must be a string between 1 and 128 characters long.',
        };
      }
      
      try {
        JSON.parse(JSON.stringify(data));
      } catch (error) {
        debug('createJSONBinFile: Error stringifying data', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided data could not be converted to a valid JSON string.',
        };
      }
      
      debug('createJSONBinFile: Calling createFile with valid data');
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
      debug('updateJSONBinFile called with arguments:', JSON.stringify(args, null, 2));

      const { binId, data } = args;

      if (binId === undefined || data === undefined) {
        debug('updateJSONBinFile: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'Both binId and data parameters are required.',
        };
      }

      const allowedProps = ['binId', 'data'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        debug('updateJSONBinFile: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        debug('updateJSONBinFile: Invalid data type', typeof data);
        return {
          error: 'Invalid JSON data',
          message: `The provided data must be a valid JSON object. Received type: ${typeof data}`,
        };
      }

      if (typeof binId !== 'string') {
        debug('updateJSONBinFile: Invalid binId', binId);
        return {
          error: 'Invalid binId',
          message: 'The binId must be a string.',
        };
      }
      
      try {
        JSON.parse(JSON.stringify(data));
      } catch (error) {
        debug('updateJSONBinFile: Error stringifying data', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided data could not be converted to a valid JSON string.',
        };
      }
      
      debug('updateJSONBinFile: Calling updateFile with valid data');
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
      debug('updateJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));

      const { binId, arrayKey, elementId, updateData } = args;

      if (binId === undefined || arrayKey === undefined || elementId === undefined || updateData === undefined) {
        debug('updateJSONBinArrayElement: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'All parameters (binId, arrayKey, elementId, updateData) are required.',
        };
      }

      const allowedProps = ['binId', 'arrayKey', 'elementId', 'updateData'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        debug('updateJSONBinArrayElement: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      if (typeof binId !== 'string' || typeof arrayKey !== 'string' || typeof elementId !== 'string') {
        debug('updateJSONBinArrayElement: Invalid parameter types', { binId, arrayKey, elementId });
        return {
          error: 'Invalid parameter types',
          message: 'binId, arrayKey, and elementId must be strings.',
        };
      }

      if (typeof updateData !== 'object' || updateData === null || Array.isArray(updateData)) {
        debug('updateJSONBinArrayElement: Invalid updateData type', typeof updateData);
        return {
          error: 'Invalid JSON data',
          message: `The provided updateData must be a valid JSON object. Received type: ${typeof updateData}`,
        };
      }

      try {
        JSON.parse(JSON.stringify(updateData));
      } catch (error) {
        debug('updateJSONBinArrayElement: Error stringifying updateData', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided updateData could not be converted to a valid JSON string.',
        };
      }

      debug('updateJSONBinArrayElement: Calling updateArrayElement with valid data');
      try {
        const result = await updateArrayElement(context.companyId, binId, arrayKey, elementId, updateData);
        return result;
      } catch (error) {
        debug('updateJSONBinArrayElement: Error updating array element', error);
        return {
          error: 'Update failed',
          message: error instanceof Error ? error.message : 'An unknown error occurred while updating the array element.',
        };
      }
    },
  },
  deleteJSONBinArrayElement: {
    description: 'Delete a specific element from an array within a JSONBin file',
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
          description: 'The ID of the element to delete from the array',
        },
      },
      required: ['binId', 'arrayKey', 'elementId'],
      additionalProperties: false,
    },
    function: async (args) => {
      debug('deleteJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));

      const { binId, arrayKey, elementId } = args;

      if (binId === undefined || arrayKey === undefined || elementId === undefined) {
        debug('deleteJSONBinArrayElement: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'All parameters (binId, arrayKey, elementId) are required.',
        };
      }

      const allowedProps = ['binId', 'arrayKey', 'elementId'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        debug('deleteJSONBinArrayElement: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      if (typeof binId !== 'string' || typeof arrayKey !== 'string' || typeof elementId !== 'string') {
        debug('deleteJSONBinArrayElement: Invalid parameter types', { binId, arrayKey, elementId });
        return {
          error: 'Invalid parameter types',
          message: 'binId, arrayKey, and elementId must be strings.',
        };
      }

      debug('deleteJSONBinArrayElement: Calling deleteArrayElement with valid data');
      try {
        const result = await deleteArrayElement(context.companyId, binId, arrayKey, elementId);
        return result;
      } catch (error) {
        debug('deleteJSONBinArrayElement: Error deleting array element', error);
        return {
          error: 'Delete failed',
          message: error instanceof Error ? error.message : 'An unknown error occurred while deleting the array element.',
        };
      }
    },
  },
  insertJSONBinArrayElement: {
    description: 'Insert a new element into an array within a JSONBin file',
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
        newElement: {
          type: 'object',
          description: 'The new element to insert into the array',
        },
      },
      required: ['binId', 'arrayKey', 'newElement'],
      additionalProperties: false,
    },
    function: async (args) => {
      debug('insertJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));

      const { binId, arrayKey, newElement } = args;

      if (binId === undefined || arrayKey === undefined || newElement === undefined) {
        debug('insertJSONBinArrayElement: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'All parameters (binId, arrayKey, newElement) are required.',
        };
      }

      const allowedProps = ['binId', 'arrayKey', 'newElement'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        debug('insertJSONBinArrayElement: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      if (typeof binId !== 'string' || typeof arrayKey !== 'string') {
        debug('insertJSONBinArrayElement: Invalid parameter types', { binId, arrayKey });
        return {
          error: 'Invalid parameter types',
          message: 'binId and arrayKey must be strings.',
        };
      }

      if (typeof newElement !== 'object' || newElement === null || Array.isArray(newElement)) {
        debug('insertJSONBinArrayElement: Invalid newElement type', typeof newElement);
        return {
          error: 'Invalid JSON data',
          message: `The provided newElement must be a valid JSON object. Received type: ${typeof newElement}`,
        };
      }

      try {
        JSON.parse(JSON.stringify(newElement));
      } catch (error) {
        debug('insertJSONBinArrayElement: Error stringifying newElement', error);
        return {
          error: 'Invalid JSON data',
          message: 'The provided newElement could not be converted to a valid JSON string.',
        };
      }

      debug('insertJSONBinArrayElement: Calling insertArrayElement with valid data');
      try {
        const result = await insertArrayElement(context.companyId, binId, arrayKey, newElement);
        return result;
      } catch (error) {
        debug('insertJSONBinArrayElement: Error inserting array element', error);
        return {
          error: 'Insert failed',
          message: error instanceof Error ? error.message : 'An unknown error occurred while inserting the array element.',
        };
      }
    },
  },
});
