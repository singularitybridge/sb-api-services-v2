import { IContentType } from '../../models/ContentType';
import { ContentTypeService } from '../../services/content-type.service';
import { Document, ModifyResult } from 'mongoose';

export const ContentTypeIntegrationService = {
  async getAllContentTypes(companyId: string): Promise<IContentType[]> {
    // Note: The existing service doesn't filter by companyId, so we'll need to filter the results
    const allContentTypes = await ContentTypeService.getAllContentTypes();
    return allContentTypes.filter(contentType => contentType.companyId.toString() === companyId);
  },

  async getContentTypeById(id: string, companyId: string): Promise<IContentType | null> {
    const contentType = await ContentTypeService.getContentTypeById(id);
    return contentType && contentType.companyId.toString() === companyId ? contentType : null;
  },

  async createContentType(contentTypeData: Partial<IContentType>): Promise<IContentType> {
    return ContentTypeService.createContentType(contentTypeData);
  },

  async updateContentType(id: string, companyId: string, contentTypeData: Partial<IContentType>): Promise<IContentType | null> {
    const existingContentType = await this.getContentTypeById(id, companyId);
    if (!existingContentType) {
      return null;
    }
    return ContentTypeService.updateContentType(id, contentTypeData);
  },

  async deleteContentType(id: string, companyId: string): Promise<ModifyResult<Document<unknown, {}, IContentType> & IContentType> | null> {
    const existingContentType = await this.getContentTypeById(id, companyId);
    if (!existingContentType) {
      return null;
    }
    return ContentTypeService.deleteContentType(id);
  },
};

export default ContentTypeIntegrationService;