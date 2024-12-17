import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, updateUiElement } from './agent_ui_framework.service';

interface UpdateUiElementArgs {
  type: string;
  id: string;
  data: any;
}

export const createAgentUiFrameworkActions = (context: ActionContext): FunctionFactory => ({
  getUiContext: {
    description: 'Get the current UI context',
    parameters: {
      type: 'object',
      properties: {},
      required: [], // Added required property as empty array since there are no required parameters
      additionalProperties: false,
    },
    function: async () => {
      try {
        const uiContext = await getUiContext(context.sessionId);
        return {
          success: true,
          data: { uiContext },
        };
      } catch (error) {
        console.error('getUiContext: Error getting UI context', error);
        throw new Error('Failed to get UI context');
      }
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

      try {
        const success = await updateUiElement(context.sessionId, { type, id, data });
        return {
          success,
          data: { updated: success },
        };
      } catch (error) {
        console.error('updateUiElement: Error updating UI element', error);
        throw new Error('Failed to update UI element');
      }
    },
  },
});
