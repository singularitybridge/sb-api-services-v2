import { Message } from '../../models/Message';
import { publishSessionMessage } from '../../services/pusher.service';
import { ExecutionDetails } from './types';
import { Session } from '../../models/Session';
import mongoose from 'mongoose';

const generateMessageId = (): string => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to truncate large output for Pusher
const truncateForPusher = (data: any, maxSize: number = 8000): any => {
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= maxSize) {
    return data;
  }
  
  // If too large, provide summary instead of full data
  if (Array.isArray(data)) {
    return {
      summary: `Large dataset with ${data.length} items (truncated for display)`,
      sample: data.slice(0, 2), // Show first 2 items as sample
      totalCount: data.length
    };
  }
  
  return {
    summary: "Large data response (truncated for display)",
    preview: jsonString.substring(0, maxSize - 100) + "... [truncated]"
  };
};

export const publishActionMessage = async (
  sessionId: string,
  status: 'started' | 'completed' | 'failed',
  executionDetails: ExecutionDetails
): Promise<void> => {
  try {
    // Get session details for assistant and thread IDs
    const session = await Session.findById(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found for action message`);
      return;
    }

    const messageData: any = {
      messageId: executionDetails.id,
      actionId: executionDetails.actionId,
      serviceName: executionDetails.serviceName,
      actionTitle: executionDetails.actionTitle,
      actionDescription: executionDetails.actionDescription,
      icon: executionDetails.icon,
      originalActionId: executionDetails.originalActionId,
      status,
      input: executionDetails.input || {}
    };

    if (status !== 'started' && executionDetails.output) {
      messageData.output = executionDetails.output;
    }

    if (status === 'failed' && executionDetails.error) {
      messageData.error = executionDetails.error;
    }

    // Save/update the message in database according to the guide format
    console.log(`Saving action message for session ${sessionId}, action ${executionDetails.actionId}, status ${status}`);
    const actionMessage = await Message.findOneAndUpdate(
      { sessionId: new mongoose.Types.ObjectId(sessionId), 'data.messageId': executionDetails.id },
      {
        $set: {
          sessionId: new mongoose.Types.ObjectId(sessionId),
          sender: 'system',
          content: `System: action_execution`,
          assistantId: session.assistantId,
          userId: session.userId,
          messageType: 'action_execution',
          data: messageData,
          timestamp: new Date()
        }
      },
      { upsert: true, new: true }
    );
    console.log(`Action message saved with ID: ${actionMessage._id}, messageType: ${actionMessage.messageType}`);

    // Create the complete message structure with truncated data for Pusher
    const truncatedMessageData = {
      ...messageData,
      output: messageData.output ? truncateForPusher(messageData.output) : messageData.output
    };

    const completeMessage = {
      id: actionMessage._id.toString(),
      role: 'system',
      content: [
        {
          type: 'text',
          text: {
            value: 'System: action_execution'
          }
        }
      ],
      created_at: Math.floor(Date.now() / 1000),
      assistant_id: session.assistantId?.toString(),
      thread_id: sessionId,
      message_type: 'action_execution',
      data: truncatedMessageData
    };

    // Publish to the correct channel and event according to the guide
    // Wrap in try-catch so Pusher errors don't affect the main flow
    try {
      console.log(`[Action Publisher] Publishing action message - sessionId: ${sessionId}, actionId: ${executionDetails.actionId}, status: ${status}, messageType: action_execution`);
      await publishSessionMessage(sessionId, 'chat_message', completeMessage);
      console.log(`[Action Publisher] Successfully published action message for ${executionDetails.actionId} with status ${status}`);
    } catch (pusherError) {
      console.error('Pusher publishing failed (non-critical):', pusherError);
      // Don't rethrow - Pusher errors shouldn't affect tool execution
    }
  } catch (error) {
    console.error('Error in publishActionMessage:', error);
    // Don't rethrow - publishing errors shouldn't affect tool execution
  }
};
