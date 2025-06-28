import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, updateUiElement } from './agent_ui_framework.service';
import { executeAction } from '../actions/executor';
import { ActionExecutionError } from '../../utils/actionErrors'; // ActionValidationError might not be needed if args are handled by framework

// Define expected data shapes for StandardActionResult for clarity
interface UiFrameworkContextData {
  uiContext: any; // Replace 'any' with the actual type of UI context
}
interface UpdateUiElementResultData {
  updated: boolean;
}

interface UpdateUiElementArgs {
  type: string;
  id: string;
  data: any;
}

export const createAgentUiFrameworkActions = (
  context: ActionContext,
): FunctionFactory => ({
  getUiContext: {
    description: 'Get the current UI context',
    parameters: {
      type: 'object',
      properties: {},
      required: [], // Added required property as empty array since there are no required parameters
      additionalProperties: false,
    },
    function: async () => {
      const actionName = 'getUiContext';
      // Assuming context.sessionId is validated/guaranteed by the framework

      return executeAction<UiFrameworkContextData>(
        actionName,
        async () => {
          const uiCtx = await getUiContext(context.sessionId);
          return { success: true, data: { uiContext: uiCtx } };
        },
        { serviceName: 'AgentUiFrameworkService' },
      );
    },
  },

  updateUiElement: {
    description: 'Update a UI element with the provided data',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'The type of UI element to update',
        },
        id: {
          type: 'string',
          description: 'The ID of the UI element to update',
        },
        data: {
          type: 'object',
          description: 'The data to update the UI element with',
        },
      },
      required: ['type', 'id', 'data'],
      additionalProperties: false,
    },
    function: async (args: UpdateUiElementArgs) => {
      const { type, id, data } = args;
      const actionName = 'updateUiElement';
      // Assuming context.sessionId is validated/guaranteed
      // Args type, id, data are marked as required in parameters, so framework should ensure they exist.

      return executeAction<UpdateUiElementResultData>(
        actionName,
        async () => {
          const successStatus = await updateUiElement(context.sessionId, {
            type,
            id,
            data,
          });
          // The service returns a boolean. We shape the result for executeAction.
          // If successStatus is false, executeAction will throw ActionServiceError.
          return { success: successStatus, data: { updated: successStatus } };
        },
        { serviceName: 'AgentUiFrameworkService' },
      );
    },
  },
});
