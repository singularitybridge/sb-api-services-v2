import { ActionContext, FunctionFactory } from '../actions/types';
import { getUiContext, executeUiAction } from './agent_hub_ui_context.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

// Define expected data shapes for StandardActionResult
interface UiContextData {
  uiContext: any;
}

interface ExecuteUiActionArgs {
  action: string;
  params: Record<string, any>;
}

/**
 * Standalone function to get UI context (for MCP tools)
 */
export async function getAgentHubUiContext(companyId: string) {
  return await getUiContext(companyId);
}

/**
 * Standalone function to execute UI action (for MCP tools)
 */
export async function executeAgentHubUiAction(
  companyId: string,
  action: string,
  params: Record<string, any>,
) {
  return await executeUiAction(companyId, { action, params });
}

export const createAgentHubUiContextActions = (
  context: ActionContext,
): FunctionFactory => ({
  getAgentHubUiContext: {
    description:
      'Get the current UI context from the Agent Hub chat interface. Returns information about the current page the user is viewing, including route, workspace file being viewed (with full content), assistant ID, and session ID. Use this to understand what the user is currently looking at in the UI.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      const actionName = 'getAgentHubUiContext';

      return executeAction<UiContextData>(
        actionName,
        async () => {
          const serviceResult = await getUiContext(context.companyId);
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          if (serviceResult.success) {
            return { success: true, data: { uiContext: serviceResult.data } };
          }
          return serviceResult;
        },
        { serviceName: 'AgentHubUiContextService' },
      );
    },
  },

  executeAgentHubUiAction: {
    description:
      'Execute a UI action in the Agent Hub chat interface. Available actions: navigateToPage (navigate to a route), openWorkspaceFile (open a specific workspace file for an assistant), showNotification (show a toast notification to the user), pushMessageToChat (push a message to chat - DUAL UPDATE: saves to database + broadcasts via Pusher for all clients + immediate RPC update)',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The UI action to execute',
          enum: [
            'navigateToPage',
            'openWorkspaceFile',
            'showNotification',
            'pushMessageToChat',
          ],
        },
        params: {
          type: 'object',
          description:
            'Parameters for the action. For navigateToPage: {path: string}. For openWorkspaceFile: {assistantId: string, path: string}. For showNotification: {message: string, type?: "success"|"error"|"info"}. For pushMessageToChat: {content: string, role?: "user"|"assistant", metadata?: object} - Saves to MongoDB, broadcasts via Pusher to all clients, and provides immediate RPC update',
          additionalProperties: true,
        },
      },
      required: ['action', 'params'],
      additionalProperties: false,
    },
    function: async (args: ExecuteUiActionArgs) => {
      const { action, params } = args;
      const actionName = 'executeAgentHubUiAction';

      if (!action) {
        throw new ActionValidationError('Action is required.', {
          fieldErrors: { action: 'Action is required.' },
        });
      }
      if (!params) {
        throw new ActionValidationError('Params are required.', {
          fieldErrors: { params: 'Params are required.' },
        });
      }

      return executeAction(
        actionName,
        async () => {
          const serviceResult = await executeUiAction(context.companyId, {
            action,
            params,
          });
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'AgentHubUiContextService' },
      );
    },
  },
});
