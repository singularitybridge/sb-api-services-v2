import { ActionContext, FunctionFactory } from '../actions/types';
import { executeAction } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { TestConnectionResult } from '../../services/integration-config.service';
import {
  listContexts,
  searchContexts,
  getContext,
  modifyContext,
  generateContext,
  ListContextsParams,
  SearchContextsParams,
  GetContextParams,
  ModifyContextParams,
  GenerateContextParams,
  ListContextsResponse,
  SearchContextsResponse,
  FlingoosContext,
  ModifyContextResponse,
  GenerateContextResponse,
} from './flingoos_mcp.service';

// Flingoos MCP API base URL
const FLINGOOS_MCP_BASE_URL = 'https://mcp.diligent4.com';

/**
 * Validate Flingoos MCP connection by testing the API
 */
export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const apiKey = apiKeys.flingoos_mcp_api_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'Flingoos MCP API key is not configured',
    };
  }

  try {
    // Test the connection by making a simple API call to list contexts with limit=1
    const url = `${FLINGOOS_MCP_BASE_URL}/api/contexts?limit=1`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorMessage = data.error || data.message || `HTTP ${response.status}`;
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your Flingoos MCP credentials.',
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: 'Access denied. Please check your API key permissions.',
        };
      }
      
      return {
        success: false,
        error: `Connection failed: ${errorMessage}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      message: `Connected successfully to Flingoos MCP. Found ${data.total_count || 0} contexts.`,
    };
  } catch (error: any) {
    if (error.message?.includes('fetch')) {
      return {
        success: false,
        error: `Unable to reach Flingoos MCP API at ${FLINGOOS_MCP_BASE_URL}. Please check your network connection.`,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to connect to Flingoos MCP',
    };
  }
}

export const createFlingoosMcpActions = (context: ActionContext): FunctionFactory => ({
  listContexts: {
    description: 'List all Flingoos contexts including workflows (workflow_recording sessions), teaching sessions (knowledge bases), and projects. Use this to discover available content. IMPORTANT: Always use scope="all" and kind="all" unless specifically asked to filter. Sessions include both workflows and teaching sessions.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contexts to return (1-100). Leave unset to use default of 50.',
        },
        scope: {
          type: 'string',
          enum: ['all', 'mine', 'public'],
          description: 'Filter by ownership. Use "all" (default and recommended) to see all accessible content, "mine" for only user-created content, "public" for publicly shared content. ALWAYS use "all" unless user explicitly asks for their own or public content only.',
        },
        kind: {
          type: 'string',
          enum: ['all', 'project', 'session'],
          description: 'Filter by context type. Use "all" (default and recommended) to see everything, "project" for project containers only, "session" for workflows and teaching sessions only. ALWAYS use "all" unless user explicitly asks for a specific type. Note: workflows and knowledge bases are both "session" types.',
        },
        session_type: {
          type: 'string',
          enum: ['workflow_recording', 'teaching_session'],
          description: 'When kind="session", optionally filter by session subtype. "workflow_recording" = step-by-step workflows, "teaching_session" = knowledge bases/documentation. Leave unset to see both types.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    function: async (params: ListContextsParams) => {
      const actionName = 'listContexts';
      return executeAction<ListContextsResponse>(
        actionName,
        async () => {
          const result = await listContexts(context.sessionId, context.companyId, params);
          return { success: true, data: result };
        },
        { serviceName: 'FlingoosMCP' },
      );
    },
  },

  searchContexts: {
    description: 'Search Flingoos contexts using natural language query. Returns ranked results with confidence scores. Use this when user asks to find or search for specific workflows, knowledge, or content by description. IMPORTANT: Always use scope="all" unless specifically asked to filter.',
    parameters: {
      type: 'object',
      properties: {
        q: {
          type: 'string',
          description: 'Natural language search query describing what to find (e.g., "how to create an invoice", "customer onboarding process", "API documentation")',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (1-20). Leave unset to use default of 5.',
        },
        min_confidence: {
          type: 'number',
          description: 'Minimum similarity score threshold (0.0-1.0). Leave unset to use default of 0.3. Lower values return more results but may be less relevant.',
        },
        scope: {
          type: 'string',
          enum: ['all', 'mine', 'public'],
          description: 'Filter by ownership. Use "all" (default and recommended) to search all accessible content. ALWAYS use "all" unless user explicitly asks to search only their own or only public content.',
        },
      },
      required: ['q'],
      additionalProperties: false,
    },
    function: async (params: SearchContextsParams) => {
      const actionName = 'searchContexts';
      if (!params.q || params.q.trim().length === 0) {
        throw new ActionValidationError('Search query (q) is required.', {
          fieldErrors: { q: 'Search query is required.' },
        });
      }
      return executeAction<SearchContextsResponse>(
        actionName,
        async () => {
          const result = await searchContexts(context.sessionId, context.companyId, params);
          return { success: true, data: result };
        },
        { serviceName: 'FlingoosMCP' },
      );
    },
  },

  getContext: {
    description: 'Get a specific Flingoos context by ID with full details. Use this to retrieve the complete content of a workflow (with all steps), teaching session (with all knowledge items), or project. Always call this after finding a context via search or list to get the actual content.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the context to retrieve (obtained from listContexts or searchContexts)',
        },
        detail: {
          type: 'string',
          enum: ['summary', 'full'],
          description: 'Level of detail. Use "full" (default for sessions) to get all steps/knowledge items, "summary" (default for projects) for overview only. Leave unset to use appropriate default.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    function: async (params: GetContextParams) => {
      const actionName = 'getContext';
      if (!params.id) {
        throw new ActionValidationError('Context ID is required.', {
          fieldErrors: { id: 'Context ID is required.' },
        });
      }
      return executeAction<FlingoosContext>(
        actionName,
        async () => {
          const result = await getContext(context.sessionId, context.companyId, params);
          return { success: true, data: result };
        },
        { serviceName: 'FlingoosMCP' },
      );
    },
  },

  modifyContext: {
    description: 'Modify a Flingoos context by adding, editing, or deleting workflow steps, knowledge items, or metadata using natural language instructions. Use this to update existing content based on user requests. IMPORTANT: Set auto_confirm=false first to preview changes, then ask user to confirm before setting auto_confirm=true.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the context to modify (from listContexts, searchContexts, or getContext)',
        },
        action: {
          type: 'string',
          enum: ['modify', 'add', 'delete'],
          description: 'Type of modification: "modify" to edit existing content, "add" to insert new content, "delete" to remove content. Leave unset to default to "modify".',
        },
        target_type: {
          type: 'string',
          enum: ['step', 'phase', 'knowledge_item', 'metadata'],
          description: 'What to modify: "step" for workflow steps, "phase" for workflow phases, "knowledge_item" for teaching session content, "metadata" for name/description/settings',
        },
        target_number: {
          type: 'number',
          description: 'Step or phase number to target (required when target_type is "step" or "phase"). Use the step number from the workflow content.',
        },
        target_id: {
          type: 'string',
          description: 'Knowledge item ID to target (required when target_type is "knowledge_item"). Use the ID from the teaching session content.',
        },
        change_prompt: {
          type: 'string',
          description: 'Natural language description of what to change (e.g., "change click to double-click", "add a note about checking permissions", "update the title to include date")',
        },
        position: {
          type: 'object',
          properties: {
            after: { type: 'number', description: 'Insert after this step number' },
            before: { type: 'number', description: 'Insert before this step number' },
            at_end: { type: 'boolean', description: 'Insert at the end' },
            at_start: { type: 'boolean', description: 'Insert at the start' },
          },
          description: 'Position specification when action="add". Specify where to insert the new content.',
        },
        auto_confirm: {
          type: 'boolean',
          description: 'If true, save changes immediately. If false (default), return preview only without saving. ALWAYS use false first to show user the preview, then ask for confirmation before using true.',
        },
      },
      required: ['id', 'target_type', 'change_prompt'],
      additionalProperties: false,
    },
    function: async (params: ModifyContextParams) => {
      const actionName = 'modifyContext';
      if (!params.id) {
        throw new ActionValidationError('Context ID is required.', {
          fieldErrors: { id: 'Context ID is required.' },
        });
      }
      if (!params.target_type) {
        throw new ActionValidationError('Target type is required.', {
          fieldErrors: { target_type: 'Target type is required.' },
        });
      }
      if (!params.change_prompt) {
        throw new ActionValidationError('Change prompt is required.', {
          fieldErrors: { change_prompt: 'Change prompt is required.' },
        });
      }
      return executeAction<ModifyContextResponse>(
        actionName,
        async () => {
          const result = await modifyContext(context.sessionId, context.companyId, params);
          return { success: true, data: result };
        },
        { serviceName: 'FlingoosMCP' },
      );
    },
  },

  generateContext: {
    description: 'Generate a new Flingoos workflow or teaching session from text content. Use this to create new structured content from unstructured text (documentation, instructions, procedures, etc.). This is an async operation that returns a session_id - use getContext with that ID after the estimated time to retrieve the generated content.',
    parameters: {
      type: 'object',
      properties: {
        output_type: {
          type: 'string',
          enum: ['workflow_recording', 'teaching_session'],
          description: 'Type to generate: "workflow_recording" for step-by-step procedures/workflows, "teaching_session" for knowledge bases/documentation/explanations',
        },
        content: {
          type: 'string',
          description: 'Text content to convert (50-50000 characters). Can be instructions, documentation, procedures, or any text describing a process or knowledge. The AI will structure it appropriately.',
        },
        name: {
          type: 'string',
          description: 'Name/title for the generated context. Leave unset to auto-generate from content.',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to add the generated context to (optional). Use ID from listContexts where kind="project".',
        },
        visibility: {
          type: 'string',
          enum: ['private', 'org:view', 'org:edit'],
          description: 'Visibility setting: "private" (only creator), "org:view" (organization can view), "org:edit" (organization can edit). Leave unset to default to "private".',
        },
        output_language: {
          type: 'string',
          description: 'Output language code (e.g., "en", "es", "fr", "he") or "auto" to detect from content. Leave unset for automatic detection.',
        },
      },
      required: ['output_type', 'content'],
      additionalProperties: false,
    },
    function: async (params: GenerateContextParams) => {
      const actionName = 'generateContext';
      if (!params.output_type) {
        throw new ActionValidationError('Output type is required.', {
          fieldErrors: { output_type: 'Output type is required.' },
        });
      }
      if (!params.content || params.content.length < 50) {
        throw new ActionValidationError('Content must be at least 50 characters.', {
          fieldErrors: { content: 'Content must be at least 50 characters.' },
        });
      }
      if (params.content.length > 50000) {
        throw new ActionValidationError('Content must not exceed 50000 characters.', {
          fieldErrors: { content: 'Content must not exceed 50000 characters.' },
        });
      }
      return executeAction<GenerateContextResponse>(
        actionName,
        async () => {
          const result = await generateContext(context.sessionId, context.companyId, params);
          return { success: true, data: result };
        },
        { serviceName: 'FlingoosMCP' },
      );
    },
  },
});
