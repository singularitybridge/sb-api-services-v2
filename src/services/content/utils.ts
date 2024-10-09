import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
};

export const buildQuery = (params: {
  companyId: string;
  contentTypeId?: string;
  artifactKey?: string;
}) => {
  const query: any = { companyId: params.companyId };
  if (params.contentTypeId) query.contentTypeId = params.contentTypeId;
  if (params.artifactKey) query.artifactKey = params.artifactKey;
  return query;
};

export const buildSort = (orderBy?: string) => {
  if (!orderBy) return {};
  const [field, direction] = orderBy.split(':');
  return { [field]: direction === 'desc' ? -1 : 1 };
};