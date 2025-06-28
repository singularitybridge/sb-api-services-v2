import { ContentType, IContentType } from '../models/ContentType';
import { Document, ModifyResult } from 'mongoose';

export const ContentTypeService = {
  async getAllContentTypes(): Promise<IContentType[]> {
    return ContentType.find().exec();
  },

  async getContentTypeById(id: string): Promise<IContentType | null> {
    return ContentType.findById(id).exec();
  },

  async createContentType(
    contentTypeData: Partial<IContentType>,
  ): Promise<IContentType> {
    const contentType = new ContentType(contentTypeData);
    return contentType.save();
  },

  async updateContentType(
    id: string,
    contentTypeData: Partial<IContentType>,
  ): Promise<IContentType | null> {
    return ContentType.findByIdAndUpdate(id, contentTypeData, {
      new: true,
    }).exec();
  },

  async deleteContentType(
    id: string,
  ): Promise<ModifyResult<
    Document<unknown, {}, IContentType> & IContentType
  > | null> {
    return ContentType.findByIdAndDelete(id).exec();
  },
};

export default ContentTypeService;
