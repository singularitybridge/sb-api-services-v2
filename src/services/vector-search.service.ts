import OpenAI from 'openai';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';
import { getApiKey } from './api.key.service';
import crypto from 'crypto';

// Rate limiter: 100 requests per minute (OpenAI tier 2 limit)
const embeddingLimiter = pLimit(100);

// Circuit breaker configuration
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

// Embedding cache entry
interface CachedEmbedding {
  embedding: number[];
  timestamp: number;
}

export interface VectorSearchOptions {
  scope?: 'company' | 'team' | 'agent' | 'session';
  scopeId?: string;
  limit?: number;
  minScore?: number;
  companyId: string; // Required for API key lookup
}

export interface MultiScopeSearchOptions {
  scopes?: Array<'company' | 'team' | 'agent' | 'session'>;
  agentIds?: string[] | 'all';
  teamIds?: string[] | 'all';
  limit?: number;
  minScore?: number;
  companyId: string;
  userId?: string; // Required for team filtering
}

export interface VectorSearchResult {
  path: string;
  score: number;
  scope: string;
  scopeId: string;
  metadata: {
    contentType: string;
    size: number;
    createdAt: Date;
  };
}

class VectorSearchService {
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly MAX_TEXT_LENGTH = 8000; // OpenAI limit

  // Embedding cache (1-hour TTL)
  private embeddingCache = new Map<string, CachedEmbedding>();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  // Circuit breaker
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed',
  };
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute cooldown
  private readonly CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT = 30000; // 30s in half-open

  /**
   * Get OpenAI client for a specific company
   */
  private async getOpenAIClient(companyId: string): Promise<OpenAI> {
    const apiKey = await getApiKey(companyId, 'openai_api_key');

    if (!apiKey) {
      throw new Error('OpenAI API key not configured for this company');
    }

    return new OpenAI({ apiKey });
  }

  /**
   * Ensure vector search index exists in MongoDB Atlas
   * Safe to call multiple times (idempotent)
   */
  async ensureVectorIndex(): Promise<void> {
    try {
      const collection = mongoose.connection.db.collection('keyv');

      // Check if index already exists
      const indexes = await collection.listSearchIndexes().toArray();
      const existingIndex = indexes.find(
        (idx: any) => idx.name === 'workspace_vector_index',
      );

      if (existingIndex) {
        logger.info('Vector search index already exists');
        return;
      }

      logger.info('Creating vector search index...');

      // Create vector search index
      const indexDefinition = {
        name: 'workspace_vector_index',
        definition: {
          mappings: {
            dynamic: false,
            fields: {
              embedding: {
                type: 'knnVector',
                dimensions: 1536,
                similarity: 'cosine',
              },
            },
          },
        },
      };

      await collection.createSearchIndex(indexDefinition);

      logger.info(
        'Vector search index created successfully. Note: It may take a few minutes to build in Atlas.',
      );
    } catch (error: any) {
      // Don't fail if we can't create the index - it might already exist or require manual setup
      logger.warn('Could not ensure vector search index', {
        error: error.message,
        note: 'You may need to create the index manually in MongoDB Atlas',
      });
    }
  }

  /**
   * Check circuit breaker state
   */
  private checkCircuitBreaker(): void {
    const now = Date.now();

    if (this.circuitBreaker.state === 'open') {
      // Check if we should move to half-open
      if (
        now - this.circuitBreaker.lastFailureTime >
        this.CIRCUIT_BREAKER_TIMEOUT
      ) {
        logger.info('Circuit breaker moving to half-open state');
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.failures = 0;
      } else {
        throw new Error(
          'Circuit breaker is open - OpenAI API temporarily unavailable',
        );
      }
    }
  }

  /**
   * Record circuit breaker success
   */
  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      logger.info('Circuit breaker moving to closed state');
      this.circuitBreaker.state = 'closed';
    }
    this.circuitBreaker.failures = 0;
  }

  /**
   * Record circuit breaker failure
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      logger.warn('Circuit breaker opened due to failures', {
        failures: this.circuitBreaker.failures,
      });
      this.circuitBreaker.state = 'open';
    }
  }

  /**
   * Generate cache key for embedding
   */
  private getCacheKey(text: string): string {
    return crypto
      .createHash('sha256')
      .update(`${text}:${this.EMBEDDING_MODEL}`)
      .digest('hex');
  }

  /**
   * Generate embedding for text using company-specific API key
   * With caching and circuit breaker
   */
  async generateEmbedding(text: string, companyId: string): Promise<number[]> {
    const truncated = text.slice(0, this.MAX_TEXT_LENGTH);

    // Check cache first
    const cacheKey = this.getCacheKey(truncated);
    const cached = this.embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('Embedding cache hit', {
        cacheKey: cacheKey.substring(0, 8),
      });
      return cached.embedding;
    }

    // Check circuit breaker
    this.checkCircuitBreaker();

    try {
      const openai = await this.getOpenAIClient(companyId);

      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: truncated,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      this.embeddingCache.set(cacheKey, {
        embedding,
        timestamp: Date.now(),
      });

      // Clean up old cache entries periodically (every 100 embeddings)
      if (this.embeddingCache.size > 1000) {
        this.cleanupCache();
      }

      this.recordSuccess();
      return embedding;
    } catch (error: any) {
      this.recordFailure();
      logger.error('Embedding generation failed', {
        error: error.message,
        circuitState: this.circuitBreaker.state,
      });
      throw error;
    }
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.embeddingCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.embeddingCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cleaned up embedding cache', {
        removed,
        remaining: this.embeddingCache.size,
      });
    }
  }

  /**
   * Vector search using MongoDB aggregation
   */
  async search(
    query: string,
    options: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    const { scope, scopeId, limit = 10, minScore = 0.7, companyId } = options;

    // Generate query embedding using company-specific API key
    const queryEmbedding = await this.generateEmbedding(query, companyId);

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'workspace_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit * 2,
          // Note: Atlas Search filter doesn't support $regex, so we filter in $match stage
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: minScore },
          // Filter by scope if provided
          ...(scope &&
            scopeId && {
              key: {
                $regex: new RegExp(`^unified-workspace:/${scope}/${scopeId}/`),
              },
            }),
          // Exclude expired documents
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      },
      { $limit: limit },
      {
        $project: {
          key: 1,
          score: 1,
          value: 1,
        },
      },
    ];

    const results = await mongoose.connection.db
      .collection('keyv')
      .aggregate(pipeline)
      .toArray();

    return results.map((doc) => {
      // Deserialize the value
      const value =
        typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;

      return {
        path: this.stripScopePrefix(doc.key),
        score: doc.score,
        scope: this.extractScope(doc.key),
        scopeId: this.extractScopeId(doc.key),
        metadata: {
          contentType: value.value.metadata.contentType,
          size: value.value.metadata.size,
          createdAt: value.value.metadata.createdAt,
        },
      };
    });
  }

  /**
   * Multi-scope vector search with parallel execution
   */
  async searchMultiScope(
    query: string,
    options: MultiScopeSearchOptions,
  ): Promise<VectorSearchResult[]> {
    const {
      scopes = ['company', 'agent', 'team'],
      agentIds,
      teamIds,
      limit = 20,
      minScore = 0.7,
      companyId,
      userId,
    } = options;

    // Generate embedding once (reuse across all scope searches)
    const queryEmbedding = await this.generateEmbedding(query, companyId);

    // Build scope configurations
    const scopeSearches: Promise<VectorSearchResult[]>[] = [];

    // Company scope
    if (scopes.includes('company')) {
      scopeSearches.push(
        this.executeVectorSearch(queryEmbedding, {
          scope: 'company',
          scopeId: companyId,
          limit: limit * 2, // Request more to account for deduplication
          minScore,
        }),
      );
    }

    // Agent scope
    if (scopes.includes('agent') && agentIds) {
      const resolvedAgentIds = await this.resolveAgentIds(agentIds, companyId);
      for (const agentId of resolvedAgentIds) {
        scopeSearches.push(
          this.executeVectorSearch(queryEmbedding, {
            scope: 'agent',
            scopeId: agentId,
            limit: limit * 2,
            minScore,
          }),
        );
      }
    }

    // Team scope
    if (scopes.includes('team') && teamIds && userId) {
      const resolvedTeamIds = await this.resolveTeamIds(
        teamIds,
        companyId,
        userId,
      );
      for (const teamId of resolvedTeamIds) {
        scopeSearches.push(
          this.executeVectorSearch(queryEmbedding, {
            scope: 'team',
            scopeId: teamId,
            limit: limit * 2,
            minScore,
          }),
        );
      }
    }

    // Execute all searches in parallel
    const allResults = await Promise.all(scopeSearches);

    // Flatten and deduplicate by path (keep highest score)
    const deduplicatedResults = this.deduplicateResults(
      allResults.flat(),
      limit,
    );

    logger.info('Multi-scope search completed', {
      query,
      scopes: scopes.join(','),
      scopeCount: scopeSearches.length,
      totalResults: deduplicatedResults.length,
    });

    return deduplicatedResults;
  }

  /**
   * Execute vector search with pre-generated embedding
   * (Used internally for multi-scope search to avoid regenerating embeddings)
   */
  private async executeVectorSearch(
    queryEmbedding: number[],
    options: {
      scope: string;
      scopeId: string;
      limit: number;
      minScore: number;
    },
  ): Promise<VectorSearchResult[]> {
    const { scope, scopeId, limit, minScore } = options;

    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'workspace_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: limit * 10,
          limit: limit * 2,
        },
      },
      {
        $addFields: {
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: {
          score: { $gte: minScore },
          key: {
            $regex: new RegExp(`^unified-workspace:/${scope}/${scopeId}/`),
          },
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      },
      { $limit: limit },
      {
        $project: {
          key: 1,
          score: 1,
          value: 1,
        },
      },
    ];

    try {
      const results = await mongoose.connection.db
        .collection('keyv')
        .aggregate(pipeline)
        .toArray();

      return results.map((doc) => {
        const value =
          typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;

        return {
          path: this.stripScopePrefix(doc.key),
          score: doc.score,
          scope: this.extractScope(doc.key),
          scopeId: this.extractScopeId(doc.key),
          metadata: {
            contentType: value.value.metadata.contentType,
            size: value.value.metadata.size,
            createdAt: value.value.metadata.createdAt,
          },
        };
      });
    } catch (error: any) {
      logger.error('Vector search failed for scope', {
        scope,
        scopeId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Deduplicate results by path, keeping highest score
   */
  private deduplicateResults(
    results: VectorSearchResult[],
    limit: number,
  ): VectorSearchResult[] {
    const seen = new Map<string, VectorSearchResult>();

    for (const result of results) {
      const existing = seen.get(result.path);

      if (!existing || result.score > existing.score) {
        seen.set(result.path, result);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Resolve agent IDs (supports 'all' or specific IDs)
   */
  private async resolveAgentIds(
    agentIds: string[] | 'all',
    companyId: string,
  ): Promise<string[]> {
    if (agentIds === 'all') {
      const Assistant = mongoose.connection.db.collection('assistants');
      const agents = await Assistant.find({
        companyId: new mongoose.Types.ObjectId(companyId),
      })
        .project({ _id: 1 })
        .toArray();

      return agents.map((a) => a._id.toString());
    }

    return agentIds;
  }

  /**
   * Resolve team IDs (supports 'all' or specific IDs)
   * Filters to only teams the user is a member of
   */
  private async resolveTeamIds(
    teamIds: string[] | 'all',
    companyId: string,
    userId: string,
  ): Promise<string[]> {
    const Team = mongoose.connection.db.collection('teams');

    if (teamIds === 'all') {
      const teams = await Team.find({
        companyId: new mongoose.Types.ObjectId(companyId),
        members: {
          $elemMatch: { userId: new mongoose.Types.ObjectId(userId) },
        },
      })
        .project({ _id: 1 })
        .toArray();

      return teams.map((t) => t._id.toString());
    }

    // Verify user has access to specified teams
    const teams = await Team.find({
      _id: { $in: teamIds.map((id) => new mongoose.Types.ObjectId(id)) },
      companyId: new mongoose.Types.ObjectId(companyId),
      members: { $elemMatch: { userId: new mongoose.Types.ObjectId(userId) } },
    })
      .project({ _id: 1 })
      .toArray();

    return teams.map((t) => t._id.toString());
  }

  /**
   * Embed a document (async, rate-limited)
   */
  async embedDocument(key: string, companyId?: string): Promise<void> {
    return embeddingLimiter(async () => {
      try {
        const doc = await mongoose.connection.db
          .collection('keyv')
          .findOne({ key });

        if (!doc?.value) {
          logger.debug('No document found', { key });
          return;
        }

        // Deserialize the value (keyv stores it as a JSON string)
        const value =
          typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;

        if (!value?.value?.content) {
          logger.debug('No content to embed', { key });
          return;
        }

        // Extract text
        let text = '';
        if (typeof value.value.content === 'string') {
          text = value.value.content;
        } else if (typeof value.value.content === 'object') {
          text = JSON.stringify(value.value.content);
        }

        if (!text) return;

        // Get companyId if not provided
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId) {
          // Extract from key: unified-workspace:/scope/scopeId/path
          const scope = this.extractScope(key);
          const scopeId = this.extractScopeId(key);

          if (scope === 'agent') {
            // Look up agent to get companyId
            const Assistant = mongoose.connection.db.collection('assistants');
            const agent = await Assistant.findOne({
              _id: new mongoose.Types.ObjectId(scopeId),
            });
            if (!agent) {
              logger.warn('Agent not found for embedding', { key, scopeId });
              return;
            }
            resolvedCompanyId = agent.companyId.toString();
          } else if (scope === 'session') {
            // Look up session to get companyId
            const Session = mongoose.connection.db.collection('sessions');
            const session = await Session.findOne({
              _id: new mongoose.Types.ObjectId(scopeId),
            });
            if (!session) {
              logger.warn('Session not found for embedding', { key, scopeId });
              return;
            }
            resolvedCompanyId = session.companyId.toString();
          } else if (scope === 'company') {
            // scopeId is the companyId
            resolvedCompanyId = scopeId;
          } else {
            logger.warn('Unknown scope for embedding', { key, scope });
            return;
          }
        }

        // Generate embedding using company-specific API key
        const embedding = await this.generateEmbedding(text, resolvedCompanyId);

        // Update the deserialized value with embedding metadata
        if (!value.value.metadata) {
          value.value.metadata = {};
        }
        value.value.metadata.embeddedAt = new Date();

        // Store embedding in root level field for vector search + inside value for metadata
        await mongoose.connection.db.collection('keyv').updateOne(
          { key },
          {
            $set: {
              value: JSON.stringify(value),
              embedding: embedding, // Separate field for vector search index
              embeddedAt: new Date(),
            },
          },
        );

        logger.info('Document embedded', { key, companyId: resolvedCompanyId });
      } catch (error: any) {
        logger.error('Embed failed', { key, error: error.message });
      }
    });
  }

  // Helper methods
  private extractScope(key: string): string {
    const match = key.match(/^unified-workspace:\/([^\/]+)\//);
    return match ? match[1] : 'unknown';
  }

  private extractScopeId(key: string): string {
    const match = key.match(/^unified-workspace:\/[^\/]+\/([^\/]+)\//);
    return match ? match[1] : 'unknown';
  }

  private stripScopePrefix(key: string): string {
    const match = key.match(/^unified-workspace:\/[^\/]+\/[^\/]+\/(.+)$/);
    return match ? match[1] : key;
  }
}

// Singleton
let instance: VectorSearchService;

export function getVectorSearchService(): VectorSearchService {
  if (!instance) {
    instance = new VectorSearchService();
  }
  return instance;
}
