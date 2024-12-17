import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, executeUiMethod } from './agent_ui.service';

interface ExecuteUiMethodArgs {
  method: string;
  pageId: string;
  params: Record<string, any>;
}

export const createAgentUiActions = (context: ActionContext): FunctionFactory => ({
  getUiContext: {
    description: 'Get the current UI context',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      const result = await getUiContext(context.companyId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get UI context',
          message: 'An error occurred while getting the UI context.',
        };
      }

      return {
        success: true,
        data: { uiContext: result.data }
      };
    },
  },

  executeUiMethod: {
    description: 'Execute a UI method with parameters',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'Method to execute (e.g., updateGoal, setFilter)'
        },
        pageId: {
          type: 'string',
          description: 'ID of the page where the method should be executed'
        },
        params: {
          type: 'object',
          description: 'Parameters for the method',
          additionalProperties: true
        }
      },
      required: ['method', 'pageId', 'params'],
      additionalProperties: false,
    },
    function: async (args: ExecuteUiMethodArgs) => {
      const { method, pageId, params } = args;

      if (!method || !pageId) {
        return {
          success: false,
          error: 'Invalid parameters',
          message: 'Method and pageId are required.',
        };
      }

      const result = await executeUiMethod(context.companyId, { method, pageId, params });
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to execute UI method',
          message: 'An error occurred while executing the UI method.',
        };
      }

      return {
        success: true,
        data: result.data
      };
    },
  },
});
