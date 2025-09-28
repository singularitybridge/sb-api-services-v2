// Minimal vector search implementation for journal integration
// This is a placeholder until journal is refactored to use unified workspace

export interface VectorSearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  companyId?: string;
  metadata?: Record<string, any>;
  entity?: string[];
  filter?: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, any>;
}

// In-memory store for journal vectors (temporary until refactored)
class SimpleVectorStore {
  private entries: Map<string, { content: string; metadata?: Record<string, any> }> = new Map();

  async add(id: string, content: string, metadata?: Record<string, any>): Promise<void> {
    this.entries.set(id, { content, metadata });
  }

  delete(id: string): void {
    this.entries.delete(id);
  }

  async hybridSearch(
    query: string,
    options: { limit?: number; filter?: Record<string, any> }
  ): Promise<Array<{ id: string; score: number; content: string; metadata?: Record<string, any> }>> {
    // Simple text matching for now
    const results: Array<{ id: string; score: number; content: string; metadata?: Record<string, any> }> = [];

    for (const [id, entry] of this.entries) {
      // Apply filter if provided
      if (options.filter) {
        const filterMatch = Object.entries(options.filter).every(([key, value]) =>
          entry.metadata?.[key] === value
        );
        if (!filterMatch) continue;
      }

      // Simple scoring based on query presence
      const score = entry.content.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0.2;
      results.push({ id, score, content: entry.content, metadata: entry.metadata });
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }
}

const vectorStore = new SimpleVectorStore();

/**
 * Upsert a vector entry in the vector store
 */
export async function upsertVector(
  id: string,
  content: string,
  metadata?: Record<string, any>,
  companyId?: string,
): Promise<void> {
  const finalMetadata = {
    ...metadata,
    companyId: companyId || metadata?.companyId,
  };
  await vectorStore.add(id, content, finalMetadata);
}

/**
 * Delete a vector entry from the vector store
 */
export async function deleteVector(id: string): Promise<void> {
  vectorStore.delete(id);
}

/**
 * Run a vector search
 */
export async function runVectorSearch(
  options: VectorSearchOptions,
): Promise<VectorSearchResult[]> {
  const results = await vectorStore.hybridSearch(options.query, {
    limit: options.limit || 10,
    filter: options.companyId ? { companyId: options.companyId } : undefined,
  });

  return results.filter(r => r.score >= (options.minScore || 0));
}