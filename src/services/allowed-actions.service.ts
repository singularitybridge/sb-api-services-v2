import { Assistant, IAssistant } from '../models/Assistant';
import mongoose from 'mongoose';

export const updateAllowedActions = async (assistantId: string, allowedActions: string[]): Promise<IAssistant | null> => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const assistant = await Assistant.findById(assistantId).session(session);
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // OpenAI synchronization removed as it's deprecated in favor of Vercel AI
    console.log(`Updating allowed actions for assistant ${assistantId} in local database only`);

    // Update the local database with the allowed actions
    assistant.allowedActions = allowedActions;
    const updatedAssistant = await assistant.save({ session });

    await session.commitTransaction();
    console.log(`Successfully updated allowed actions for assistant ${assistantId}`);
    
    if (allowedActions.length > 0) {
      console.log(`Successfully added actions: ${allowedActions.join(', ')}`);
    }

    return updatedAssistant;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    console.error('Error updating allowed actions:', error);
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};
