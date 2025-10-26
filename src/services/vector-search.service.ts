import OpenAI from 'openai';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import pLimit from 'p-limit';
import { getApiKey } from './api.key.service';

// Rate limiter: 100 requests per minute (OpenAI tier 2 limit)
const embeddingLimiter = pLimit(100);

export interface VectorSearchOptions {
  scope?: 'company' | 'team' | 'agent' | 'session';
  scopeId?: string;
  limit?: number;
  minScore?: number;
  companyId: string; // Required for API key lookup
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
   * Generate embedding for text using company-specific API key
   */
  async generateEmbedding(text: string, companyId: string): Promise<number[]> {
    const truncated = text.slice(0, this.MAX_TEXT_LENGTH);
    const openai = await this.getOpenAIClient(companyId);

    const response = await openai.embeddings.create({
      model: this.EMBEDDING_MODEL,
      input: truncated,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
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
              key: { $regex: new RegExp(`^unified-workspace:/${scope}/${scopeId}/`) },
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
      const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;

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
        const value = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;

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
            const agent = await Assistant.findOne({ _id: new mongoose.Types.ObjectId(scopeId) });
            if (!agent) {
              logger.warn('Agent not found for embedding', { key, scopeId });
              return;
            }
            resolvedCompanyId = agent.companyId.toString();
          } else if (scope === 'session') {
            // Look up session to get companyId
            const Session = mongoose.connection.db.collection('sessions');
            const session = await Session.findOne({ _id: new mongoose.Types.ObjectId(scopeId) });
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
