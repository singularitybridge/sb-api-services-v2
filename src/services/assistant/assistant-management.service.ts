import { Assistant, IAssistant } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { Message } from '../../models/Message';
import { CostTracking } from '../../models/CostTracking';
import PromptHistory from '../../models/PromptHistory';
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

    console.log(`Cascade deleting assistant ${id} and all related data...`);

    // 1. Delete all messages for this assistant
    const messageResult = await Message.deleteMany({ assistantId: id });
    console.log(`  Deleted ${messageResult.deletedCount} messages`);

    // 2. Delete all sessions for this assistant
    const sessionResult = await Session.deleteMany({ assistantId: id });
    console.log(`  Deleted ${sessionResult.deletedCount} sessions`);

    // 3. Delete prompt history for this assistant
    const promptResult = await PromptHistory.deleteMany({ assistantId: id });
    console.log(`  Deleted ${promptResult.deletedCount} prompt history records`);

    // 4. Delete cost tracking records for this assistant
    const costResult = await CostTracking.deleteMany({ assistantId: id });
    console.log(`  Deleted ${costResult.deletedCount} cost tracking records`);

    // 5. Delete the assistant itself
    await Assistant.findByIdAndDelete(id);

    console.log(`Successfully deleted assistant ${id} and all related data.`);
  } catch (error) {
    console.error('Error in deleteAssistant:', error);
    throw error;
  }
}

export const createDefaultAssistant = async (
  companyId: string,
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
