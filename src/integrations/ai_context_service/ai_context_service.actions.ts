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
} from './ai_context_service.service';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

export const createAIContextServiceActions = (
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
        { serviceName: 'AIContextService' },
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
        { serviceName: 'AIContextService' },
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
        { serviceName: 'AIContextService' },
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
        { serviceName: 'AIContextService' },
      );
    },
  },
  createContextItem: {
    description:
      'Creates a new context item in AI Context Service with dynamic key-value pairs.',
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
          description: 'Optional attributes. Pass empty array [] if no attributes needed.',
          default: [], // Provide default
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
      required: ['contextId', 'contextType', 'key'], // attributes NOT required
      additionalProperties: false, // Enforce strictness for the root parameters object
    },
    function: async (params: {
      contextId: string;
      contextType: string;
      key: string;
      attributes?: Array<{ name: string; value: string; dataType?: "string" | "number" | "boolean" }>;
    }) => {
      const actionName = 'createContextItem';

      // Repair problematic argument patterns before defensive defaults
      // Ensure attributes exists and is an array
      if (!params.hasOwnProperty('attributes')) {
        console.log('[Tool Repair] Adding missing attributes array to params');
        params.attributes = [];
      } else if (params.attributes === null || params.attributes === undefined) {
        console.log('[Tool Repair] Converting null/undefined attributes to empty array in params');
        params.attributes = [];
      } else if (!Array.isArray(params.attributes)) {
        console.log('[Tool Repair] Converting non-array attributes to empty array in params');
        params.attributes = []; // Or attempt to convert if a specific non-array format is expected
      }

      // Defensive defaults
      const safeParams = {
        contextId: params.contextId || '',
        contextType: params.contextType || '',
        key: params.key || '',
        attributes: params.attributes // Now params.attributes is guaranteed to be an array
      };

      // Validate with clear error messages
      const validationErrors: string[] = [];

      if (!safeParams.contextId.trim()) {
        validationErrors.push('contextId cannot be empty');
      }
      if (!safeParams.contextType.trim()) {
        validationErrors.push('contextType cannot be empty');
      }
      if (!safeParams.key.trim()) {
        validationErrors.push('key cannot be empty');
      }

      if (validationErrors.length > 0) {
        throw new ActionValidationError(
          `Validation failed: ${validationErrors.join(', ')}`,
          { fieldErrors: Object.fromEntries(validationErrors.map(e => [e.split(' ')[0], e])) }
        );
      }

      // Process attributes safely
      const dynamicData: Record<string, any> = {};

      try {
        console.log(`[createContextItem Action] Before forEach. safeParams.attributes:`, safeParams.attributes);
        console.log(`[createContextItem Action] Before forEach. Is Array: ${Array.isArray(safeParams.attributes)}`);
        
        if (Array.isArray(safeParams.attributes)) { // Defensive check
          safeParams.attributes.forEach(({ name, value, dataType = 'string' }) => {
            if (!name || !value) {
              console.warn(`Skipping invalid attribute: name="${name}", value="${value}"`);
              return;
            }

            switch (dataType) {
              case 'number':
                const num = parseFloat(value);
                if (!isNaN(num)) {
                  dynamicData[name] = num;
                } else {
                  console.warn(`Invalid number value for ${name}: ${value}`);
                  dynamicData[name] = value; // Keep as string
                }
                break;
              case 'boolean':
                dynamicData[name] = value.toLowerCase() === 'true';
                break;
              default:
                dynamicData[name] = value;
            }
          });
        } // Closing brace for if (Array.isArray(safeParams.attributes))
      } catch (error) {
        console.error('Error processing attributes:', error);
        // Continue with empty data rather than failing
      } finally {
        // Ensure the forEach loop is closed if the if-condition was added
        if (!Array.isArray(safeParams.attributes)) {
          console.error(`[createContextItem Action] safeParams.attributes was not an array after all defensive checks. Value:`, safeParams.attributes);
        }
      }

      const createRequest: CreateContextItemRequest = {
        key: safeParams.key,
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
        { serviceName: 'AIContextService' },
      );
    },
  },
});