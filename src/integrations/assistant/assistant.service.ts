import { Assistant } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { publishMessage } from '../../services/pusher.service';

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

export const createNewAssistant = async (sessionId: string, name: string, description: string, prompt: string): Promise<{ success: boolean; description: string; data?: any }> => {
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
      companyId: session.companyId,
    });

    await newAssistant.save();

    publishMessage(`sb-${sessionId}`, 'createNewAssistant', {
      _id: newAssistant._id,
      name: newAssistant.name,
      description: newAssistant.description,
    });

    return {
      success: true,
      description: 'New assistant created successfully',
      data: {
        _id: newAssistant._id,
        name: newAssistant.name,
        description: newAssistant.description,
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