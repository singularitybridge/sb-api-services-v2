import { getApiKeyWithFallback } from '../../services/integration-config.service';
import { getSessionById } from '../../services/session.service';

// Flingoos MCP API base URL
const FLINGOOS_MCP_BASE_URL = 'https://mcp.diligent4.com';

// Types for Flingoos MCP API responses
export interface FlingoosContext {
  id: string;
  kind: 'session' | 'project';
  session_type?: 'workflow_recording' | 'teaching_session';
  name: string;
  goal?: string;
  description?: string;
  visibility: string;
  project_id?: string;
  project_name?: string;
  step_count?: number;
  session_count?: number;
  workflow_count?: number;
  teaching_count?: number;
  created_at?: string;
  content?: Record<string, unknown>;
}

export interface ListContextsResponse {
  contexts: FlingoosContext[];
  total_count: number;
  project_count: number;
  session_count: number;
}

export interface SearchContextsResponse {
  query: string;
  status: 'AUTO_SELECTED' | 'SELECTION_REQUIRED' | 'NO_GOOD_MATCHES' | 'NO_MATCHES';
  instruction: string;
  results: Array<FlingoosContext & { score: number; rank: number }>;
  selected?: FlingoosContext;
  total_candidates: number;
}

export interface ModifyContextResponse {
  id: string;
  kind: string;
  session_type?: string;
  target_type: string;
  target_number?: number;
  change_prompt: string;
  preview: string;
  saved: boolean;
  changes: string[];
}

export interface GenerateContextResponse {
  status: 'accepted';
  session_id: string;
  message: string;
  estimated_seconds: number;
  output_type: string;
  content_length: number;
}

// Parameter types
export interface ListContextsParams {
  limit?: number;
  scope?: 'all' | 'mine' | 'public';
  kind?: 'all' | 'project' | 'session';
  session_type?: 'workflow_recording' | 'teaching_session';
}

export interface SearchContextsParams {
  q: string;
  top_k?: number;
  min_confidence?: number;
  scope?: 'all' | 'mine' | 'public';
}

export interface GetContextParams {
  id: string;
  detail?: 'summary' | 'full';
}

export interface ModifyContextParams {
  id: string;
  action?: 'modify' | 'add' | 'delete';
  target_type: 'step' | 'phase' | 'knowledge_item' | 'metadata';
  target_number?: number;
  target_id?: string;
  change_prompt: string;
  position?: { after?: number; before?: number; at_end?: boolean; at_start?: boolean };
  auto_confirm?: boolean;
}

export interface GenerateContextParams {
  output_type: 'workflow_recording' | 'teaching_session';
  content: string;
  name?: string;
  project_id?: string;
  visibility?: 'private' | 'org:view' | 'org:edit';
  output_language?: string;
}

// Internal client configuration
interface FlingoosClientConfig {
  baseUrl: string;
  apiKey: string;
  userId?: string;
  companyId: string;
}

/**
 * Initialize the Flingoos MCP client configuration
 */
const initializeClient = async (
  sessionId: string,
  companyId: string
): Promise<FlingoosClientConfig> => {
  const apiKey = await getApiKeyWithFallback(companyId, 'flingoos_mcp', 'flingoos_mcp_api_key');

  if (!apiKey) {
    throw new Error('Flingoos MCP API key not configured. Please set flingoos_mcp_api_key in integration settings.');
  }

  // Get user ID from session for audit headers
  let userId: string | undefined;
  try {
    const session = await getSessionById(sessionId);
    userId = session.userId?.toString();
  } catch {
    // Session lookup failed, continue without user context
  }

  return {
    baseUrl: FLINGOOS_MCP_BASE_URL,
    apiKey,
    userId,
    companyId,
  };
};

/**
 * Make an HTTP request to the Flingoos MCP API
 */
const makeRequest = async <T>(
  config: FlingoosClientConfig,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: object
): Promise<T> => {
  const url = `${config.baseUrl}${path}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    'X-Singularity-Company-Id': config.companyId,
  };

  // Add optional user context headers
  if (config.userId) {
    headers['X-Singularity-User-Id'] = config.userId;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error || data.message || `HTTP ${response.status}`;
    throw new Error(`Flingoos API error: ${errorMessage}`);
  }

  return data as T;
};

/**
 * List all contexts (workflows, projects, knowledge bases)
 */
export const listContexts = async (
  sessionId: string,
  companyId: string,
  params: ListContextsParams = {}
): Promise<ListContextsResponse> => {
  const config = await initializeClient(sessionId, companyId);
  
  const queryParams = new URLSearchParams();
  if (params.limit !== undefined) queryParams.set('limit', String(params.limit));
  if (params.scope) queryParams.set('scope', params.scope);
  if (params.kind) queryParams.set('kind', params.kind);
  if (params.session_type) queryParams.set('session_type', params.session_type);
  
  const queryString = queryParams.toString();
  const path = `/api/contexts${queryString ? `?${queryString}` : ''}`;
  
  return makeRequest<ListContextsResponse>(config, 'GET', path);
};

/**
 * Search contexts by natural language query
 */
export const searchContexts = async (
  sessionId: string,
  companyId: string,
  params: SearchContextsParams
): Promise<SearchContextsResponse> => {
  const config = await initializeClient(sessionId, companyId);
  
  if (!params.q || params.q.trim().length === 0) {
    throw new Error('Search query (q) is required');
  }
  
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q);
  if (params.top_k !== undefined) queryParams.set('top_k', String(params.top_k));
  if (params.min_confidence !== undefined) queryParams.set('min_confidence', String(params.min_confidence));
  if (params.scope) queryParams.set('scope', params.scope);
  
  const path = `/api/contexts/search?${queryParams.toString()}`;
  
  return makeRequest<SearchContextsResponse>(config, 'GET', path);
};

/**
 * Get a specific context by ID
 */
export const getContext = async (
  sessionId: string,
  companyId: string,
  params: GetContextParams
): Promise<FlingoosContext> => {
  const config = await initializeClient(sessionId, companyId);
  
  if (!params.id) {
    throw new Error('Context ID is required');
  }
  
  const queryParams = new URLSearchParams();
  if (params.detail) queryParams.set('detail', params.detail);
  
  const queryString = queryParams.toString();
  const path = `/api/contexts/${encodeURIComponent(params.id)}${queryString ? `?${queryString}` : ''}`;
  
  return makeRequest<FlingoosContext>(config, 'GET', path);
};

/**
 * Modify a context (workflow steps, knowledge items, etc.)
 */
export const modifyContext = async (
  sessionId: string,
  companyId: string,
  params: ModifyContextParams
): Promise<ModifyContextResponse> => {
  const config = await initializeClient(sessionId, companyId);
  
  if (!params.id) {
    throw new Error('Context ID is required');
  }
  
  if (!params.target_type) {
    throw new Error('Target type is required');
  }
  
  if (!params.change_prompt) {
    throw new Error('Change prompt is required');
  }
  
  const { id, ...body } = params;
  const path = `/api/contexts/${encodeURIComponent(id)}`;
  
  return makeRequest<ModifyContextResponse>(config, 'PATCH', path, body);
};

/**
 * Generate a new context from text content
 */
export const generateContext = async (
  sessionId: string,
  companyId: string,
  params: GenerateContextParams
): Promise<GenerateContextResponse> => {
  const config = await initializeClient(sessionId, companyId);
  
  if (!params.output_type) {
    throw new Error('Output type is required');
  }
  
  if (!params.content || params.content.length < 50) {
    throw new Error('Content must be at least 50 characters');
  }
  
  if (params.content.length > 50000) {
    throw new Error('Content must not exceed 50000 characters');
  }
  
  return makeRequest<GenerateContextResponse>(config, 'POST', '/api/contexts/generate', params);
};
