import { ContentItem, IContentItem } from '../models/ContentItem';

export const createContentItem = async (companyId: string, data: any): Promise<IContentItem> => {
  const contentItem = new ContentItem({ ...data, companyId });
  return await contentItem.save();
};

export const getContentItems = async (companyId: string): Promise<IContentItem[]> => {
  return await ContentItem.find({ companyId });
};

export const getContentItem = async (companyId: string, itemId: string): Promise<IContentItem | null> => {
  return await ContentItem.findOne({ _id: itemId, companyId });
};

export const updateContentItem = async (
  companyId: string,
  itemId: string,
  updateData: any
): Promise<IContentItem | null> => {
  return await ContentItem.findOneAndUpdate({ _id: itemId, companyId }, updateData, { new: true });
};

export const deleteContentItem = async (companyId: string, itemId: string): Promise<void> => {
  await ContentItem.findOneAndDelete({ _id: itemId, companyId });
};