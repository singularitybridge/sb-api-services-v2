import { Assistant, IIdentifier, IAssistant } from '../../models/Assistant';
import { Session } from '../../models/Session';
import { Team, ITeam } from '../../models/Team';
import { publishMessage } from '../../services/pusher.service';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export const getCurrentAssistant = async (
  sessionId: string,
): Promise<{ success: boolean; description: string; data?: any }> => {
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

export const getAssistantById = async (
  sessionId: string,
  assistantId: string,
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, description: 'Invalid session' };
    }

    if (!mongoose.Types.ObjectId.isValid(assistantId)) {
      return { success: false, description: 'Invalid assistantId format' };
    }

    const assistant = await Assistant.findById(assistantId);
    if (!assistant) {
      return { success: false, description: 'Assistant not found' };
    }

    // Verify the assistant belongs to the same company as the session
    if (assistant.companyId.toString() !== session.companyId.toString()) {
      return {
        success: false,
        description:
          'Access denied. Assistant does not belong to this company.',
      };
    }

    return {
      success: true,
      description: 'Assistant retrieved successfully',
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
    console.error(`Error getting assistant ${assistantId}:`, error);
    return {
      success: false,
      description: `Failed to retrieve assistant ${assistantId}`,
    };
  }
};

export const updateAssistantById = async (
  sessionId: string,
  assistantId: string,
  updateData: {
    name?: string;
    description?: string;
    llmModel?: string;
    llmProvider?: 'openai' | 'google' | 'anthropic';
    llmPrompt?: string;
  },
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, description: 'Invalid session' };
    }

    if (!mongoose.Types.ObjectId.isValid(assistantId)) {
      return { success: false, description: 'Invalid assistantId format' };
    }

    const assistant = await Assistant.findById(assistantId);
    if (!assistant) {
      return { success: false, description: 'Assistant not found' };
    }

    // Verify the assistant belongs to the same company as the session
    if (assistant.companyId.toString() !== session.companyId.toString()) {
      return {
        success: false,
        description:
          'Access denied. Assistant does not belong to this company.',
      };
    }

    // Update only the allowed fields if they are provided in updateData
    if (updateData.name !== undefined) assistant.name = updateData.name;
    if (updateData.description !== undefined)
      assistant.description = updateData.description;
    if (updateData.llmModel !== undefined)
      assistant.llmModel = updateData.llmModel;
    if (updateData.llmProvider !== undefined)
      assistant.llmProvider = updateData.llmProvider;
    if (updateData.llmPrompt !== undefined)
      assistant.llmPrompt = updateData.llmPrompt; // Added llmPrompt update

    // Ensure llmPrompt defaults to empty string if it's somehow null/undefined from DB
    // This was a previous bug fix attempt, keeping it for safety, though model now has default.
    // This line is actually redundant if llmPrompt is updated above and the model has a default.
    // However, if updateData.llmPrompt is explicitly set to null/undefined, this would catch it.
    // For clarity, if llmPrompt is part of updateData, it should take precedence.
    // The model default handles the case where it's never set.
    // If an explicit update to null/undefined is not desired, add a check:
    // if (updateData.llmPrompt !== undefined) assistant.llmPrompt = updateData.llmPrompt;
    // else assistant.llmPrompt = assistant.llmPrompt || "";
    // For now, direct assignment is fine as per request.

    await assistant.save();

    publishMessage(`sb-${sessionId}`, 'assistantUpdated', {
      _id: assistant._id,
      assistantId: assistant._id.toString(), // Explicitly include assistantId
      name: assistant.name,
      description: assistant.description,
      llmModel: assistant.llmModel,
      llmProvider: assistant.llmProvider,
      llmPrompt: assistant.llmPrompt, // Added llmPrompt to published message
    });

    return {
      success: true,
      description: `Assistant ${assistantId} updated successfully`,
      data: {
        _id: assistant._id,
        name: assistant.name,
        description: assistant.description,
        llmModel: assistant.llmModel,
        llmProvider: assistant.llmProvider,
        llmPrompt: assistant.llmPrompt, // Return updated llmPrompt
        language: assistant.language,
        voice: assistant.voice,
      },
    };
  } catch (error) {
    console.error(`Error updating assistant ${assistantId}:`, error);
    return {
      success: false,
      description: `Failed to update assistant ${assistantId}`,
    };
  }
};

export const getAssistants = async (
  sessionId: string,
  companyId?: string,
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    let effectiveCompanyId = companyId;

    if (sessionId !== 'stateless_execution') {
      const session = await Session.findById(sessionId);
      if (!session) {
        return {
          success: false,
          description: 'Invalid session',
        };
      }
      effectiveCompanyId = session.companyId.toString();
    }

    if (!effectiveCompanyId) {
      return {
        success: false,
        description: 'Company ID is required for stateless execution.',
      };
    }

    const assistants = await Assistant.find(
      { companyId: effectiveCompanyId },
      { _id: 1, name: 1, description: 1 },
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

export const setAssistant = async (
  sessionId: string,
  assistantId: string,
): Promise<{ success: boolean; description: string }> => {
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
  conversationStarters: IIdentifier[] = [],
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

export const askAnotherAssistant = async (
  sessionId: string,
  targetAssistantId: string,
  task: string,
  companyId?: string,
  userId?: string,
): Promise<{ success: boolean; description: string; data?: any }> => {
  try {
    let session;
    let effectiveCompanyId = companyId;
    let effectiveUserId = userId;

    if (sessionId !== 'stateless_execution') {
      session = await Session.findById(sessionId).populate('userId');
      if (!session) {
        return {
          success: false,
          description: 'Invalid session',
        };
      }
      effectiveCompanyId = session.companyId.toString();
      if (session.userId && typeof session.userId === 'object') {
        effectiveUserId = (session.userId as any)._id.toString();
      }
    }

    if (!effectiveCompanyId) {
      return {
        success: false,
        description: 'Company ID is required for stateless execution.',
      };
    }

    // Validate the targetAssistantId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(targetAssistantId)) {
      return {
        success: false,
        description: `Invalid assistantId: ${targetAssistantId}. Must be a valid ObjectId.`,
      };
    }

    // Verify the target assistant exists and belongs to the same company
    const targetAssistant = await Assistant.findOne({
      _id: targetAssistantId,
      companyId: effectiveCompanyId,
    });

    if (!targetAssistant) {
      return {
        success: false,
        description: 'Target assistant not found or access denied',
      };
    }

    // Generate a JWT token for authentication
    let authToken;
    if (process.env.JWT_SECRET && effectiveUserId && effectiveCompanyId) {
      const tokenPayload = {
        userId: effectiveUserId,
        companyId: effectiveCompanyId,
      };
      authToken = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    } else {
      console.warn(
        '[askAnotherAssistant] Unable to generate JWT token, missing JWT_SECRET or user/company information. Falling back to INTERNAL_API_TOKEN or default.',
      );
      if (!process.env.INTERNAL_API_TOKEN) {
        console.warn(
          '[askAnotherAssistant] INTERNAL_API_TOKEN environment variable not set. Using default "internal" token. This may not be secure or intended for production.',
        );
      }
      authToken = process.env.INTERNAL_API_TOKEN || 'internal';
    }

    // Make HTTP request to the assistant execute endpoint
    const executeUrl = `http://localhost:3000/assistant/${targetAssistantId}/execute`;

    const requestBody = {
      userInput: task,
      responseFormat: { type: 'json_object' },
    };

    console.log(
      `[askAnotherAssistant] Making request to ${executeUrl} with task: ${task}`,
    );

    const response = await axios.post(executeUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      timeout: 30000, // 30 second timeout
    });

    // Parse the response based on the expected format
    const responseData = response.data;

    if (responseData.message_type === 'json' && responseData.data?.json) {
      return {
        success: true,
        description: `Successfully received response from assistant "${targetAssistant.name}"`,
        data: {
          assistantId: targetAssistantId,
          assistantName: targetAssistant.name,
          response: responseData.data.json,
          messageId: responseData.id,
          originalTask: task,
        },
      };
    } else {
      // Handle text responses or other formats
      const textResponse =
        responseData.content?.[0]?.text?.value ||
        responseData.content ||
        responseData;

      return {
        success: true,
        description: `Successfully received response from assistant "${targetAssistant.name}"`,
        data: {
          assistantId: targetAssistantId,
          assistantName: targetAssistant.name,
          response: textResponse,
          messageId: responseData.id,
          originalTask: task,
        },
      };
    }
  } catch (error: any) {
    console.error('Error asking another assistant:', error);

    if (error.response) {
      // HTTP error response
      return {
        success: false,
        description: `HTTP error ${error.response.status}: ${
          error.response.data?.error || error.response.statusText
        }`,
      };
    } else if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        description:
          'Could not connect to assistant service. Make sure the service is running.',
      };
    } else if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        description:
          'Request to assistant timed out. The assistant may be taking too long to respond.',
      };
    } else {
      return {
        success: false,
        description: `Failed to communicate with assistant: ${error.message}`,
      };
    }
  }
};

export const getTeams = async (
  sessionId: string,
  companyId?: string,
): Promise<{ success: boolean; description: string; data: ITeam[] }> => {
  try {
    let effectiveCompanyId = companyId;

    if (sessionId !== 'stateless_execution') {
      const session = await Session.findById(sessionId);
      if (!session) {
        // Throw error to be caught by executeAction or higher level handler
        throw new Error('Invalid session');
      }
      effectiveCompanyId = session.companyId.toString();
    }

    if (!effectiveCompanyId) {
      throw new Error('Company ID is required for stateless execution.');
    }

    const teams = await Team.find(
      { companyId: effectiveCompanyId },
      { _id: 1, name: 1, description: 1, icon: 1 },
    );
    // Team.find returns ITeam[] (empty if none). This is correct.
    // If teams is somehow null/undefined (should not happen with Mongoose find), default to empty array.
    return {
      success: true,
      description: 'Teams retrieved successfully.',
      data: teams || [],
    };
  } catch (error: any) {
    console.error('Error getting teams:', error);
    // Re-throw for executeAction to handle and package into StandardActionResult.error
    // This ensures that the action layer gets a proper error if something goes wrong.
    throw new Error(
      `Failed to retrieve teams: ${error.message || 'Unknown error'}`,
    );
  }
};

export const getAssistantsByTeam = async (
  sessionId: string,
  teamId: string,
  lean: boolean = true,
  companyId?: string,
): Promise<{
  success: boolean;
  description: string;
  data: Partial<IAssistant>[] | IAssistant[];
}> => {
  try {
    let effectiveCompanyId = companyId;

    if (sessionId !== 'stateless_execution') {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      effectiveCompanyId = session.companyId.toString();
    }

    if (!effectiveCompanyId) {
      throw new Error('Company ID is required for stateless execution.');
    }

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      throw new Error('Invalid teamId format');
    }

    const team = await Team.findOne({
      _id: teamId,
      companyId: effectiveCompanyId,
    });
    if (!team) {
      // If team not found, it implies no assistants can be found for it under this company.
      // Return success with empty data, or throw error if that's preferred for "not found"
      // For consistency with how Team.find would return [], let's return empty data.
      // However, the original code threw 'Team not found or access denied'.
      // Let's stick to throwing an error if the team itself isn't found or accessible.
      throw new Error('Team not found or access denied');
    }

    const projection = lean
      ? { _id: 1, name: 1, description: 1, avatarImage: 1 }
      : {};
    const assistants = await Assistant.find(
      { companyId: effectiveCompanyId, teams: teamId },
      projection,
    );
    // Assistant.find returns IAssistant[] (empty if none). This is correct.
    return {
      success: true,
      description: 'Assistants for team retrieved successfully.',
      data: assistants || [], // Ensure data is an array
    };
  } catch (error: any) {
    console.error('Error getting assistants by team:', error);
    // Re-throw for executeAction to handle
    throw new Error(
      `Failed to retrieve assistants by team: ${
        error.message || 'Unknown error'
      }`,
    );
  }
};
