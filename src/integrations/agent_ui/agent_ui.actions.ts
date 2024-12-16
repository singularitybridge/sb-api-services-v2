import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, updateUiElement } from './agent_ui.service';

interface UpdateUiElementArgs {
  type: string;
  id: string;
  data: any;
}

export const createAgentUiActions = (context: ActionContext): FunctionFactory => ({
  getUiContext: {
    description: 'Get the current UI context',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [], // Added required property as empty array since there are no required parameters
      additionalProperties: false,
    },
    function: async () => {
      try {
        const uiContext = await getUiContext(context.companyId);
        return {
          success: true,
          data: { uiContext }
        };
      } catch (error) {
        console.error('getUiContext: Error getting UI context', error);
        return {
          success: false,
          error: 'Failed to get UI context',
          message: 'An error occurred while getting the UI context.',
        };
      }
    },
  },

  updateUiElement: {
    description: 'Update a UI element',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of UI element to update'
        },
        id: {
          type: 'string',
          description: 'ID of the UI element'
        },
        data: {
          type: 'object',
          description: 'Data to update the UI element with'
        }
      },
      required: ['type', 'id', 'data'],
      additionalProperties: false,
    },
    function: async (args: UpdateUiElementArgs) => {
      const { type, id, data } = args;

      if (!type || !id) {
        return {
          success: false,
          error: 'Invalid parameters',
          message: 'Type and ID are required.',
        };
      }

      try {
        const result = await updateUiElement(context.companyId, { type, id, data });
        return result;
      } catch (error) {
        console.error('updateUiElement: Error updating UI element', error);
        return {
          success: false,
          error: 'Failed to update UI element',
          message: 'An error occurred while updating the UI element.',
        };
      }
    },
  },
});
