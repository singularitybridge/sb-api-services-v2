import { ActionContext, FunctionFactory } from '../actions/types';
import { getSessionInfo } from './debug.service';

export const createDebugActions = (context: ActionContext): FunctionFactory => ({
  getSessionInfo: {
    description: 'Get basic session info for debug purposes',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      try {
        const result = await getSessionInfo(context.sessionId, context.companyId);
        return result;
      } catch (error) {
        console.error('Error in getSessionInfo action:', error);
        return { success: false, error: 'Failed to get session info' };
      }
    },
  },
});