import { ContentItem, IContentItem } from '../../models/ContentItem';
import { validateContentData } from './validation';
import { buildQuery, buildSort } from './utils';

type ContentItemOperation = 'create' | 'update';

const handleContentItemOperation = async (
  operation: ContentItemOperation,
  companyId: string,
  contentTypeId: string,
  data: any,
  artifactKey: string,
  existingItem?: IContentItem
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

  if (operation === 'create') {
    const contentItem = new ContentItem({ companyId, contentTypeId, artifactKey, data });
    return await contentItem.save();
  } else {
    if (!existingItem) {
      return { error: 'Not Found', details: { message: 'Content item not found' } };
    }
    existingItem.data = data;
    existingItem.artifactKey = artifactKey;
    return await existingItem.save();
  }
};

export const createContentItem = async (
  companyId: string,
  contentTypeId: string,
  data: any,
  artifactKey: string
): Promise<IContentItem | { error: string; details: any }> => {
  return handleContentItemOperation('create', companyId, contentTypeId, data, artifactKey);
};

export const updateContentItem = async (
  id: string,
  companyId: string,
  data: any,
  artifactKey: string
): Promise<IContentItem | { error: string; details: any }> => {
  const existingItem = await ContentItem.findOne({ _id: id, companyId });
  if (!existingItem) {
    return { error: 'Not Found', details: { message: 'Content item not found' } };
  }
  return handleContentItemOperation('update', companyId, existingItem.contentTypeId.toString(), data, artifactKey, existingItem);
};

export const getContentItems = async (
  companyId: string,
  contentTypeId?: string,
  artifactKey?: string,
  orderBy?: string,
  limit?: number,
  skip?: number
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, contentTypeId, artifactKey });
  const sort = buildSort(orderBy);

  return await ContentItem.find(query)
    .sort(sort)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const getContentItem = async (
  id: string,
  companyId: string
): Promise<IContentItem | null> => {
  return await ContentItem.findOne({ _id: id, companyId });
};

export const getContentItemsByArtifactKey = async (
  companyId: string,
  artifactKey: string,
  contentTypeId?: string,
  orderBy?: string,
  limit?: number,
  skip?: number
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, artifactKey, contentTypeId });
  const sort = buildSort(orderBy);

  return await ContentItem.find(query)
    .sort(sort)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const deleteContentItem = async (
  id: string,
  companyId: string
): Promise<boolean> => {
  const result = await ContentItem.deleteOne({ _id: id, companyId });
  return result.deletedCount === 1;
};

export const getContentItemsByType = async (
  companyId: string,
  contentTypeId: string,
  orderBy?: string,
  limit?: number,
  skip?: number
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, contentTypeId });
  const sort = buildSort(orderBy);

  return await ContentItem.find(query)
    .sort(sort)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const deleteContentItemsByType = async (
  companyId: string,
  contentTypeId: string
): Promise<number> => {
  console.log(`Deleting all content items for companyId: ${companyId}, contentTypeId: ${contentTypeId}`);
  const result = await ContentItem.deleteMany({ companyId, contentTypeId });
  return result.deletedCount;
};