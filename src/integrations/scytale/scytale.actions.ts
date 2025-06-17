import { ActionContext, FunctionFactory } from '../actions/types';
import {
  getContextTypesPerCompany,
  getContextItemsByCompanyAndType,
  contextVectorSearch,
  ScytaleContextTypeResponse,
  ScytaleContextItem,
  ScytaleVectorSearchResponse,
  ScytaleVectorSearchRequest,
} from './scytale.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

export const createScytaleActions = (context: ActionContext): FunctionFactory => ({
  getContextTypesPerCompany: {
    description: 'Fetches the list of available context types (e.g., audits, controls, policies) for a given company.',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The ID of the company to fetch context types for.' },
      },
      required: ['companyId'],
      additionalProperties: false,
    },
    function: async (params: { companyId: string }) => {
      const actionName = 'getContextTypesPerCompany';
      if (!params.companyId) {
        throw new ActionValidationError('companyId is required.', {
          fieldErrors: { companyId: 'companyId is required.' },
        });
      }

      return executeAction<ScytaleContextTypeResponse>(
        actionName,
        async () => {
          const serviceResult = await getContextTypesPerCompany(params.companyId);
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' }
      );
    },
  },
  getContextItemsByCompanyAndType: {
    description: 'Fetches detailed information for a specific context type (e.g., control, policy) for a given company.',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The ID of the company.' },
        contextType: { type: 'string', description: 'The type of the context item to fetch (e.g., "control", "policy").' },
      },
      required: ['companyId', 'contextType'],
      additionalProperties: false,
    },
    function: async (params: { companyId: string; contextType: string }) => {
      const actionName = 'getContextItemsByCompanyAndType';
      if (!params.companyId) {
        throw new ActionValidationError('companyId is required.', {
          fieldErrors: { companyId: 'companyId is required.' },
        });
      }
      if (!params.contextType) {
        throw new ActionValidationError('contextType is required.', {
          fieldErrors: { contextType: 'contextType is required.' },
        });
      }

      return executeAction<ScytaleContextItem[]>(
        actionName,
        async () => {
          const serviceResult = await getContextItemsByCompanyAndType(params.companyId, params.contextType);
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' }
      );
    },
  },
  contextVectorSearch: {
    description: 'Performs a vector search for context items based on a query.',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The ID of the company.' },
        query: { type: 'string', description: 'The search query.' },
        limit: { type: 'number', description: 'Optional: The maximum number of results to return.' },
      },
      required: ['companyId', 'query'],
      additionalProperties: false,
    },
    function: async (params: { companyId: string; query: string; limit?: number }) => {
      const actionName = 'contextVectorSearch';
      if (!params.companyId) {
        throw new ActionValidationError('companyId is required.', {
          fieldErrors: { companyId: 'companyId is required.' },
        });
      }
      if (!params.query) {
        throw new ActionValidationError('query is required.', {
          fieldErrors: { query: 'query is required.' },
        });
      }

      const searchRequest: ScytaleVectorSearchRequest = {
        query: params.query,
        ...(params.limit && { limit: params.limit }),
      };

      return executeAction<ScytaleVectorSearchResponse>(
        actionName,
        async () => {
          const serviceResult = await contextVectorSearch(params.companyId, searchRequest);
          if (!serviceResult.success && serviceResult.error) {
            return { success: false, description: serviceResult.error, data: serviceResult.data };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' }
      );
    },
  },
});
