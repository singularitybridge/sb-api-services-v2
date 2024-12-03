import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from './content/utils';

let pineconeClient: Pinecone | null = null;
const INDEX_NAME = process.env.PINECONE_INDEX || 'journal';

const initPinecone = () => {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }
    
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

export const upsertVector = async (
  id: string,
  content: string,
  metadata: Record<string, any>
) => {
  try {
    const client = initPinecone();
    const index = client.index(INDEX_NAME);
    
    const embedding = await generateEmbedding(content);
    
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
    const index = client.index(INDEX_NAME);
    
    const queryEmbedding = await generateEmbedding(query);
    
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
