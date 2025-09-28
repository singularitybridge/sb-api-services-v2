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
 * Resolve an assistant by either ID, name, or URL within a company scope
 * @param identifier - Either a MongoDB ObjectId, assistant name, or URL-like format
 * @param companyId - The company ID to scope the search (optional)
 * @returns The assistant if found, null otherwise
 */
export const resolveAssistantIdentifier = async (
  identifier: string,
  companyId?: string,
): Promise<IAssistant | null> => {
  if (!identifier) {
    return null;
  }

  // Trim the identifier to handle any whitespace
  const trimmedIdentifier = identifier.trim();

  // Extract name from URL if it looks like a URL (contains '/' or '.')
  const isUrl =
    trimmedIdentifier.includes('/') || trimmedIdentifier.includes('.');
  let searchIdentifier = trimmedIdentifier;

  if (isUrl) {
    // Extract potential name from URL (e.g., "agents/anat" -> "anat")
    searchIdentifier =
      trimmedIdentifier.split('/').pop()?.replace(/[-_]/g, ' ') ||
      trimmedIdentifier;
  }

  // Build query based on whether companyId is provided
  const baseQuery = companyId ? { companyId } : {};

  // If it's a valid ObjectId, try to find by ID first
  if (isValidObjectId(trimmedIdentifier)) {
    const byId = await Assistant.findOne({
      ...baseQuery,
      _id: new mongoose.Types.ObjectId(trimmedIdentifier),
    });
    if (byId) return byId;
  }

  // Build OR conditions for name matching (exact, case-insensitive, and URL-extracted)
  const nameConditions = [
    { name: trimmedIdentifier }, // Exact match
    { name: new RegExp(`^${trimmedIdentifier}$`, 'i') }, // Case-insensitive exact
  ];

  // If we extracted a name from URL, also search for that
  if (isUrl && searchIdentifier !== trimmedIdentifier) {
    nameConditions.push(
      { name: searchIdentifier }, // Extracted name exact
      { name: new RegExp(`^${searchIdentifier}$`, 'i') }, // Extracted name case-insensitive
    );
  }

  // Search by name variations
  return Assistant.findOne({
    ...baseQuery,
    $or: nameConditions,
  });
};

/**
 * Validate that an identifier can be used (not empty)
 */
export const validateAssistantIdentifier = (identifier: string): boolean => {
  return !!identifier && identifier.trim().length > 0;
};
