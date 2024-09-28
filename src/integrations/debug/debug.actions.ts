import { ActionContext, FunctionFactory } from '../actions/types';
import { getSessionInfo, triggerIntegrationAction } from './debug.service';

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
  triggerIntegrationAction: {
    description: 'Trigger an integration action for debug purposes',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        integrationName: { type: 'string' },
        service: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['integrationName', 'service', 'data'],
      additionalProperties: false,
    },
    function: async (params: { integrationName: string; service: string; data: any }) => {
      try {
        const result = await triggerIntegrationAction(
          context.sessionId,
          context.companyId,
          params.integrationName,
          params.service,
          params.data
        );
        return result;
      } catch (error) {
        console.error('Error in triggerIntegrationAction:', error);
        return { success: false, error: 'Failed to trigger integration action' };
      }
    },
  },
});