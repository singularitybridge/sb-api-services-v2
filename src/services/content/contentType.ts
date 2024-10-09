import { ContentType, IContentType } from '../../models/ContentType';

/**
 * Retrieves all content types for a given company.
 * @param companyId The ID of the company
 * @returns A promise that resolves to an array of IContentType
 */
export const getContentTypes = async (companyId: string): Promise<IContentType[]> => {
  return await ContentType.find({ companyId });
};

/**
 * Retrieves a specific content type for a given company.
 * @param id The ID of the content type
 * @param companyId The ID of the company
 * @returns A promise that resolves to an IContentType or null if not found
 */
export const getContentType = async (
  id: string,
  companyId: string
): Promise<IContentType | null> => {
  return await ContentType.findOne({ _id: id, companyId });
};

/**
 * Creates a new content type for a company.
 * @param companyId The ID of the company
 * @param name The name of the content type
 * @param description The description of the content type
 * @param fields An array of field definitions for the content type
 * @returns A promise that resolves to the created IContentType
 */
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

/**
 * Updates an existing content type for a company.
 * @param id The ID of the content type to update
 * @param companyId The ID of the company
 * @param updates Partial<IContentType> containing the fields to update
 * @returns A promise that resolves to the updated IContentType or null if not found
 */
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

/**
 * Deletes a content type for a company.
 * @param id The ID of the content type to delete
 * @param companyId The ID of the company
 * @returns A promise that resolves to a boolean indicating whether the deletion was successful
 */
export const deleteContentType = async (
  id: string,
  companyId: string
): Promise<boolean> => {
  const result = await ContentType.deleteOne({ _id: id, companyId });
  return result.deletedCount === 1;
};