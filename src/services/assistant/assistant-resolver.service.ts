import mongoose from 'mongoose';
import { Assistant, IAssistant } from '../../models/Assistant';

/**
 * Check if a string is a valid MongoDB ObjectId
 */
const isValidObjectId = (id: string): boolean => {
  return (
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
};

/**
 * Resolve an assistant by either ID or name within a company scope
 * @param identifier - Either a MongoDB ObjectId or assistant name
 * @param companyId - The company ID to scope the search
 * @returns The assistant if found, null otherwise
 */
export const resolveAssistantIdentifier = async (
  identifier: string,
  companyId: string,
): Promise<IAssistant | null> => {
  if (!identifier || !companyId) {
    return null;
  }

  // Trim the identifier to handle any whitespace
  const trimmedIdentifier = identifier.trim();

  // If it's a valid ObjectId, try to find by ID first, then fall back to name
  if (isValidObjectId(trimmedIdentifier)) {
    // Use $or to check both ID and name in a single query
    return Assistant.findOne({
      companyId,
      $or: [
        { _id: new mongoose.Types.ObjectId(trimmedIdentifier) },
        { name: trimmedIdentifier },
      ],
    });
  }

  // If it's not an ObjectId, only search by name
  return Assistant.findOne({
    companyId,
    name: trimmedIdentifier,
  });
};

/**
 * Validate that an identifier can be used (not empty)
 */
export const validateAssistantIdentifier = (identifier: string): boolean => {
  return !!identifier && identifier.trim().length > 0;
};
