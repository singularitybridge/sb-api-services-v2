import { ContentType, IContentType } from '../../models/ContentType';

type ValidationError = { field: string; message: string };

export const validateContentData = async (
  contentTypeId: string,
  data: any
): Promise<{ isValid: boolean; errors: ValidationError[]; contentType: IContentType | null }> => {
  const contentType = await ContentType.findById(contentTypeId);
  if (!contentType) {
    return { isValid: false, errors: [{ field: 'contentTypeId', message: 'ContentType not found' }], contentType: null };
  }

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: [{ field: 'data', message: 'Content data is missing or invalid' }], contentType };
  }

  const errors: ValidationError[] = [];

  contentType.fields.forEach(fieldDef => {
    const value = data[fieldDef.name];
    const fieldType = fieldDef.type.toLowerCase();

    if (fieldDef.required && (value === undefined || value === null)) {
      errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' is required.` });
      return;
    }

    if (value !== undefined && value !== null) {
      const typeValidators: Record<string, (v: any) => boolean> = {
        string: (v: any) => typeof v === 'string',
        number: (v: any) => typeof v === 'number',
        boolean: (v: any) => typeof v === 'boolean',
        date: (v: any) => v instanceof Date || !isNaN(Date.parse(v)),
        array: Array.isArray,
      };

      const validator = typeValidators[fieldType];
      if (validator && !validator(value)) {
        errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be a ${fieldType}.` });
      }

      if (fieldDef.enum && fieldDef.enum.length > 0 && !fieldDef.enum.includes(value)) {
        errors.push({ field: fieldDef.name, message: `Field '${fieldDef.name}' must be one of [${fieldDef.enum.join(', ')}].` });
      }
    }
  });

  return { isValid: errors.length === 0, errors, contentType };
};