import { ActionContext, FunctionFactory } from '../actions/types';
import { jsonbinService } from './jsonbin.service';

// Debug logging function
const DEBUG = process.env.DEBUG === 'true';
const debug = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(`[JSONBinActions] ${message}`, ...args);
  }
};

interface CreateJSONBinFileArgs {
  data: Record<string, any>;
  name: string;
}

interface UpdateJSONBinFileArgs {
  binId: string;
  data: Record<string, any>;
}

interface UpdateJSONBinArrayElementArgs {
  binId: string;
  arrayKey: string;
  elementId: string;
  updateData: Record<string, any>;
  useMerge?: boolean;
}

interface DeleteJSONBinArrayElementArgs {
  binId: string;
  arrayKey: string;
  elementId: string;
}

interface InsertJSONBinArrayElementArgs {
  binId: string;
  arrayKey: string;
  newElement: Record<string, any>;
}

interface CloneJSONBinFileArgs {
  binId: string;
}

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
          description: 'Name for the bin (1-128 characters), english letters, numbers, and underscores only',
        },
      },
      required: ['data', 'name'],
      additionalProperties: false,
    },
    function: async (args: CreateJSONBinFileArgs) => {
      debug('createJSONBinFile called with arguments:', JSON.stringify(args, null, 2));
      const { data, name } = args;
      return await jsonbinService.createFile(context.companyId, data, name);
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
    function: async (args: UpdateJSONBinFileArgs) => {
      debug('updateJSONBinFile called with arguments:', JSON.stringify(args, null, 2));
      const { binId, data } = args;
      return await jsonbinService.updateFile(context.companyId, binId, data);
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
    function: async ({ binId }: { binId: string }) => {
      return await jsonbinService.readFile(context.companyId, binId);
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
        useMerge: {
          type: 'boolean',
          description: 'Whether to use deep merge instead of shallow update (default: false)',
        },
      },
      required: ['binId', 'arrayKey', 'elementId', 'updateData'],
      additionalProperties: false,
    },
    function: async (args: UpdateJSONBinArrayElementArgs) => {
      debug('updateJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));
      const { binId, arrayKey, elementId, updateData, useMerge = false } = args;
      return await jsonbinService.updateArrayElement(context.companyId, binId, arrayKey, elementId, updateData, useMerge);
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
    function: async (args: DeleteJSONBinArrayElementArgs) => {
      debug('deleteJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));
      const { binId, arrayKey, elementId } = args;
      return await jsonbinService.deleteArrayElement(context.companyId, binId, arrayKey, elementId);
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
    function: async (args: InsertJSONBinArrayElementArgs) => {
      debug('insertJSONBinArrayElement called with arguments:', JSON.stringify(args, null, 2));
      const { binId, arrayKey, newElement } = args;
      return await jsonbinService.insertArrayElement(context.companyId, binId, arrayKey, newElement);
    },
  },
  cloneJSONBinFile: {
    description: 'Clone a JSONBin file',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        binId: { 
          type: 'string',
          description: 'The ID of the file to clone',
        },
      },
      required: ['binId'],
      additionalProperties: false,
    },
    function: async (args: CloneJSONBinFileArgs) => {
      debug('cloneJSONBinFile called with arguments:', JSON.stringify(args, null, 2));
      const { binId } = args;
      return await jsonbinService.cloneFile(context.companyId, binId);
    },
  },
});
