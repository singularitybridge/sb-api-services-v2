import { ActionContext, FunctionFactory } from './types';
import { readFile, updateFile } from '../services/jsonbin.service';

export const createJSONBinActions = (context: ActionContext): FunctionFactory => ({
  updateJSONBinFile: {
    description: 'Update a file in JSONBin',
    parameters: {
      type: 'object',
      properties: {
        binId: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['binId', 'data'],
    },
    function: async ({ binId, data }) => {
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
