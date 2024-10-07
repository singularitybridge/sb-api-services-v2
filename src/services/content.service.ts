import { ContentType, IContentType } from '../models/ContentType';
import { ContentItem, IContentItem } from '../models/ContentItem';
import mongoose from 'mongoose';

export const validateContentData = async (
  contentTypeId: string,
  data: any
): Promise<{ isValid: boolean; errors: { field: string; message: string }[]; contentType: IContentType | null }> => {
  const contentType = await ContentType.findById(contentTypeId);
  if (!contentType) {
    return { isValid: false, errors: [{ field: 'contentTypeId', message: 'ContentType not found' }], contentType: null };
  }

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: [{ field: 'data', message: 'Content data is missing or invalid' }], contentType };
  }

  const errors: { field: string; message: string }[] = [];

  for (const fieldDef of contentType.fields) {
    const value = data[fieldDef.name];
    const fieldType = fieldDef.type.toLowerCase();

    // Check required fields
    if (fieldDef.required && (value === undefined || value === null)) {
      errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' is required.` });
      continue;
    }

    // Validate field type
    if (value !== undefined && value !== null) {
      switch (fieldType) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be a string.` });
          }
          break;
        case 'number':
          if (typeof value !== 'number') {
            errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be a number.` });
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be a boolean.` });
          }
          break;
        case 'date':
          if (!(value instanceof Date) && isNaN(Date.parse(value))) {
            errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be a valid date.` });
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be an array.` });
          }
          break;
        default:
          errors.push({ field: fieldDef.name, message: `Unsupported field type '${fieldDef.type}' for field '${fieldDef.name}'.` });
      }
    }

    // Validate enumeration values
    if (fieldDef.enum && fieldDef.enum.length > 0 && value !== undefined) {
      if (!fieldDef.enum.includes(value)) {
        errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be one of [${fieldDef.enum.join(', ')}].` });
      }
    }
  }

  return { isValid: errors.length === 0, errors, contentType };
};

const handleContentItemOperation = async (
  operation: 'create' | 'update',
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
    const contentItem = new ContentItem({
      companyId,
      contentTypeId,
      artifactKey,
      data,
    });
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
  const query: any = { companyId };
  if (contentTypeId) {
    query.contentTypeId = contentTypeId;
  }
  if (artifactKey) {
    query.artifactKey = artifactKey;
  }

  let sort: any = {};
  if (orderBy) {
    const [field, order] = orderBy.split(':');
    sort[`data.${field}`] = order === 'desc' ? -1 : 1;
  } else {
    sort = { createdAt: -1 };
  }

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
  const query: any = { companyId, artifactKey };
  if (contentTypeId) {
    query.contentTypeId = contentTypeId;
  }

  let sort: any = {};
  if (orderBy) {
    const [field, order] = orderBy.split(':');
    sort[`data.${field}`] = order === 'desc' ? -1 : 1;
  } else {
    sort = { createdAt: -1 };
  }

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
  const query: any = { companyId, contentTypeId };

  let sort: any = {};
  if (orderBy) {
    const [field, order] = orderBy.split(':');
    sort[`data.${field}`] = order === 'desc' ? -1 : 1;
  } else {
    sort = { createdAt: -1 };
  }

  return await ContentItem.find(query)
    .sort(sort)
    .limit(limit || 10)
    .skip(skip || 0);
};

export const getContentTypes = async (companyId: string): Promise<IContentType[]> => {
  return await ContentType.find({ companyId });
};

export const getContentType = async (
  id: string,
  companyId: string
): Promise<IContentType | null> => {
  return await ContentType.findOne({ _id: id, companyId });
};

export const createContentType = async (
  companyId: string,
  name: string,
  description: string,
  fields: any[]
): Promise<IContentType> => {
  const contentType = new ContentType({
    companyId,
    name,
    description,
    fields,
  });

  return await contentType.save();
};

export const updateContentType = async (
  id: string,
  companyId: string,
  updates: Partial<IContentType>
): Promise<IContentType | null> => {
  return await ContentType.findOneAndUpdate(
    { _id: id, companyId },
    updates,
    { new: true }
  );
};

export const deleteContentType = async (
  id: string,
  companyId: string
): Promise<boolean> => {
  const result = await ContentType.deleteOne({ _id: id, companyId });
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
