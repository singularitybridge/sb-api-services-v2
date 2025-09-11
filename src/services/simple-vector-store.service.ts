import { embed, cosineSimilarity } from 'ai';
import { openai } from '@ai-sdk/openai';

interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  timestamp: Date;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

/**
 * Simple in-memory vector store using Vercel AI SDK
 * No external dependencies needed - just uses what we already have
 */
export class SimpleVectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private embeddingModel = openai.textEmbeddingModel('text-embedding-3-large');
  
  constructor(
    private options: {
      maxEntries?: number;
      dimensions?: number;
    } = {}
  ) {
    this.options.maxEntries = options.maxEntries || 10000;
    this.options.dimensions = options.dimensions || 3072; // text-embedding-3-large default
  }

  /**
   * Add a document to the vector store
   */
  async add(
    id: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Generate embedding using Vercel AI SDK
    const { embedding } = await embed({
      model: this.embeddingModel,
      value: content
    });

    // Store the entry
    this.vectors.set(id, {
      id,
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    });

    // Enforce max entries limit (simple FIFO)
    if (this.vectors.size > this.options.maxEntries!) {
      const firstKey = this.vectors.keys().next().value;
      if (firstKey) {
        this.vectors.delete(firstKey);
      }
    }
  }

  /**
   * Add multiple documents in batch
   */
  async addMany(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<void> {
    // Batch generate embeddings for efficiency
    const contents = documents.map(d => d.content);
    
    // Process in chunks to avoid API limits
    const chunkSize = 100;
    for (let i = 0; i < contents.length; i += chunkSize) {
      const chunk = contents.slice(i, i + chunkSize);
      const chunkDocs = documents.slice(i, i + chunkSize);
      
      // Generate embeddings for chunk
      const embeddings = await Promise.all(
        chunk.map(content => 
          embed({
            model: this.embeddingModel,
            value: content
          })
        )
      );

      // Store each entry
      chunkDocs.forEach((doc, index) => {
        this.vectors.set(doc.id, {
          id: doc.id,
          content: doc.content,
          embedding: embeddings[index].embedding,
          metadata: {
            ...doc.metadata,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date()
        });
      });
    }

    // Enforce max entries limit
    while (this.vectors.size > this.options.maxEntries!) {
      const firstKey = this.vectors.keys().next().value;
      if (firstKey) {
        this.vectors.delete(firstKey);
      } else {
        break;
      }
    }
  }

  /**
   * Search for similar documents using cosine similarity
   */
  async search(
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      filter?: (metadata: Record<string, any>) => boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, minScore = 0, filter } = options;

    // Generate query embedding
    const { embedding: queryVector } = await embed({
      model: this.embeddingModel,
      value: query
    });

    // Calculate similarities for all vectors
    const results: SearchResult[] = [];
    
    for (const [id, entry] of this.vectors) {
      // Apply metadata filter if provided
      if (filter && !filter(entry.metadata)) {
        continue;
      }

      // Calculate cosine similarity using Vercel AI SDK
      const similarity = cosineSimilarity(queryVector, entry.embedding);
      
      // Only include results above minimum score
      if (similarity >= minScore) {
        results.push({
          id: entry.id,
          content: entry.content,
          score: similarity,
          metadata: entry.metadata
        });
      }
    }

    // Sort by similarity score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search with multiple filters and advanced options
   */
  async hybridSearch(
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      scope?: string[];
      pathPattern?: RegExp;
      companyId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<SearchResult[]> {
    const filter = (meta: Record<string, any>) => {
      // Apply scope filter
      if (options.scope && !options.scope.includes(meta.scope)) {
        return false;
      }
      
      // Apply path pattern filter
      if (options.pathPattern && !options.pathPattern.test(meta.path)) {
        return false;
      }
      
      // Apply company filter
      if (options.companyId && meta.companyId !== options.companyId) {
        return false;
      }
      
      // Apply generic metadata filters
      if (options.metadata) {
        for (const [key, value] of Object.entries(options.metadata)) {
          if (meta[key] !== value) {
            return false;
          }
        }
      }
      
      return true;
    };

    return this.search(query, {
      limit: options.limit,
      minScore: options.minScore,
      filter
    });
  }

  /**
   * Get a specific entry by ID
   */
  get(id: string): VectorEntry | undefined {
    return this.vectors.get(id);
  }

  /**
   * Delete an entry by ID
   */
  delete(id: string): boolean {
    return this.vectors.delete(id);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * Get the number of entries
   */
  get size(): number {
    return this.vectors.size;
  }

  /**
   * Export all entries (for persistence)
   */
  export(): VectorEntry[] {
    return Array.from(this.vectors.values());
  }

  /**
   * Import entries (from persistence)
   */
  import(entries: VectorEntry[]): void {
    for (const entry of entries) {
      this.vectors.set(entry.id, entry);
    }
  }

  /**
   * Find similar documents to an existing document
   */
  async findSimilar(
    id: string,
    options: {
      limit?: number;
      minScore?: number;
      excludeSelf?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const entry = this.vectors.get(id);
    if (!entry) {
      throw new Error(`Entry with id ${id} not found`);
    }

    const results: SearchResult[] = [];
    
    for (const [otherId, otherEntry] of this.vectors) {
      // Skip self if requested
      if (options.excludeSelf && otherId === id) {
        continue;
      }

      // Calculate similarity
      const similarity = cosineSimilarity(entry.embedding, otherEntry.embedding);
      
      if (similarity >= (options.minScore || 0)) {
        results.push({
          id: otherEntry.id,
          content: otherEntry.content,
          score: similarity,
          metadata: otherEntry.metadata
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10);
  }

  /**
   * Consolidate similar entries (for memory optimization)
   */
  async consolidateSimilar(
    similarityThreshold: number = 0.85
  ): Promise<{ consolidated: number; groups: Array<string[]> }> {
    const processed = new Set<string>();
    const groups: Array<string[]> = [];

    for (const [id, entry] of this.vectors) {
      if (processed.has(id)) continue;

      // Find all similar entries
      const similar = await this.findSimilar(id, {
        minScore: similarityThreshold,
        excludeSelf: false
      });

      if (similar.length > 1) {
        const group = similar.map(s => s.id);
        groups.push(group);
        group.forEach(gid => processed.add(gid));
      }
    }

    return {
      consolidated: groups.length,
      groups
    };
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): {
    totalEntries: number;
    memoryUsage: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.vectors.values()) {
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    // Rough memory estimate (assuming 4 bytes per float in embeddings)
    const memoryUsage = this.vectors.size * this.options.dimensions! * 4;

    return {
      totalEntries: this.vectors.size,
      memoryUsage,
      oldestEntry,
      newestEntry
    };
  }
}

// Export singleton instance
export const vectorStore = new SimpleVectorStore({
  maxEntries: 10000,
  dimensions: 3072
});