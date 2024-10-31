import { ActionContext, FunctionFactory } from '../actions/types';
import { getSessionInfo, triggerIntegrationAction, discoverLeanActions, getIntegration } from './debug.service';
import { SupportedLanguage, Integration } from '../../services/discovery.service';

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
      console.log('Starting triggerIntegrationAction', { params });
      try {
        const result = await triggerIntegrationAction(
          context.sessionId,
          context.companyId,
          params.integrationName,
          params.service,
          params.data
        );
        console.log('triggerIntegrationAction completed successfully', { result });
        return result;
      } catch (error) {
        console.error('Error in triggerIntegrationAction:', error);
        return { success: false, error: 'Failed to trigger integration action' };
      }
    },
  },
  discoverLeanActions: {
    description: 'Discover lean actions for all integrations',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      console.log('Starting discoverLeanActions');
      try {
        const result = await discoverLeanActions();
        console.log('discoverLeanActions completed successfully', { 
          success: result.success, 
          dataAvailable: !!result.data,
          error: result.error
        });
        return result;
      } catch (error) {
        console.error('Error in discoverLeanActions:', error);
        return { success: false, error: 'Failed to discover lean actions' };
      }
    },
  },
  getIntegration: {
    description: 'Get a specific integration by ID',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        integrationId: { type: 'string' },
      },
      required: ['integrationId'],
      additionalProperties: false,
    },
    function: async (params: { integrationId: string }) => {
      console.log('Starting getIntegration', { integrationId: params.integrationId });
      try {
        const result = await getIntegration(params.integrationId);
        console.log('getIntegration completed successfully', { result });
        return result;
      } catch (error) {
        console.error('Error in getIntegration:', error);
        return { success: false, error: 'Failed to get integration' };
      }
    },
  },
});