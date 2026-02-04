import {
  Context,
  ContextSummary,
  SearchResponse,
  GenerateResponse,
  ListContextsArgs,
  SearchWorkflowsArgs,
  GetContextArgs,
  GenerateWorkflowArgs,
  ModifyContextArgs,
} from './types';

const BASE_URL = process.env.DILIGENT4_BASE_URL || 'https://mcp.diligent4.com';

// Response format for MCP-style endpoints (list, search, get)
interface MCPStyleResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Response format for direct-style endpoints (generate)
interface DirectStyleResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
}

/**
 * Parse API response - handles both MCP-style and direct-style formats
 */
function parseResponse<T>(rawResponse: unknown): T {
  // Check if it's MCP-style format: { content: [{ type: "text", text: "..." }] }
  if (
    rawResponse &&
    typeof rawResponse === 'object' &&
    'content' in rawResponse &&
    Array.isArray((rawResponse as MCPStyleResponse).content)
  ) {
    const mcpResponse = rawResponse as MCPStyleResponse;
    if (!mcpResponse.content?.[0]?.text) {
      throw new Error('Invalid MCP response format');
    }
    const parsed = JSON.parse(mcpResponse.content[0].text);
    // MCP responses have nested { ok: true, data: ... }
    if (parsed.ok === true && parsed.data !== undefined) {
      return parsed.data as T;
    }
    if (parsed.ok === false && parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed as T;
  }

  // Check if it's direct-style format: { ok: true, data: ... }
  if (
    rawResponse &&
    typeof rawResponse === 'object' &&
    'ok' in rawResponse
  ) {
    const directResponse = rawResponse as DirectStyleResponse<T>;
    if (directResponse.ok === false) {
      throw new Error(directResponse.error || 'API request failed');
    }
    return directResponse.data;
  }

  // Fallback - return as is
  return rawResponse as T;
}

/**
 * Make authenticated request to Diligent4 API
 */
async function apiRequest<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorText;
    } catch {
      errorMessage = errorText;
    }
    throw new Error(`Diligent4 API error (${response.status}): ${errorMessage}`);
  }

  const data = await response.json();
  return parseResponse<T>(data);
}

/**
 * Sleep helper for polling
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * List available contexts (workflows and sessions)
 */
export async function listContexts(
  apiKey: string,
  args: ListContextsArgs,
): Promise<{ success: boolean; data: ContextSummary[] }> {
  const params = new URLSearchParams({
    limit: String(args.limit || 50),
    kind: args.kind || 'all',
  });

  if (args.sessionType) {
    params.set('session_type', args.sessionType);
  }

  const result = await apiRequest<{ contexts: ContextSummary[] }>(
    apiKey,
    `/api/contexts?${params}`,
  );

  return {
    success: true,
    data: result.contexts || [],
  };
}

/**
 * Search for workflows using semantic search
 */
export async function searchWorkflows(
  apiKey: string,
  args: SearchWorkflowsArgs,
): Promise<{ success: boolean; data: SearchResponse | Context }> {
  const params = new URLSearchParams({
    q: args.query,
    top_k: String(args.topK || 5),
    min_confidence: String(args.minConfidence || 0.3),
  });

  const result = await apiRequest<SearchResponse>(
    apiKey,
    `/api/contexts/search?${params}`,
  );

  // If auto-fetch is enabled and we have a high-confidence match, fetch full details
  if (args.autoFetch && result.status === 'AUTO_SELECTED' && result.results?.length > 0) {
    const contextResult = await getContext(apiKey, {
      id: result.results[0].id,
      detail: 'full',
    });

    if (contextResult.success && contextResult.data) {
      return {
        success: true,
        data: contextResult.data,
      };
    }
  }

  return {
    success: true,
    data: result,
  };
}

/**
 * Get context details by ID
 */
export async function getContext(
  apiKey: string,
  args: GetContextArgs,
): Promise<{ success: boolean; data: Context }> {
  const params = new URLSearchParams({
    detail: args.detail || 'full',
  });

  const result = await apiRequest<Context>(
    apiKey,
    `/api/contexts/${args.id}?${params}`,
  );

  return {
    success: true,
    data: result,
  };
}

/**
 * Generate workflow from text content
 * Handles async generation with optional polling
 */
export async function generateWorkflow(
  apiKey: string,
  args: GenerateWorkflowArgs,
): Promise<{ success: boolean; data: Context | GenerateResponse }> {
  const body = {
    output_type: args.outputType || 'workflow_recording',
    content: args.content,
    name: args.name,
  };

  const result = await apiRequest<GenerateResponse>(
    apiKey,
    '/api/contexts/generate',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

  // If not waiting for completion, return immediately
  if (!args.waitForCompletion) {
    return {
      success: true,
      data: result,
    };
  }

  // Poll for completion
  const maxWait = (args.maxWaitSeconds || 60) * 1000;
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();

  // Initial wait based on estimated time
  const initialWait = Math.min(result.estimated_seconds * 1000, maxWait / 2);
  await sleep(initialWait);

  while (Date.now() - startTime < maxWait) {
    try {
      const contextResult = await getContext(apiKey, {
        id: result.session_id,
        detail: 'full',
      });

      if (contextResult.success && contextResult.data) {
        return {
          success: true,
          data: contextResult.data,
        };
      }
    } catch {
      // Context not ready yet, continue polling
    }

    await sleep(pollInterval);
  }

  // Timeout - return the generation response so caller knows the ID
  return {
    success: true,
    data: {
      ...result,
      status: 'processing',
    } as GenerateResponse,
  };
}

/**
 * Modify context with natural language instruction
 */
export async function modifyContext(
  apiKey: string,
  args: ModifyContextArgs,
): Promise<{ success: boolean; data: Context }> {
  const body: Record<string, unknown> = {
    target_type: args.targetType,
    change_prompt: args.changePrompt,
  };

  if (args.action) {
    body.action = args.action;
  }
  if (args.targetNumber !== undefined) {
    body.target_number = args.targetNumber;
  }
  if (args.targetId) {
    body.target_id = args.targetId;
  }
  if (args.position) {
    body.position = args.position;
  }
  if (args.autoConfirm !== undefined) {
    body.auto_confirm = args.autoConfirm;
  }

  const result = await apiRequest<Context>(
    apiKey,
    `/api/contexts/${args.id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );

  return {
    success: true,
    data: result,
  };
}

/**
 * Validate API connection
 */
export async function validateConnection(
  apiKey: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await listContexts(apiKey, { limit: 1 });
    return {
      success: true,
      message: 'Successfully connected to Diligent4',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
