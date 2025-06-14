import { ActionContext, FunctionFactory, StandardActionResult } from '../actions/types';
import { 
  getSessionInfo as getSessionInfoService, 
  triggerIntegrationAction as triggerIntegrationActionService, 
  discoverLeanActions as discoverLeanActionsService, 
  getIntegration as getIntegrationService, 
  discoverActionById as discoverActionByIdService 
} from './debug.service';
import { SupportedLanguage } from '../../services/discovery.service'; // Integration type might not be needed directly in actions
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

const SERVICE_NAME = 'debugService';

// Define expected data shapes for StandardActionResult
interface SessionInfoData { markdown?: string; }
interface TriggerActionData { data?: any; error?: string; } // Service returns this shape in its 'data' or 'error'
interface DiscoveredLeanActionsData { data?: any; } // Assuming service returns data directly
interface IntegrationData { data?: any; } // Assuming service returns data directly
interface DiscoveredActionData { data?: any; } // Assuming service returns data directly


// Define shapes for service call lambdas (S type for executeAction)
interface ServiceResponseBase { success: boolean; error?: string; description?: string; } // executeAction uses 'description' from S if success is false
interface GetSessionInfoServiceResponse extends ServiceResponseBase { markdown?: string; }
interface TriggerIntegrationServiceResponse extends ServiceResponseBase { data?: any; } // Matches service
interface DiscoverLeanServiceResponse extends ServiceResponseBase { data?: any; } // Matches service
interface GetIntegrationServiceResponse extends ServiceResponseBase { data?: any; } // Matches service
interface DiscoverActionServiceResponse extends ServiceResponseBase { data?: any; } // Matches service


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
    function: async (): Promise<StandardActionResult<SessionInfoData>> => {      
      if (!context.sessionId || !context.companyId) {
        throw new ActionValidationError('Session ID and Company ID are required.');
      }
      // The service returns { success: boolean; markdown?: string; error?: string }
      // executeAction expects S to have { success: boolean; description?: string; data?: R }
      // We need a dataExtractor to shape the 'data' for StandardActionResult
      const options: ExecuteActionOptions<SessionInfoData, GetSessionInfoServiceResponse> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ markdown: serviceResult.markdown })
      };
      return executeAction<SessionInfoData, GetSessionInfoServiceResponse>(
        'getSessionInfo',
        async () => getSessionInfoService(context.sessionId!, context.companyId!),
        options
      );
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
        integrationName: { type: 'string', description: 'The name of the integration to trigger.' },
        requestData: { type: 'string', description: 'The request data for the integration action, which can also be provided in JSON format.' },
        service: { type: 'string', description: 'The specific service associated with the integration action.' }
      },
      additionalProperties: false
    },
    function: async (params: { integrationName: string; service: string; requestData: string }): Promise<StandardActionResult<TriggerActionData>> => {
      if (!context.sessionId || !context.companyId) {
        throw new ActionValidationError('Session ID and Company ID are required.');
      }
      if (!params.integrationName || !params.service || params.requestData === undefined) {
        throw new ActionValidationError('integrationName, service, and requestData are required parameters.');
      }
      
      let parsedData: any;
      try {
        parsedData = JSON.parse(params.requestData);
      } catch {
        parsedData = params.requestData;
      }

      // The service returns { success: boolean; data?: any; error?: string }
      // This is compatible with S if we map service's 'error' to 'description' for executeAction
      // The R type will be { data: serviceResult.data, error: serviceResult.error }
      const options: ExecuteActionOptions<TriggerActionData, TriggerIntegrationServiceResponse> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data, error: serviceResult.error })
      };

      return executeAction<TriggerActionData, TriggerIntegrationServiceResponse>(
        'triggerIntegrationAction',
        async () => {
          const res = await triggerIntegrationActionService(
            context.sessionId!,
            context.companyId!,
            params.integrationName,
            params.service,
            parsedData
          );
          // Adapt service response for executeAction: map 'error' to 'description'
          return { success: res.success, data: res.data, description: res.error, error: res.error };
        },
        options
      );
    },
  },
  discoverLeanActions: {
    description: 'Discover lean actions for all integrations',
    strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    function: async (): Promise<StandardActionResult<DiscoveredLeanActionsData>> => {
      // Service returns { success: boolean; data?: any; error?: string }
      // R is { data: serviceResult.data }
      const options: ExecuteActionOptions<DiscoveredLeanActionsData, DiscoverLeanServiceResponse> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }) 
      };
      return executeAction<DiscoveredLeanActionsData, DiscoverLeanServiceResponse>(
        'discoverLeanActions',
        async () => {
          const res = await discoverLeanActionsService();
          return { success: res.success, data: res.data, description: res.error, error: res.error };
        },
        options
      );
    },
  },
  getIntegration: {
    description: 'Get a specific integration by ID',
    strict: true,
    parameters: { type: 'object', properties: { integrationId: { type: 'string' } }, required: ['integrationId'], additionalProperties: false },
    function: async (params: { integrationId: string }): Promise<StandardActionResult<IntegrationData>> => {
      if (!params.integrationId) {
        throw new ActionValidationError('integrationId is a required parameter.');
      }
      // Service returns { success: boolean; data?: any; error?: string }
      const options: ExecuteActionOptions<IntegrationData, GetIntegrationServiceResponse> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data })
      };
      return executeAction<IntegrationData, GetIntegrationServiceResponse>(
        'getIntegration',
        async () => {
          const res = await getIntegrationService(params.integrationId);
          return { success: res.success, data: res.data, description: res.error, error: res.error };
        },
        options
      );
    },
  },
  discoverActionById: {
    description: 'Discover a specific action by ID',
    strict: true,
    parameters: { type: 'object', properties: { actionId: { type: 'string' } }, required: ['actionId'], additionalProperties: false },
    function: async (params: { actionId: string }): Promise<StandardActionResult<DiscoveredActionData>> => {
      if (!params.actionId) {
        throw new ActionValidationError('actionId is a required parameter.');
      }
      // Service returns { success: boolean; data?: any; error?: string }
      const options: ExecuteActionOptions<DiscoveredActionData, DiscoverActionServiceResponse> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data })
      };
      return executeAction<DiscoveredActionData, DiscoverActionServiceResponse>(
        'discoverActionById',
        async () => {
          const res = await discoverActionByIdService(params.actionId, context.language);
          return { success: res.success, data: res.data, description: res.error, error: res.error };
        },
        options
      );
    },
  },
});
