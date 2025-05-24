import { Assistant, IIdentifier } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { publishMessage } from '../../services/pusher.service';

export const getCurrentAssistant = async (sessionId: string): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return {
        success: false,
        description: 'Invalid session',
      };
    }

    if (!session.assistantId) {
      return {
        success: false,
        description: 'No assistant assigned to current session',
      };
    }

    const assistant = await Assistant.findById(session.assistantId);
    if (!assistant) {
      return {
        success: false,
        description: 'Assistant not found',
      };
    }

    return {
      success: true,
      description: 'Current assistant retrieved successfully',
      data: {
        _id: assistant._id,
        name: assistant.name,
        description: assistant.description,
        llmPrompt: assistant.llmPrompt,
        llmProvider: assistant.llmProvider,
        llmModel: assistant.llmModel,
        language: assistant.language,
        voice: assistant.voice,
        conversationStarters: assistant.conversationStarters,
        allowedActions: assistant.allowedActions,
        avatarImage: assistant.avatarImage,
        assistantId: assistant.assistantId,
      },
    };
  } catch (error) {
    console.error('Error getting current assistant:', error);
    return {
      success: false,
      description: 'Failed to retrieve current assistant',
    };
  }
};

export const updateCurrentAssistant = async (
  sessionId: string,
  updateData: {
    name?: string;
    description?: string;
    llmModel?: string;
    llmProvider?: 'openai' | 'google' | 'anthropic';
  }
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, description: 'Invalid session' };
    }

    if (!session.assistantId) {
      return { success: false, description: 'No assistant assigned to current session' };
    }

    const assistant = await Assistant.findById(session.assistantId);
    if (!assistant) {
      return { success: false, description: 'Assistant not found' };
    }

    // Update only the allowed fields if they are provided in updateData
    if (updateData.name !== undefined) assistant.name = updateData.name;
    if (updateData.description !== undefined) assistant.description = updateData.description;
    if (updateData.llmModel !== undefined) assistant.llmModel = updateData.llmModel;
    if (updateData.llmProvider !== undefined) assistant.llmProvider = updateData.llmProvider;
    // Ensure llmPrompt defaults to empty string if it's somehow null/undefined from DB
    // This was a previous bug fix attempt, keeping it for safety, though model now has default.
    assistant.llmPrompt = assistant.llmPrompt || ""; 


    await assistant.save();

    publishMessage(`sb-${sessionId}`, 'assistantUpdated', { // Using a more specific event name
      _id: assistant._id,
      name: assistant.name,
      description: assistant.description,
      llmModel: assistant.llmModel,
      llmProvider: assistant.llmProvider,
    });

    return {
      success: true,
      description: 'Current assistant updated successfully',
      data: {
        _id: assistant._id,
        name: assistant.name,
        description: assistant.description,
        llmModel: assistant.llmModel,
        llmProvider: assistant.llmProvider,
        // Include other relevant fields that might be useful for the client
        llmPrompt: assistant.llmPrompt, 
        language: assistant.language,
        voice: assistant.voice,
      },
    };
  } catch (error) {
    console.error('Error updating current assistant:', error);
    return {
      success: false,
      description: 'Failed to update current assistant',
    };
  }
};

export const getAssistants = async (sessionId: string): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return {
        success: false,
        description: 'Invalid session',
      };
    }
    const assistants = await Assistant.find(
      { companyId: session.companyId },
      { _id: 1, name: 1, description: 1 }
    );
    return {
      success: true,
      description: 'Assistants retrieved successfully',
      data: assistants,
    };
  } catch (error) {
    console.error('Error getting assistants:', error);
    return {
      success: false,
      description: 'Failed to retrieve assistants',
    };
  }
};

export const setAssistant = async (sessionId: string, assistantId: string): Promise<{ success: boolean; description: string }> => {
  try {
    const assistant = await Assistant.findById(assistantId);
    if (!assistant) {
      return {
        success: false,
        description: 'Assistant not found',
      };
    }
    publishMessage(`sb-${sessionId}`, 'setAssistant', { _id: assistantId });
    return {
      success: true,
      description: `Assistant set to ${assistant.name} (ID: ${assistantId})`,
    };
  } catch (error) {
    console.error('Error setting assistant:', error);
    return {
      success: false,
      description: 'Failed to set assistant',
    };
  }
};

export const createNewAssistant = async (
  sessionId: string,
  name: string,
  description: string,
  prompt: string,
  language: string,
  voice: string,
  conversationStarters: IIdentifier[] = []
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return {
        success: false,
        description: 'Invalid session',
      };
    }

    const newAssistant = new Assistant({
      name,
      description,
      prompt,
      language,
      voice,
      conversationStarters,
      companyId: session.companyId,
    });

    await newAssistant.save();

    publishMessage(`sb-${sessionId}`, 'createNewAssistant', {
      _id: newAssistant._id,
      name: newAssistant.name,
      description: newAssistant.description,
      language: newAssistant.language,
      voice: newAssistant.voice,
      conversationStarters: newAssistant.conversationStarters,
    });

    return {
      success: true,
      description: 'New assistant created successfully',
      data: {
        _id: newAssistant._id,
        name: newAssistant.name,
        description: newAssistant.description,
        language: newAssistant.language,
        voice: newAssistant.voice,
        conversationStarters: newAssistant.conversationStarters,
      },
    };
  } catch (error) {
    console.error('Error creating new assistant:', error);
    return {
      success: false,
      description: 'Failed to create new assistant',
    };
  }
};
