import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, executeUiMethod } from './agent_ui.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError, ActionExecutionError } from '../../utils/actionErrors';

// Define expected data shapes for StandardActionResult for clarity
interface UiContextData {
  uiContext: any; // Replace 'any' with the actual type of UI context
}
type UiMethodResult = any; // Replace 'any' with the actual type of UI method result

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
      const actionName = 'getUiContext';
      // Assuming context.companyId is validated/guaranteed by the framework

      return executeAction<UiContextData>(
        actionName,
        async () => {
          const serviceResult = await getUiContext(context.companyId);
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          if (serviceResult.success) {
            return { success: true, data: { uiContext: serviceResult.data } };
          }
          // Fallback for unexpected serviceResult structure, though executeAction would likely treat it as error
          return serviceResult; 
        },
        { serviceName: 'AgentUIService' }
      );
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
      const actionName = 'executeUiMethod';

      if (!method) {
        throw new ActionValidationError('Method is required.', { fieldErrors: { method: 'Method is required.' } });
      }
      if (!pageId) {
        throw new ActionValidationError('pageId is required.', { fieldErrors: { pageId: 'pageId is required.' } });
      }
      // Assuming context.companyId is validated/guaranteed

      return executeAction<UiMethodResult>(
        actionName,
        async () => {
          const serviceResult = await executeUiMethod(context.companyId, { method, pageId, params });
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          // On success, serviceResult.data is used directly by executeAction by default.
          return serviceResult;
        },
        { serviceName: 'AgentUIService' }
      );
    },
  },
});
