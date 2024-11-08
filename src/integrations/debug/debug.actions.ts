import { ActionContext, FunctionFactory } from '../actions/types';
import { getSessionInfo, triggerIntegrationAction, discoverLeanActions, getIntegration, discoverActionById } from './debug.service';
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
    description: 'Triggers debugging for an integration action with the specified name and service, and accepts request data either as a string or as JSON.',
    strict: true,
    parameters: {
      type: 'object',
      required: [
        'integrationName',
        'requestData',
        'service'
      ],
      properties: {
        integrationName: {
          type: 'string',
          description: 'The name of the integration to trigger.'
        },
        requestData: {
          type: 'string',
          description: 'The request data for the integration action, which can also be provided in JSON format.'
        },
        service: {
          type: 'string',
          description: 'The specific service associated with the integration action.'
        }
      },
      additionalProperties: false
    },
    function: async (params: { integrationName: string; service: string; requestData: string }) => {
      console.log('Starting triggerIntegrationAction', { params });
      try {
        let data: any;
        try {
          data = JSON.parse(params.requestData);
        } catch {
          data = params.requestData;
        }
        const result = await triggerIntegrationAction(
          context.sessionId,
          context.companyId,
          params.integrationName,
          params.service,
          data
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
  discoverActionById: {
    description: 'Discover a specific action by ID',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        actionId: { type: 'string' },
      },
      required: ['actionId'],
      additionalProperties: false,
    },
    function: async (params: { actionId: string }) => {
      console.log('Starting discoverActionById', { actionId: params.actionId });
      try {
        const result = await discoverActionById(params.actionId, context.language);
        console.log('discoverActionById completed successfully', { result });
        return result;
      } catch (error) {
        console.error('Error in discoverActionById:', error);
        return { success: false, error: 'Failed to discover action by ID' };
      }
    },
  },
});
