import { ContentItem, IContentItem } from '../../models/ContentItem';
import { generateEmbedding } from './utils';
import { getApiKey } from '../../services/api.key.service';

export const searchContentItems = async (
  companyId: string,
  queryText: string,
  contentTypeId?: string,
  limit: number = 10
): Promise<IContentItem[]> => {
  // Get OpenAI API key
  const openaiApiKey = await getApiKey(companyId, 'openai_api_key');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not found for company');
  }

  const queryEmbedding = await generateEmbedding(queryText, openaiApiKey);

  // Log the count of items
  const totalCount = await ContentItem.countDocuments({ companyId });
  console.log(`Total content items for companyId ${companyId}: ${totalCount}`);

  const aggregation = [
    {
      $search: {
        index: 'vector_index',
        knnBeta: {
          vector: queryEmbedding,
          path: 'embedding',
          k: limit,
        },
      },
    },
    {
      $match: {
        companyId: companyId,
        ...(contentTypeId && { contentTypeId }),
      },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 1,
        companyId: 1,
        contentTypeId: 1,
        artifactKey: 1,
        data: 1,
        score: { $meta: 'searchScore' },
      },
    },
  ];

  const results = await ContentItem.aggregate(aggregation);
  console.log(`Vector search returned ${results.length} items`);

  return results;
};
