import { Assistant, IAssistant } from '../../models/Assistant';
import mongoose from 'mongoose';
// OpenAI Assistant API calls removed as it's deprecated in favor of Vercel AI

export const getAssistants = async (
  companyId: string,
): Promise<IAssistant[]> => {
  try {
    const assistants = await Assistant.find({ companyId });
    return assistants.map((assistant) => assistant.toObject());
  } catch (error) {
    console.error('Error retrieving assistants:', error);
    throw new Error('Error retrieving assistants');
  }
};

export const getAssistantById = async (
  id: string,
): Promise<IAssistant | null> => {
  try {
    const assistant = await Assistant.findById(id);
    return assistant;
  } catch (error) {
    console.error('Error retrieving assistant by id:', error);
    throw new Error('Error retrieving assistant by id');
  }
};

export const updateAllowedActions = async (
  assistantId: string,
  allowedActions: string[],
): Promise<IAssistant | null> => {
  try {
    const assistant = await Assistant.findById(assistantId);
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // OpenAI synchronization removed as it's deprecated in favor of Vercel AI
    console.log(
      `Updating allowed actions for assistant ${assistantId} in local database only`,
    );

    assistant.allowedActions = allowedActions;
    const updatedAssistant = await assistant.save();

    console.log(
      `Successfully updated allowed actions for assistant ${assistantId}`,
    );

    return updatedAssistant;
  } catch (error) {
    console.error('Error updating allowed actions:', error);
    throw error;
  }
};

export async function deleteAssistant(
  id: string,
  _assistantId: string,
): Promise<void> {
  try {
    const assistant = await Assistant.findById(id);
    if (!assistant) {
      throw new Error('Assistant not found in local database');
    }

    await Assistant.findByIdAndDelete(id);

    // OpenAI deletion removed as it's deprecated in favor of Vercel AI
    console.log(`Successfully deleted assistant ${id} from MongoDB only.`);
  } catch (error) {
    console.error('Error in deleteAssistant:', error);
    throw error;
  }
}

export const createDefaultAssistant = async (
  companyId: string,
  _apiKey: string,
): Promise<IAssistant> => {
  const defaultAssistantData = {
    name: 'Default Assistant',
    description: "Your company's default AI assistant",
    conversationStarters: [
      {
        key: 'Welcome',
        value:
          "Hello {{user.name}}! I'm your default AI assistant for {{company.name}}. How can I help you today?",
      },
    ],
    voice: 'en-US-Standard-C',
    language: 'en',
    llmModel: 'gpt-5.1',
    llmPrompt:
      'You are a helpful AI assistant for {{company.name}}. Your name is {{assistant.name}}. Provide friendly and professional assistance to {{user.name}}. When referring to the user, use their name {{user.name}} or their email {{user.email}}. Always include placeholders like {{user.name}} or {{company.name}} in your responses, as they will be automatically replaced with the actual values.',
    companyId: companyId,
    allowedActions: [
      'readJournal',
      'writeJournal',
      'searchInbox',
      'sendEmail',
      'scheduleEvent',
    ],
    // Generate a unique ID for assistantId instead of getting it from OpenAI
    assistantId: new mongoose.Types.ObjectId().toString(),
  };

  const assistant = new Assistant(defaultAssistantData);
  await assistant.save();

  // OpenAI assistant creation removed as it's deprecated in favor of Vercel AI
  console.log(
    `Created default assistant in local database only with ID: ${assistant._id}`,
  );

  return assistant;
};
