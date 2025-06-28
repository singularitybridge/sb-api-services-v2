import { ContentItem, IContentItem } from '../../models/ContentItem';
import { buildQuery, buildSort } from './utils';

export const getContentItems = async (
  companyId: string,
  contentTypeId?: string,
  artifactKey?: string,
  orderBy?: string,
  limit?: number,
  skip?: number,
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, contentTypeId, artifactKey });
  const sort = orderBy ? buildSort(orderBy) : { createdAt: -1 };

  return await ContentItem.find(query)
    .sort(sort as any)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const getContentItem = async (
  id: string,
  companyId: string,
): Promise<IContentItem | null> => {
  return await ContentItem.findOne({ _id: id, companyId });
};

export const getContentItemsByArtifactKey = async (
  companyId: string,
  artifactKey: string,
  contentTypeId?: string,
  orderBy?: string,
  limit?: number,
  skip?: number,
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, artifactKey, contentTypeId });
  const sort = orderBy ? buildSort(orderBy) : { createdAt: -1 };

  return await ContentItem.find(query)
    .sort(sort as any)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const getContentItemsByType = async (
  companyId: string,
  contentTypeId: string,
  orderBy?: string,
  limit?: number,
  skip?: number,
): Promise<IContentItem[]> => {
  const query = buildQuery({ companyId, contentTypeId });
  const sort = orderBy ? buildSort(orderBy) : { createdAt: -1 };

  return await ContentItem.find(query)
    .sort(sort as any)
    .limit(limit || 10)
    .skip(skip || 0);
};
