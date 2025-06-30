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
      'Creates a new context item in Scytale with dynamic key-value pairs.',
    parameters: {
      type: 'object' as const,
      properties: {
        contextId: { type: 'string', description: 'The ID of the context.' },
        contextType: {
          type: 'string',
          description: 'The type of context item to create (e.g., "note", "data", "reference").',
          enum: ["note", "data", "reference", "products", "controls", "policies"], // Added common types
        },
        key: { type: 'string', description: 'Unique identifier for the context item.' },
        attributes: {
          type: 'array',
          description: 'An array of key-value pairs for dynamic attributes.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the attribute (e.g., "productName", "price").' },
              value: { type: 'string', description: 'The value of the attribute (always as a string).' },
              dataType: {
                type: 'string',
                description: 'Optional: The original data type of the value (e.g., "string", "number", "boolean"). Defaults to "string".',
                enum: ["string", "number", "boolean"],
                default: "string",
              },
            },
            required: ["name", "value"],
            additionalProperties: false, // Enforce strictness for attribute objects
          },
        },
      },
      required: ['contextId', 'contextType', 'key', 'attributes'],
      additionalProperties: false, // Enforce strictness for the root parameters object
    },
    function: async (params: {
      contextId: string;
      contextType: string;
      key: string;
      attributes: Array<{ name: string; value: string; dataType?: "string" | "number" | "boolean" }>;
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
      if (!params.attributes || !Array.isArray(params.attributes)) {
        throw new ActionValidationError('attributes is required and must be an array.', {
          fieldErrors: { attributes: 'attributes is required and must be an array.' },
        });
      }

      const dynamicData: Record<string, any> = {};
      params.attributes.forEach(({ name, value, dataType }) => {
        let processedValue: any = value;
        if (dataType === 'number') {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            throw new ActionValidationError(`Invalid number value for attribute '${name}'.`, {
              fieldErrors: { [`attributes.${name}.value`]: `Value '${value}' is not a valid number.` },
            });
          }
        } else if (dataType === 'boolean') {
          processedValue = value.toLowerCase() === 'true';
        }
        dynamicData[name] = processedValue;
      });

      const createRequest: CreateContextItemRequest = {
        key: params.key,
        data: dynamicData, // Convert array of attributes to object
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
