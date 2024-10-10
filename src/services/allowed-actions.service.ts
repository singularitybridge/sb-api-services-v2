import { Assistant, IAssistant } from '../models/Assistant';
import mongoose from 'mongoose';
import { getApiKey } from './api.key.service';
import { updateAssistantById } from './oai.assistant.service';
import { sanitizeFunctionName } from '../integrations/actions/factory';

export const updateAllowedActions = async (assistantId: string, allowedActions: string[]): Promise<IAssistant | null> => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const assistant = await Assistant.findById(assistantId).session(session);
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // Update the OpenAI assistant first
    const apiKey = await getApiKey(assistant.companyId.toString(), 'openai') as string;

    let updatedOpenAIAssistant = await updateAssistantById(
      apiKey,
      assistant.assistantId,
      assistant.name,
      assistant.description,
      assistant.llmModel,
      assistant.llmPrompt,
      allowedActions // Pass the original allowedActions without modification
    );

    // Check if all allowed actions were successfully added to the OpenAI assistant
    let updatedTools = updatedOpenAIAssistant.tools
      .filter(tool => tool.type === 'function')
      .map(tool => (tool as any).function.name);

    let missingActions = allowedActions.filter(action => 
      !updatedTools.includes(sanitizeFunctionName(action))
    );

    if (missingActions.length > 0) {
      console.error(`Error: Failed to add the following actions: ${missingActions.join(', ')}`);
      throw new Error(`Failed to add actions: ${missingActions.join(', ')}`);
    }

    // Update the local database only if OpenAI update was successful
    assistant.allowedActions = allowedActions; // Store original action names
    const updatedAssistant = await assistant.save({ session });

    await session.commitTransaction();
    console.log(`Successfully updated allowed actions for assistant ${assistantId}`);

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
