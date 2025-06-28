import { ContentType, IContentType } from '../../models/ContentType';

export const createContentType = async (
  companyId: string,
  name: string,
  description: string,
  fields: Array<{ name: string; type: string; required: boolean }>,
): Promise<IContentType> => {
  const contentType = new ContentType({
    companyId,
    name,
    description,
    fields,
  });
  return await contentType.save();
};

// Add other content type related operations here if needed
