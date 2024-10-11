import { ContentItem, IContentItem } from '../../models/ContentItem';
import { validateContentData } from './validation';
import { generateEmbedding } from './utils';

type ContentItemOperation = 'create' | 'update';

const handleContentItemOperation = async (
  operation: ContentItemOperation,
  companyId: string,
  contentTypeId: string,
  data: any,
  artifactKey: string,
  existingItem?: IContentItem,
  embedding?: number[]
): Promise<IContentItem | { error: string; details: any }> => {
  const validation = await validateContentData(contentTypeId, data);

  if (!validation.isValid) {
    return {
      error: 'Validation Error',
      details: {
        message: 'Request does not match the content type schema.',
        schema: validation.contentType?.fields,
        errors: validation.errors
      }
    };
  }

  // Exclude 'embedding' from 'data' when generating the embedding
  const { embedding: _, ...dataWithoutEmbedding } = data;

  const textToEmbed =
    dataWithoutEmbedding.text ||
    dataWithoutEmbedding.content ||
    JSON.stringify(dataWithoutEmbedding);

  // Use the provided embedding or generate a new one
  const embeddingToUse = embedding || (await generateEmbedding(textToEmbed));

  if (operation === 'create') {
    const contentItem = new ContentItem({
      companyId,
      contentTypeId,
      artifactKey,
      data: dataWithoutEmbedding,
      embedding: embeddingToUse,
    });
    return await contentItem.save();
  } else {
    if (!existingItem) {
      return { error: 'Not Found', details: { message: 'Content item not found' } };
    }
    existingItem.data = dataWithoutEmbedding;
    existingItem.artifactKey = artifactKey;
    existingItem.embedding = embeddingToUse;
    return await existingItem.save();
  }
};

export const createContentItem = async (
  companyId: string,
  contentTypeId: string,
  data: any,
  artifactKey: string,
  embedding?: number[]
): Promise<IContentItem | { error: string; details: any }> => {
  return handleContentItemOperation('create', companyId, contentTypeId, data, artifactKey, undefined, embedding);
};

export const updateContentItem = async (
  id: string,
  companyId: string,
  data: any,
  artifactKey: string,
  embedding?: number[]
): Promise<IContentItem | { error: string; details: any }> => {
  const existingItem = await ContentItem.findOne({ _id: id, companyId });
  if (!existingItem) {
    return { error: 'Not Found', details: { message: 'Content item not found' } };
  }
  return handleContentItemOperation('update', companyId, existingItem.contentTypeId.toString(), data, artifactKey, existingItem, embedding);
};

export const deleteContentItem = async (
  id: string,
  companyId: string
): Promise<boolean> => {
  const result = await ContentItem.deleteOne({ _id: id, companyId });
  return result.deletedCount === 1;
};

export const deleteContentItemsByType = async (
  companyId: string,
  contentTypeId: string
): Promise<number> => {
  console.log(`Deleting all content items for companyId: ${companyId}, contentTypeId: ${contentTypeId}`);
  const result = await ContentItem.deleteMany({ companyId, contentTypeId });
  return result.deletedCount;
};