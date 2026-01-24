import mongoose from 'mongoose';
import { Session, ISession } from '../../models/Session';

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
 * Resolve and validate a session belongs to a specific company
 * @param sessionId - The session ID to validate
 * @param companyId - The company ID that should own the session
 * @returns The session if found and owned by company, null otherwise
 */
export const resolveSessionWithCompany = async (
  sessionId: string,
  companyId: string,
): Promise<ISession | null> => {
  if (!sessionId || !companyId) {
    return null;
  }

  // Validate sessionId format
  if (!isValidObjectId(sessionId)) {
    return null;
  }

  // Find session and verify it belongs to the company
  const session = await Session.findOne({
    _id: new mongoose.Types.ObjectId(sessionId),
    companyId: companyId,
  });

  return session;
};

/**
 * Validate that a session exists and belongs to the authenticated company
 * Throws an error if validation fails
 * @param sessionId - The session ID to validate
 * @param companyId - The authenticated company ID
 */
export const validateSessionOwnership = async (
  sessionId: string,
  companyId: string,
): Promise<void> => {
  const session = await resolveSessionWithCompany(sessionId, companyId);

  if (!session) {
    throw new Error(`Session not found or access denied: ${sessionId}`);
  }
};
