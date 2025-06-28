import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { jsonbinService } from './jsonbin.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

// Define input argument interfaces
interface CreateJSONBinFileArgs {
  data: Record<string, any>;
  name: string;
}
interface UpdateJSONBinFileArgs {
  binId: string;
  data: Record<string, any>;
}
interface ReadJSONBinFileArgs {
  binId: string;
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

// Define R types for StandardActionResult<R>
type EmptyData = Record<string, never>;
type ReadFileData = Record<string, any>;
interface CloneFileData {
  clonedBinId: string;
}

// Define S type (service call lambda's response) for executeAction
interface ServiceLambdaResponse<R_Payload = any> {
  success: boolean;
  data?: R_Payload;
  error?: string;
  description?: string;
  clonedBinId?: string; // Specific to cloneFile service response
}

const SERVICE_NAME = 'jsonbinService';

export const createJSONBinActions = (
  context: ActionContext,
): FunctionFactory => ({
  createJSONBinFile: {
    description: 'Create a new file in JSONBin',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description:
            'The data to write to the new file, must be a valid JSON object',
        },
        name: {
          type: 'string',
          description:
            'Name for the bin (1-128 characters), english letters, numbers, and underscores only',
        },
      },
      required: ['data', 'name'],
      additionalProperties: false,
    },
    function: async (
      args: CreateJSONBinFileArgs,
    ): Promise<StandardActionResult<EmptyData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.data || !args.name)
        throw new ActionValidationError('Data and name are required.');
      return executeAction<EmptyData, ServiceLambdaResponse<EmptyData>>(
        'createJSONBinFile',
        async () => {
          const res = await jsonbinService.createFile(
            context.companyId!,
            args.data,
            args.name,
          );
          return {
            ...res,
            description: res.error,
            data: res.success ? {} : undefined,
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
          description:
            'The new data to write to the file, always replace the entire JSON content',
        },
      },
      required: ['binId', 'data'],
      additionalProperties: false,
    },
    function: async (
      args: UpdateJSONBinFileArgs,
    ): Promise<StandardActionResult<EmptyData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId || !args.data)
        throw new ActionValidationError('Bin ID and data are required.');
      return executeAction<EmptyData, ServiceLambdaResponse<EmptyData>>(
        'updateJSONBinFile',
        async () => {
          const res = await jsonbinService.updateFile(
            context.companyId!,
            args.binId,
            args.data,
          );
          return {
            ...res,
            description: res.error,
            data: res.success ? {} : undefined,
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (
      args: ReadJSONBinFileArgs,
    ): Promise<StandardActionResult<ReadFileData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId) throw new ActionValidationError('Bin ID is required.');
      return executeAction<ReadFileData, ServiceLambdaResponse<ReadFileData>>(
        'readJSONBinFile',
        async () => {
          const res = await jsonbinService.readFile(
            context.companyId!,
            args.binId,
          );
          // res.data from service is already ReadFileData
          return { ...res, description: res.error };
        },
        { serviceName: SERVICE_NAME },
      );
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
          description:
            'Whether to use deep merge instead of shallow update (default: false)',
        },
      },
      required: ['binId', 'arrayKey', 'elementId', 'updateData'],
      additionalProperties: false,
    },
    function: async (
      args: UpdateJSONBinArrayElementArgs,
    ): Promise<StandardActionResult<EmptyData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId || !args.arrayKey || !args.elementId || !args.updateData)
        throw new ActionValidationError(
          'binId, arrayKey, elementId, and updateData are required.',
        );
      return executeAction<EmptyData, ServiceLambdaResponse<EmptyData>>(
        'updateJSONBinArrayElement',
        async () => {
          const res = await jsonbinService.updateArrayElement(
            context.companyId!,
            args.binId,
            args.arrayKey,
            args.elementId,
            args.updateData,
            args.useMerge,
          );
          return {
            ...res,
            description: res.error,
            data: res.success ? {} : undefined,
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
  deleteJSONBinArrayElement: {
    description:
      'Delete a specific element from an array within a JSONBin file',
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
    function: async (
      args: DeleteJSONBinArrayElementArgs,
    ): Promise<StandardActionResult<EmptyData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId || !args.arrayKey || !args.elementId)
        throw new ActionValidationError(
          'binId, arrayKey, and elementId are required.',
        );
      return executeAction<EmptyData, ServiceLambdaResponse<EmptyData>>(
        'deleteJSONBinArrayElement',
        async () => {
          const res = await jsonbinService.deleteArrayElement(
            context.companyId!,
            args.binId,
            args.arrayKey,
            args.elementId,
          );
          return {
            ...res,
            description: res.error,
            data: res.success ? {} : undefined,
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (
      args: InsertJSONBinArrayElementArgs,
    ): Promise<StandardActionResult<EmptyData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId || !args.arrayKey || !args.newElement)
        throw new ActionValidationError(
          'binId, arrayKey, and newElement are required.',
        );
      return executeAction<EmptyData, ServiceLambdaResponse<EmptyData>>(
        'insertJSONBinArrayElement',
        async () => {
          const res = await jsonbinService.insertArrayElement(
            context.companyId!,
            args.binId,
            args.arrayKey,
            args.newElement,
          );
          return {
            ...res,
            description: res.error,
            data: res.success ? {} : undefined,
          };
        },
        { serviceName: SERVICE_NAME },
      );
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
    function: async (
      args: CloneJSONBinFileArgs,
    ): Promise<StandardActionResult<CloneFileData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.binId) throw new ActionValidationError('Bin ID is required.');
      return executeAction<CloneFileData, ServiceLambdaResponse<CloneFileData>>(
        'cloneJSONBinFile',
        async () => {
          // service returns { success: true, clonedBinId } or { success: false, error }
          const res = await jsonbinService.cloneFile(
            context.companyId!,
            args.binId,
          );
          return {
            success: res.success,
            // Ensure S.data (which becomes R) is correctly shaped
            data:
              res.success && res.clonedBinId
                ? { clonedBinId: res.clonedBinId }
                : undefined,
            description: res.error,
            error: res.error, // Keep original error for S type if needed
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
