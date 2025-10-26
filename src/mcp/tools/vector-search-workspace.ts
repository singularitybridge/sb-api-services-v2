/**
 * Vector Search Workspace Tool
 *
 * Perform semantic vector search over workspace items using embeddings
 */

import { z } from 'zod';
import { resolveAssistantIdentifier } from '../../services/assistant/assistant-resolver.service';
import { getVectorSearchService } from '../../services/vector-search.service';

/**
 * Input schema for the vector_search_workspace tool
 */
export const vectorSearchWorkspaceSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Search query to find semantically similar workspace items'),
  scope: z
    .enum(['company', 'session', 'agent'])
    .optional()
    .describe(
      'Storage scope: "company", "session", or "agent" (default: "agent")',
    ),
  scopeId: z
    .string()
    .optional()
    .describe(
      'ID for the scope: agentId/name for agent scope, sessionId for session scope. For company scope, this is ignored.',
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of results to return (default: 10, max: 50)'),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Minimum similarity score threshold (0-1, default: 0.7). Higher values return only more relevant results.',
    ),
});

export type VectorSearchWorkspaceInput = z.infer<
  typeof vectorSearchWorkspaceSchema
>;

/**
 * Perform vector search over workspace items
 */
export async function vectorSearchWorkspace(
  input: VectorSearchWorkspaceInput,
  companyId: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const scope = input.scope || 'agent';
    const limit = input.limit || 10;
    const minScore = input.minScore || 0.7;
    const vectorSearch = getVectorSearchService();

    let resolvedScopeId: string | undefined = input.scopeId;

    // Resolve agent by ID or name if scope is agent
    if (scope === 'agent' && input.scopeId) {
      const agent = await resolveAssistantIdentifier(input.scopeId, companyId);
      if (!agent) {
        throw new Error(`Agent not found: ${input.scopeId}`);
      }
      resolvedScopeId = agent._id.toString();
    }

    // Perform vector search
    const results = await vectorSearch.search(input.query, {
      scope,
      scopeId: resolvedScopeId,
      limit,
      minScore,
      companyId,
    });

    // Format results for MCP response
    const formattedResults = results.map((result) => ({
      path: result.path,
      score: Math.round(result.score * 1000) / 1000, // Round to 3 decimals
      scope: result.scope,
      scopeId: result.scopeId,
      contentType: result.metadata?.contentType,
      size: result.metadata?.size,
      createdAt: result.metadata?.createdAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query: input.query,
              scope: {
                type: scope,
                id: resolvedScopeId,
              },
              results: formattedResults,
              count: formattedResults.length,
              params: {
                limit,
                minScore,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    console.error('MCP vector search workspace error:', error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to perform vector search',
              query: input.query,
              scope: input.scope || 'agent',
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

/**
 * Tool metadata for registration
 */
export const vectorSearchWorkspaceTool = {
  name: 'vector_search_workspace',
  description:
    'Perform semantic vector search over workspace items using AI embeddings. Finds documents similar to your query based on meaning, not just keywords. Useful for finding related documentation, code snippets, or any workspace content by semantic similarity. Returns ranked results with similarity scores.',
  inputSchema: vectorSearchWorkspaceSchema,
};
