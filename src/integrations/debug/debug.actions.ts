import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  getSessionInfo as getSessionInfoService,
  triggerIntegrationAction as triggerIntegrationActionService,
  discoverLeanActions as discoverLeanActionsService,
  getIntegration as getIntegrationService,
  discoverActionById as discoverActionByIdService,
  discoverAllIntegrations as discoverAllIntegrationsService,
  discoverActionsByIntegration as discoverActionsByIntegrationService,
  searchActions as searchActionsService,
} from './debug.service';
import { SupportedLanguage } from '../../services/discovery.service'; // Integration type might not be needed directly in actions
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

const SERVICE_NAME = 'debugService';

// Define expected data shapes for StandardActionResult
interface SessionInfoData {
  markdown?: string;
}
interface TriggerActionData {
  data?: any;
  error?: string;
} // Service returns this shape in its 'data' or 'error'
interface DiscoveredLeanActionsData {
  data?: any;
} // Assuming service returns data directly
interface IntegrationData {
  data?: any;
} // Assuming service returns data directly
interface DiscoveredActionData {
  data?: any;
} // Assuming service returns data directly

// Define shapes for service call lambdas (S type for executeAction)
interface ServiceResponseBase {
  success: boolean;
  error?: string;
  description?: string;
} // executeAction uses 'description' from S if success is false
interface GetSessionInfoServiceResponse extends ServiceResponseBase {
  markdown?: string;
}
interface TriggerIntegrationServiceResponse extends ServiceResponseBase {
  data?: any;
} // Matches service
interface DiscoverLeanServiceResponse extends ServiceResponseBase {
  data?: any;
} // Matches service
interface GetIntegrationServiceResponse extends ServiceResponseBase {
  data?: any;
} // Matches service
interface DiscoverActionServiceResponse extends ServiceResponseBase {
  data?: any;
} // Matches service

export const createDebugActions = (
  context: ActionContext,
): FunctionFactory => ({
  getSessionInfo: {
    description:
      'Get detailed session information including user and company details for debugging and context understanding',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<SessionInfoData>> => {
      if (!context.sessionId || !context.companyId) {
        throw new ActionValidationError(
          'Session ID and Company ID are required.',
        );
      }
      // The service returns { success: boolean; markdown?: string; error?: string }
      // executeAction expects S to have { success: boolean; description?: string; data?: R }
      // We need a dataExtractor to shape the 'data' for StandardActionResult
      const options: ExecuteActionOptions<
        SessionInfoData,
        GetSessionInfoServiceResponse
      > = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({
          markdown: serviceResult.markdown,
        }),
      };
      return executeAction<SessionInfoData, GetSessionInfoServiceResponse>(
        'getSessionInfo',
        async () =>
          getSessionInfoService(context.sessionId!, context.companyId!),
        options,
      );
    },
  },
  triggerIntegrationAction: {
    description:
      'Execute any integration action by name for testing and debugging. Accepts integration name, action/service name, and request data (string or JSON). Returns the action result or error details.',
    strict: true,
    parameters: {
      type: 'object',
      required: ['integrationName', 'requestData', 'service'],
      properties: {
        integrationName: {
          type: 'string',
          description:
            'The name of the integration to trigger (e.g., "jira", "openai", "slack").',
        },
        requestData: {
          type: 'string',
          description:
            "The request data/parameters for the action as a JSON string or plain string. Must match the action's parameter schema.",
        },
        service: {
          type: 'string',
          description:
            'The action/service name within the integration (e.g., "createIssue", "searchIssues", "sendMessage").',
        },
      },
      additionalProperties: false,
    },
    function: async (params: {
      integrationName: string;
      service: string;
      requestData: string;
    }): Promise<StandardActionResult<TriggerActionData>> => {
      if (!context.sessionId || !context.companyId) {
        throw new ActionValidationError(
          'Session ID and Company ID are required.',
        );
      }
      if (
        !params.integrationName ||
        !params.service ||
        params.requestData === undefined
      ) {
        throw new ActionValidationError(
          'integrationName, service, and requestData are required parameters.',
        );
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
      const options: ExecuteActionOptions<
        TriggerActionData,
        TriggerIntegrationServiceResponse
      > = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({
          data: serviceResult.data,
          error: serviceResult.error,
        }),
      };

      return executeAction<
        TriggerActionData,
        TriggerIntegrationServiceResponse
      >(
        'triggerIntegrationAction',
        async () => {
          const res = await triggerIntegrationActionService(
            context.sessionId!,
            context.companyId!,
            params.integrationName,
            params.service,
            parsedData,
          );
          // Adapt service response for executeAction: map 'error' to 'description'
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  discoverLeanActions: {
    description:
      'List all available integration actions across the system with their IDs, names, and descriptions. Returns a lightweight summary of all actions available in all integrations.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<
      StandardActionResult<DiscoveredLeanActionsData>
    > => {
      // Service returns { success: boolean; data?: any; error?: string }
      // R is { data: serviceResult.data }
      const options: ExecuteActionOptions<
        DiscoveredLeanActionsData,
        DiscoverLeanServiceResponse
      > = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<
        DiscoveredLeanActionsData,
        DiscoverLeanServiceResponse
      >(
        'discoverLeanActions',
        async () => {
          const res = await discoverLeanActionsService();
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  getIntegration: {
    description:
      'Get complete details about a specific integration including its name, description, icon, and all available actions with their parameters and descriptions.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'string',
          description:
            'The ID of the integration to retrieve (e.g., "jira", "openai", "slack")',
        },
      },
      required: ['integrationId'],
      additionalProperties: false,
    },
    function: async (params: {
      integrationId: string;
    }): Promise<StandardActionResult<IntegrationData>> => {
      if (!params.integrationId) {
        throw new ActionValidationError(
          'integrationId is a required parameter.',
        );
      }
      // Service returns { success: boolean; data?: any; error?: string }
      const options: ExecuteActionOptions<
        IntegrationData,
        GetIntegrationServiceResponse
      > = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<IntegrationData, GetIntegrationServiceResponse>(
        'getIntegration',
        async () => {
          const res = await getIntegrationService(params.integrationId);
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  discoverActionById: {
    description:
      'Get detailed information about a specific action by its ID, including parameters schema, description, service name, and icon. Action IDs follow the format: integration_name.action_name.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        actionId: {
          type: 'string',
          description:
            'The ID of the action in format: integration_name.action_name (e.g., "jira.createIssue")',
        },
      },
      required: ['actionId'],
      additionalProperties: false,
    },
    function: async (params: {
      actionId: string;
    }): Promise<StandardActionResult<DiscoveredActionData>> => {
      if (!params.actionId) {
        throw new ActionValidationError('actionId is a required parameter.');
      }
      // Service returns { success: boolean; data?: any; error?: string }
      const options: ExecuteActionOptions<
        DiscoveredActionData,
        DiscoverActionServiceResponse
      > = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<DiscoveredActionData, DiscoverActionServiceResponse>(
        'discoverActionById',
        async () => {
          const res = await discoverActionByIdService(
            params.actionId,
            context.language,
          );
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  discoverAllIntegrations: {
    description:
      'Get a comprehensive list of all available integrations in the system with their names, descriptions, icons, and action counts. Useful for understanding the system capabilities.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<any>> => {
      const options: ExecuteActionOptions<any, any> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<any, any>(
        'discoverAllIntegrations',
        async () => {
          const res = await discoverAllIntegrationsService(context.language);
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  discoverActionsByIntegration: {
    description:
      'Get all actions available for a specific integration, including their IDs, descriptions, and parameter schemas. Useful for understanding what operations an integration supports.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'string',
          description:
            'The ID of the integration to get actions for (e.g., "jira", "openai")',
        },
      },
      required: ['integrationId'],
      additionalProperties: false,
    },
    function: async (params: {
      integrationId: string;
    }): Promise<StandardActionResult<any>> => {
      if (!params.integrationId) {
        throw new ActionValidationError(
          'integrationId is a required parameter.',
        );
      }
      const options: ExecuteActionOptions<any, any> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<any, any>(
        'discoverActionsByIntegration',
        async () => {
          const res = await discoverActionsByIntegrationService(
            params.integrationId,
            context.language,
          );
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
  searchActions: {
    description:
      'Search for actions by keyword across all integrations. Returns actions whose ID, name, or description contains the search term. Useful for finding specific functionality.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description:
            'The keyword to search for in action IDs, names, and descriptions',
        },
      },
      required: ['searchTerm'],
      additionalProperties: false,
    },
    function: async (params: {
      searchTerm: string;
    }): Promise<StandardActionResult<any>> => {
      if (!params.searchTerm) {
        throw new ActionValidationError('searchTerm is a required parameter.');
      }
      const options: ExecuteActionOptions<any, any> = {
        serviceName: SERVICE_NAME,
        dataExtractor: (serviceResult) => ({ data: serviceResult.data }),
      };
      return executeAction<any, any>(
        'searchActions',
        async () => {
          const res = await searchActionsService(
            params.searchTerm,
            context.language,
          );
          return {
            success: res.success,
            data: res.data,
            description: res.error,
            error: res.error,
          };
        },
        options,
      );
    },
  },
});
