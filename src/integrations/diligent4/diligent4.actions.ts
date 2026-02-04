import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { TestConnectionResult } from '../../services/integration-config.service';
import {
  listContexts,
  searchWorkflows,
  getContext,
  generateWorkflow,
  modifyContext,
  validateConnection as validateApiConnection,
} from './diligent4.service';
import {
  Context,
  ContextSummary,
  SearchResponse,
  GenerateResponse,
} from './types';

/**
 * Validate connection with Diligent4 API
 * Called when user clicks "Test Connection" in the UI
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.diligent4_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'API key is not configured',
    };
  }

  return validateApiConnection(apiKey);
}

/**
 * Action creator - returns all available Diligent4 actions
 */
export const createDiligent4Actions = (
  context: ActionContext,
): FunctionFactory => ({
  /**
   * List available contexts (workflows and sessions)
   */
  listContexts: {
    description:
      'List available workflows and knowledge sessions from Diligent4. Use this to browse available procedures.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
        },
        kind: {
          type: 'string',
          enum: ['all', 'project', 'session'],
          description: 'Filter by context kind (default: all)',
        },
        sessionType: {
          type: 'string',
          enum: ['workflow_recording', 'teaching_session'],
          description:
            'Filter by session type. workflow_recording for step-by-step procedures, teaching_session for business rules.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (args: {
      limit?: number;
      kind?: 'all' | 'project' | 'session';
      sessionType?: 'workflow_recording' | 'teaching_session';
    }): Promise<StandardActionResult<ContextSummary[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      return executeAction<ContextSummary[], { success: boolean; data: ContextSummary[]; error?: string }>(
        'listContexts',
        async () => {
          const { getApiKey } = await import('../../services/api.key.service');
          const apiKey = await getApiKey(context.companyId, 'diligent4_api_key');

          if (!apiKey) {
            throw new Error('Diligent4 API key not configured. Please configure it in Admin > Integrations.');
          }

          return listContexts(apiKey, {
            limit: args.limit,
            kind: args.kind,
            sessionType: args.sessionType,
          });
        },
        {
          serviceName: 'diligent4',
          dataExtractor: (response) => response.data,
        },
      );
    },
  },

  /**
   * Search for workflows using semantic search
   */
  searchWorkflows: {
    description:
      'Search for workflows and procedures using natural language. Use when user asks "how do I..." or needs help with a business process.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "how to process a refund")',
        },
        topK: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence score 0-1 (default: 0.3)',
        },
        autoFetch: {
          type: 'boolean',
          description:
            'If true and a high-confidence match is found, automatically fetch full workflow details (default: false)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    function: async (args: {
      query: string;
      topK?: number;
      minConfidence?: number;
      autoFetch?: boolean;
    }): Promise<StandardActionResult<SearchResponse | Context>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.query?.trim()) {
        throw new ActionValidationError('Search query is required.');
      }

      return executeAction<SearchResponse | Context, { success: boolean; data: SearchResponse | Context; error?: string }>(
        'searchWorkflows',
        async () => {
          const { getApiKey } = await import('../../services/api.key.service');
          const apiKey = await getApiKey(context.companyId, 'diligent4_api_key');

          if (!apiKey) {
            throw new Error('Diligent4 API key not configured. Please configure it in Admin > Integrations.');
          }

          return searchWorkflows(apiKey, {
            query: args.query,
            topK: args.topK,
            minConfidence: args.minConfidence,
            autoFetch: args.autoFetch,
          });
        },
        {
          serviceName: 'diligent4',
          dataExtractor: (response) => response.data,
        },
      );
    },
  },

  /**
   * Get full details of a workflow or session
   */
  getContext: {
    description:
      'Get full details of a workflow or knowledge session by ID. Use after search to get step-by-step instructions.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Context ID (from search or list results)',
        },
        detail: {
          type: 'string',
          enum: ['summary', 'full'],
          description: 'Level of detail to return (default: full)',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    function: async (args: {
      id: string;
      detail?: 'summary' | 'full';
    }): Promise<StandardActionResult<Context>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.id?.trim()) {
        throw new ActionValidationError('Context ID is required.');
      }

      return executeAction<Context, { success: boolean; data?: Context; error?: string }>(
        'getContext',
        async () => {
          const { getApiKey } = await import('../../services/api.key.service');
          const apiKey = await getApiKey(context.companyId, 'diligent4_api_key');

          if (!apiKey) {
            throw new Error('Diligent4 API key not configured. Please configure it in Admin > Integrations.');
          }

          return getContext(apiKey, {
            id: args.id,
            detail: args.detail,
          });
        },
        {
          serviceName: 'diligent4',
          dataExtractor: (response) => response.data,
        },
      );
    },
  },

  /**
   * Generate a workflow from text content
   */
  generateWorkflow: {
    description:
      'Generate a structured workflow from text description. The process is async - set waitForCompletion=true to wait for the result.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Text content describing the procedure (e.g., meeting notes, documentation)',
        },
        name: {
          type: 'string',
          description: 'Name for the generated workflow',
        },
        outputType: {
          type: 'string',
          enum: ['workflow_recording', 'teaching_session'],
          description:
            'Type of output: workflow_recording for step-by-step procedures, teaching_session for business rules (default: workflow_recording)',
        },
        waitForCompletion: {
          type: 'boolean',
          description:
            'If true, wait for generation to complete and return the full workflow. If false, return immediately with session_id for later retrieval (default: true)',
        },
        maxWaitSeconds: {
          type: 'number',
          description: 'Maximum seconds to wait for completion when waitForCompletion is true (default: 60)',
        },
      },
      required: ['content', 'name'],
      additionalProperties: false,
    },
    function: async (args: {
      content: string;
      name: string;
      outputType?: 'workflow_recording' | 'teaching_session';
      waitForCompletion?: boolean;
      maxWaitSeconds?: number;
    }): Promise<StandardActionResult<Context | GenerateResponse>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.content?.trim()) {
        throw new ActionValidationError('Content is required.');
      }

      if (!args.name?.trim()) {
        throw new ActionValidationError('Name is required.');
      }

      return executeAction<Context | GenerateResponse, { success: boolean; data?: Context | GenerateResponse; error?: string }>(
        'generateWorkflow',
        async () => {
          const { getApiKey } = await import('../../services/api.key.service');
          const apiKey = await getApiKey(context.companyId, 'diligent4_api_key');

          if (!apiKey) {
            throw new Error('Diligent4 API key not configured. Please configure it in Admin > Integrations.');
          }

          return generateWorkflow(apiKey, {
            content: args.content,
            name: args.name,
            outputType: args.outputType,
            waitForCompletion: args.waitForCompletion !== false, // Default to true
            maxWaitSeconds: args.maxWaitSeconds,
          });
        },
        {
          serviceName: 'diligent4',
          dataExtractor: (response) => response.data,
        },
      );
    },
  },

  /**
   * Modify a workflow with natural language instruction
   */
  modifyContext: {
    description:
      'Modify a workflow or session. Add, edit, or delete steps/phases using natural language.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Context ID to modify',
        },
        targetType: {
          type: 'string',
          enum: ['step', 'phase', 'knowledge_item', 'metadata'],
          description: 'What to modify: step, phase, knowledge_item, or metadata',
        },
        changePrompt: {
          type: 'string',
          description: 'Natural language description of the change (e.g., "Add Finance approval for requests over $500")',
        },
        action: {
          type: 'string',
          enum: ['modify', 'add', 'delete'],
          description: 'Action to perform: modify (default), add, or delete',
        },
        targetNumber: {
          type: 'number',
          description: 'Step or phase number to modify (required when modifying existing step/phase)',
        },
        position: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['after', 'before', 'at_end', 'at_start'],
              description: 'Where to insert new content',
            },
            reference: {
              type: 'number',
              description: 'Reference step/phase number for after/before positioning',
            },
          },
          description: 'Position for add action (e.g., { type: "after", reference: 4 })',
        },
        autoConfirm: {
          type: 'boolean',
          description: 'If true, save the change immediately. If false, return a preview (default: true)',
        },
      },
      required: ['id', 'targetType', 'changePrompt'],
      additionalProperties: false,
    },
    function: async (args: {
      id: string;
      targetType: 'step' | 'phase' | 'knowledge_item' | 'metadata';
      changePrompt: string;
      action?: 'modify' | 'add' | 'delete';
      targetNumber?: number;
      position?: { type: 'after' | 'before' | 'at_end' | 'at_start'; reference?: number };
      autoConfirm?: boolean;
    }): Promise<StandardActionResult<Context>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (!args.id?.trim()) {
        throw new ActionValidationError('Context ID is required.');
      }

      if (!args.changePrompt?.trim()) {
        throw new ActionValidationError('Change prompt is required.');
      }

      return executeAction<Context, { success: boolean; data: Context }>(
        'modifyContext',
        async () => {
          const { getApiKey } = await import('../../services/api.key.service');
          const apiKey = await getApiKey(context.companyId, 'diligent4_api_key');

          if (!apiKey) {
            throw new Error('Diligent4 API key not configured. Please configure it in Admin > Integrations.');
          }

          return modifyContext(apiKey, {
            id: args.id,
            targetType: args.targetType,
            changePrompt: args.changePrompt,
            action: args.action,
            targetNumber: args.targetNumber,
            position: args.position,
            autoConfirm: args.autoConfirm !== false, // Default to true
          });
        },
        {
          serviceName: 'diligent4',
          dataExtractor: (response) => response.data,
        },
      );
    },
  },
});
