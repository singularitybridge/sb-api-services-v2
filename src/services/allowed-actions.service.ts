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
      allowedActions
    );

    // Check which actions were successfully added to the OpenAI assistant
    const updatedTools = updatedOpenAIAssistant.tools
      .filter(tool => tool.type === 'function')
      .map(tool => (tool as any).function.name);

    // Find which actions were successfully added and which ones failed
    const successfulActions = allowedActions.filter(action => 
      updatedTools.includes(sanitizeFunctionName(action))
    );

    const failedActions = allowedActions.filter(action => 
      !updatedTools.includes(sanitizeFunctionName(action))
    );

    // Log warnings for failed actions but continue processing
    if (failedActions.length > 0) {
      console.warn(`Warning: The following actions were not successfully added to the OpenAI assistant: ${failedActions.join(', ')}`);
    }

    // Update the local database with only the successful actions
    assistant.allowedActions = successfulActions;
    const updatedAssistant = await assistant.save({ session });

    await session.commitTransaction();
    console.log(`Successfully updated allowed actions for assistant ${assistantId}`);
    
    if (successfulActions.length > 0) {
      console.log(`Successfully added actions: ${successfulActions.join(', ')}`);
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
