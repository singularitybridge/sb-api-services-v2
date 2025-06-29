import { ActionContext, FunctionFactory } from '../actions/types';
import {
  getContextTypes,
  getContextItems,
  vectorSearch,
  getIndexingStatus,
  createContextItem,
  ContextTypeResponse,
  ContextItem,
  VectorSearchResponse,
  VectorSearchRequest,
  IndexingStatusResponse,
  CreateContextItemRequest,
  CreateContextItemResponse,
} from './scytale.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

export const createScytaleActions = (
  context: ActionContext,
): FunctionFactory => ({
  getContextTypes: {
    description:
      'Fetches the list of available context types (e.g., audits, controls, policies) for a given context.',
    parameters: {
      type: 'object',
      properties: {
        contextId: {
          type: 'string',
          description: 'The ID of the context to fetch context types for.',
        },
      },
      required: ['contextId'],
      additionalProperties: false,
    },
    function: async (params: { contextId: string }) => {
      const actionName = 'getContextTypes';
      if (!params.contextId) {
        throw new ActionValidationError('contextId is required.', {
          fieldErrors: { contextId: 'contextId is required.' },
        });
      }

      return executeAction<ContextTypeResponse>(
        actionName,
        async () => {
          const serviceResult = await getContextTypes(
            context.companyId,
            params.contextId,
          );
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' },
      );
    },
  },
  getContextItems: {
    description:
      'Fetches detailed information for a specific context type (e.g., control, policy) for a given context.',
    parameters: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'The ID of the context.' },
        contextType: {
          type: 'string',
          description:
            'The type of the context item to fetch (e.g., "control", "policy").',
        },
        limit: {
          type: 'number',
          description:
            'Optional: The maximum number of results to return. Defaults to 10.',
        },
        offset: {
          type: 'number',
          description:
            'Optional: The number of results to skip. Defaults to 0.',
        },
      },
      required: ['contextId', 'contextType'],
      additionalProperties: false,
    },
    function: async (params: {
      contextId: string;
      contextType: string;
      limit?: number;
      offset?: number;
    }) => {
      const actionName = 'getContextItems';
      if (!params.contextId) {
        throw new ActionValidationError('contextId is required.', {
          fieldErrors: { contextId: 'contextId is required.' },
        });
      }
      if (!params.contextType) {
        throw new ActionValidationError('contextType is required.', {
          fieldErrors: { contextType: 'contextType is required.' },
        });
      }

      const limit = params.limit ?? 10;
      const offset = params.offset ?? 0;

      return executeAction<ContextItem[]>(
        actionName,
        async () => {
          const serviceResult = await getContextItems(
            context.companyId,
            params.contextId,
            params.contextType,
            limit,
            offset,
          );
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' },
      );
    },
  },
  contextVectorSearch: {
    description: 'Performs a vector search for context items based on a query.',
    parameters: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'The ID of the context.' },
        query: { type: 'string', description: 'The search query.' },
        limit: {
          type: 'number',
          description: 'Optional: The maximum number of results to return.',
        },
      },
      required: ['contextId', 'query'],
      additionalProperties: false,
    },
    function: async (params: {
      contextId: string;
      query: string;
      limit?: number;
    }) => {
      const actionName = 'contextVectorSearch';
      if (!params.contextId) {
        throw new ActionValidationError('contextId is required.', {
          fieldErrors: { contextId: 'contextId is required.' },
        });
      }
      if (!params.query) {
        throw new ActionValidationError('query is required.', {
          fieldErrors: { query: 'query is required.' },
        });
      }

      const searchRequest: VectorSearchRequest = {
        query: params.query,
        ...(params.limit && { limit: params.limit }),
      };

      return executeAction<VectorSearchResponse>(
        actionName,
        async () => {
          const serviceResult = await vectorSearch(
            context.companyId,
            params.contextId,
            searchRequest,
          );
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' },
      );
    },
  },
  getIndexingStatus: {
    description:
      'Fetches the indexing status of the context, including queue size, pending items, and pause status.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async () => {
      const actionName = 'getIndexingStatus';
      return executeAction<IndexingStatusResponse>(
        actionName,
        async () => {
          const serviceResult = await getIndexingStatus(context.companyId);
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' },
      );
    },
  },
  createContextItem: {
    description:
      'Creates a new context item in Scytale.',
    parameters: {
      type: 'object' as const,
      properties: {
        contextId: {
          type: 'string',
          description: 'The ID of the context.',
        },
        contextType: {
          type: 'string',
          description:
            'The type of context item to create (e.g., "controls", "policies").',
        },
        key: {
          type: 'string',
          description: 'Unique identifier for the context item.',
        },
        name: {
          type: 'string',
          description: 'The name of the context item.',
        },
        description: {
          type: 'string',
          description: 'The description of the context item.',
        },
        id: {
          type: 'string',
          description: 'Optional custom ID for the item.',
        },
        category: {
          type: 'string',
          description: 'Optional category for the item.',
        },
        owner: {
          type: 'string',
          description: 'Optional owner of the item.',
        },
        tags: {
          type: 'array',
          description: 'Optional array of tags.',
          items: {
            type: 'string',
          },
        },
      },
      required: ['contextId', 'contextType', 'key', 'name', 'description'],
      additionalProperties: false,
    },
    function: async (params: {
      contextId: string;
      contextType: string;
      key: string;
      name: string;
      description: string;
      id?: string;
      category?: string;
      owner?: string;
      tags?: string[];
    }) => {
      const actionName = 'createContextItem';
      
      if (!params.contextId) {
        throw new ActionValidationError('contextId is required.', {
          fieldErrors: { contextId: 'contextId is required.' },
        });
      }
      if (!params.contextType) {
        throw new ActionValidationError('contextType is required.', {
          fieldErrors: { contextType: 'contextType is required.' },
        });
      }
      if (!params.key) {
        throw new ActionValidationError('key is required.', {
          fieldErrors: { key: 'key is required.' },
        });
      }
      if (!params.name) {
        throw new ActionValidationError('name is required.', {
          fieldErrors: { name: 'name is required.' },
        });
      }
      if (!params.description) {
        throw new ActionValidationError('description is required.', {
          fieldErrors: { description: 'description is required.' },
        });
      }

      const createRequest: CreateContextItemRequest = {
        key: params.key,
        data: {
          name: params.name,
          description: params.description,
        },
        ...(params.id && { id: params.id }),
        ...(params.category || params.owner ? {
          metadata: {
            ...(params.category && { category: params.category }),
            ...(params.owner && { owner: params.owner }),
          }
        } : {}),
        ...(params.tags && { tags: params.tags }),
      };

      return executeAction<CreateContextItemResponse>(
        actionName,
        async () => {
          const serviceResult = await createContextItem(
            context.companyId,
            params.contextId,
            params.contextType,
            createRequest,
          );
          if (!serviceResult.success && serviceResult.error) {
            return {
              success: false,
              description: serviceResult.error,
              data: serviceResult.data,
            };
          }
          return serviceResult;
        },
        { serviceName: 'ScytaleService' },
      );
    },
  },
});
