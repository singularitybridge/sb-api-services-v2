import { Assistant, IAssistant } from '../../models/Assistant';
import { File } from '../../models/File';
import mongoose from 'mongoose';
import { getApiKey } from '../api.key.service';
// OpenAI Assistant API calls removed as it's deprecated in favor of Vercel AI

export const getAssistants = async (
  companyId: string,
): Promise<IAssistant[]> => {
  try {
    const assistants = await Assistant.find({ companyId });

    // Fetch all files for these assistants in one query
    const assistantIds = assistants.map((assistant) => assistant._id);
    const files = await File.find({
      assistantId: { $in: assistantIds },
    }).select('assistantId');

    // Create a map of assistantId to hasFiles
    const assistantHasFilesMap = new Map();
    files.forEach((file) => {
      assistantHasFilesMap.set(file.assistantId.toString(), true);
    });

    // Add 'knowledge & files' to allowedActions if assistant has files
    const updatedAssistants = assistants.map((assistant) => {
      const assistantObj = assistant.toObject();
      if (assistantHasFilesMap.get(assistant._id.toString())) {
        if (!assistantObj.allowedActions.includes('knowledge.searchFiles')) {
          assistantObj.allowedActions.push('knowledge.searchFiles');
        }
      }
      return assistantObj;
    });

    return updatedAssistants;
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
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const assistant = await Assistant.findById(assistantId).session(session);
    if (!assistant) {
      throw new Error('Assistant not found');
    }

    // OpenAI synchronization removed as it's deprecated in favor of Vercel AI
    console.log(
      `Updating allowed actions for assistant ${assistantId} in local database only`,
    );

    assistant.allowedActions = allowedActions;
    const updatedAssistant = await assistant.save({ session });

    await session.commitTransaction();
    console.log(
      `Successfully updated allowed actions for assistant ${assistantId}`,
    );

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

export async function deleteAssistant(
  id: string,
  assistantId: string,
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
  apiKey: string,
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
    llmModel: 'gpt-4o',
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
