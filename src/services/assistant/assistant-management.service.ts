import { Assistant, IAssistant } from '../../models/Assistant';
import mongoose from 'mongoose';
import { getApiKey } from '../api.key.service';
import { createAssistant, deleteAssistantById, updateAssistantById } from '../oai.assistant.service';

export const getAssistants = async (companyId: string): Promise<IAssistant[]> => {
  try {
    const assistants = await Assistant.find({ companyId });
    return assistants;
  } catch (error) {
    console.error('Error retrieving assistants:', error);
    throw new Error('Error retrieving assistants');
  }
};

export const getAssistantById = async (id: string): Promise<IAssistant | null> => {
  try {
    const assistant = await Assistant.findById(id);
    return assistant;
  } catch (error) {
    console.error('Error retrieving assistant by id:', error);
    throw new Error('Error retrieving assistant by id');
  }
};

export const updateAllowedActions = async (assistantId: string, allowedActions: string[]): Promise<IAssistant | null> => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const assistant = await Assistant.findById(assistantId).session(session);
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    const adjustedAllowedActions = allowedActions.map(actionName => {
      const parts = actionName.split('.');
      return parts.length > 1 ? parts[1] : actionName;
    });

    const apiKey = await getApiKey(assistant.companyId.toString(), 'openai') as string;
    let updatedOpenAIAssistant = await updateAssistantById(
      apiKey,
      assistant.assistantId,
      assistant.name,
      assistant.description,
      assistant.llmModel,
      assistant.llmPrompt,
      adjustedAllowedActions
    );

    let updatedTools = updatedOpenAIAssistant.tools
      .filter(tool => tool.type === 'function')
      .map(tool => (tool as any).function.name);

    const updatedToolsWithPrefixes = updatedTools.map(actionName => {
      const originalAction = allowedActions.find(a => a.endsWith(actionName));
      return originalAction || actionName;
    });

    let missingActions = allowedActions.filter(action => !updatedToolsWithPrefixes.includes(action));

    if (missingActions.length > 0) {
      console.error(`Error: Failed to add the following actions: ${missingActions.join(', ')}`);
      throw new Error(`Failed to add actions: ${missingActions.join(', ')}`);
    }

    assistant.allowedActions = allowedActions;
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

export async function deleteAssistant(id: string, assistantId: string): Promise<void> {
  try {
    const assistant = await Assistant.findById(id);
    if (!assistant) {
      throw new Error('Assistant not found in local database');
    }

    await Assistant.findByIdAndDelete(id);

    try {
      const apiKey = await getApiKey(assistant.companyId.toString(), 'openai') as string;
      await deleteAssistantById(apiKey, assistantId, id);
    } catch (error) {
      console.warn(`Warning: Failed to delete assistant from OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`Successfully deleted assistant ${id} from MongoDB.`);
  } catch (error) {
    console.error('Error in deleteAssistant:', error);
    throw error;
  }
}

export const createDefaultAssistant = async (companyId: string, apiKey: string): Promise<IAssistant> => {
  const defaultAssistantData = {
    name: 'Default Assistant',
    description: 'Your company\'s default AI assistant',
    introMessage: 'Hello {{user.name}}! I\'m your default AI assistant for {{company.name}}. How can I help you today?',
    voice: 'en-US-Standard-C',
    language: 'en',
    llmModel: 'gpt-4o',
    llmPrompt: 'You are a helpful AI assistant for {{company.name}}. Your name is {{assistant.name}}. Provide friendly and professional assistance to {{user.name}}. When referring to the user, use their name {{user.name}} or their email {{user.email}}. Always include placeholders like {{user.name}} or {{company.name}} in your responses, as they will be automatically replaced with the actual values.',
    companyId: companyId,
    allowedActions: ['readJournal', 'writeJournal', 'searchInbox', 'sendEmail', 'scheduleEvent'],
  };

  const assistant = new Assistant(defaultAssistantData);
  await assistant.save();

  const openAIAssistant = await createAssistant(
    apiKey,
    companyId,
    assistant._id,
    assistant.name,
    assistant.description,
    assistant.llmModel,
    assistant.llmPrompt,
    assistant.allowedActions
  );

  assistant.assistantId = openAIAssistant.id;
  await assistant.save();

  return assistant;
};