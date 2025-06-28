import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from './content/utils';
import { getApiKey } from './api.key.service';

let pineconeClient: Pinecone | null = null;
const INDEX_NAME = process.env.PINECONE_INDEX || 'journal';

const initPinecone = (): Pinecone | null => {
  if (!process.env.PINECONE_API_KEY) {
    // console.warn('PINECONE_API_KEY environment variable not found. Pinecone client not initialized.');
    return null;
  }
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

export const upsertVector = async (
  id: string,
  content: string,
  metadata: Record<string, any>,
  companyId: string,
) => {
  try {
    const client = initPinecone();
    if (!client) {
      console.warn('Pinecone client not initialized. Skipping upsertVector.');
      // Optionally, throw an error or return a specific status
      return;
    }
    const index = client.index(INDEX_NAME);

    const openaiApiKey = await getApiKey(companyId, 'openai_api_key');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found for company');
    }

    const embedding = await generateEmbedding(content, openaiApiKey);

    await index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          ...metadata,
          entity: 'journal', // Tag this vector as a journal entry
        },
      },
    ]);
  } catch (error) {
    console.error('Error upserting vector:', error);
    throw error;
  }
};

export const deleteVector = async (id: string) => {
  try {
    const client = initPinecone();
    if (!client) {
      console.warn('Pinecone client not initialized. Skipping deleteVector.');
      // Optionally, throw an error or return a specific status
      return;
    }
    const index = client.index(INDEX_NAME);

    await index.deleteOne(id);
  } catch (error) {
    console.error('Error deleting vector:', error);
    throw error;
  }
};

export const runVectorSearch = async ({
  query,
  entity,
  companyId,
  limit = 4,
  filter = {},
}: {
  query: string;
  entity?: string[];
  companyId: string;
  limit?: number;
  filter?: Record<string, any>;
}) => {
  try {
    const client = initPinecone();
    if (!client) {
      console.warn(
        'Pinecone client not initialized. Skipping runVectorSearch.',
      );
      // Optionally, throw an error or return a specific status like an empty array
      return [];
    }
    const index = client.index(INDEX_NAME);

    const openaiApiKey = await getApiKey(companyId, 'openai_api_key');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found for company');
    }

    const queryEmbedding = await generateEmbedding(query, openaiApiKey);

    // Combine entity and company filters with any additional filters
    const searchFilter = {
      ...filter,
      companyId: { $eq: companyId },
      ...(entity && entity.length > 0 ? { entity: { $in: entity } } : {}),
    };

    const searchResponse = await index.query({
      topK: limit,
      vector: queryEmbedding,
      includeValues: true,
      includeMetadata: true,
      filter: searchFilter,
    });

    return searchResponse.matches || [];
  } catch (error) {
    console.error('Error running vector search:', error);
    throw error;
  }
};
