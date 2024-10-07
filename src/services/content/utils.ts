/**
 * Builds a query object from a set of parameters, excluding undefined values.
 * @param params An object containing query parameters
 * @returns A new object with only defined values from the input
 */
export const buildQuery = (params: Record<string, any>): Record<string, any> => {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
};

/**
 * Builds a sort object for MongoDB queries based on the provided orderBy string.
 * @param orderBy Optional string in the format "field:order" (e.g., "createdAt:desc")
 * @returns A sort object for MongoDB queries
 */
export const buildSort = (orderBy?: string): Record<string, 1 | -1> => {
  if (orderBy) {
    const [field, order] = orderBy.split(':');
    return { [`data.${field}`]: order === 'desc' ? -1 : 1 };
  }
  return { createdAt: -1 };
};