import { Message } from '../../models/Message';
import { publishSessionMessage } from '../../services/session-messaging.service';
import { ExecutionDetails } from './types';
import { Session } from '../../models/Session';
import mongoose from 'mongoose';

const generateMessageId = (): string => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to truncate large output for Pusher
// Pusher has a 10KB (10240 bytes) limit per message
// We use 4000 to leave room for message envelope, metadata, and UTF-8 encoding
const truncateForPusher = (data: any, maxSize: number = 4000): any => {
  // First, handle the case where data itself is an array (e.g. direct array output)
  if (Array.isArray(data)) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length <= maxSize) {
      return data;
    }
    return {
      summary: `Large dataset with ${data.length} items (truncated for display)`,
      sample: data.slice(0, 2),
      totalCount: data.length,
      _isTruncatedList: true, // Flag to help UI
    };
  }

  // Handle objects, especially those that might contain a 'data' property that is an array
  if (typeof data === 'object' && data !== null) {
    const originalJsonString = JSON.stringify(data);
    if (originalJsonString.length <= maxSize) {
      return data;
    }

    // Check if the object has a 'data' property that is an array and is the main cause of largeness
    // This specifically targets the structure { success: boolean, data: array, ... }
    if (data.hasOwnProperty('data') && Array.isArray(data.data)) {
      // Create a shell object without the large array to estimate its size
      const tempData = { ...data };
      delete tempData.data; // Remove the large array temporarily
      const shellSize = JSON.stringify(tempData).length;

      // Calculate remaining size budget for the array's representation (summary/sample)
      // Subtract a bit more for safety margin (e.g., for keys of the summary object itself)
      const remainingSizeForArrayRepresentation = maxSize - shellSize - 150;

      if (remainingSizeForArrayRepresentation > 0) {
        // Recursively call truncateForPusher for the inner array with the calculated budget
        const truncatedInnerArraySummary = truncateForPusher(
          data.data,
          remainingSizeForArrayRepresentation,
        );

        // Reconstruct the object with the truncated array part
        const reconstructedData = {
          ...data, // Keep other properties of the original object (like 'success')
          data: truncatedInnerArraySummary, // Replace original array with its summary/truncated version
          _isTruncatedOutput: true, // Flag to help UI understand this object's 'data' field is modified
        };

        // Final check if the reconstructed object is within limits
        if (JSON.stringify(reconstructedData).length <= maxSize) {
          return reconstructedData;
        }
      }
    }

    // If not an array itself, and doesn't have a primary 'data' array that could be separately truncated,
    // or if the above specific truncation didn't fit.
    // Fallback to generic object truncation based on its stringified form.
    return {
      summary: 'Large data response (object truncated for display)',
      preview:
        originalJsonString.substring(0, maxSize - 200) + '... [truncated]', // Adjusted substring length
      _isTruncatedObject: true, // Flag to help UI
    };
  }

  // For primitive types or anything else, just stringify and check length
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= maxSize) {
    return data;
  }
  // Generic truncation for other types (e.g. long strings)
  return jsonString.substring(0, maxSize - 50) + '...[truncated]';
};

export const publishActionMessage = async (
  sessionId: string,
  status: 'started' | 'completed' | 'failed',
  executionDetails: ExecutionDetails,
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
      input: executionDetails.input || {},
    };

    if (status !== 'started' && executionDetails.output) {
      messageData.output = executionDetails.output;
    }

    if (status === 'failed' && executionDetails.error) {
      messageData.error = executionDetails.error;
    }

    // Save/update the message in database according to the guide format
    console.log(
      `Saving action message for session ${sessionId}, action ${executionDetails.actionId}, status ${status}`,
    );
    const actionMessage = await Message.findOneAndUpdate(
      {
        sessionId: new mongoose.Types.ObjectId(sessionId),
        'data.messageId': executionDetails.id,
      },
      {
        $set: {
          sessionId: new mongoose.Types.ObjectId(sessionId),
          sender: 'system',
          content: `System: action_execution`,
          assistantId: session.assistantId,
          userId: session.userId,
          messageType: 'action_execution',
          data: messageData,
          timestamp: new Date(),
        },
      },
      { upsert: true, new: true },
    );
    console.log(
      `Action message saved with ID: ${actionMessage._id}, messageType: ${actionMessage.messageType}`,
    );

    // Create the complete message structure with truncated data for Pusher
    // Also truncate input if it's too large
    const truncatedMessageData = {
      ...messageData,
      input: messageData.input
        ? truncateForPusher(messageData.input, 2000) // Smaller limit for input
        : messageData.input,
      output: messageData.output
        ? truncateForPusher(messageData.output, 3000)
        : messageData.output,
      error: messageData.error
        ? truncateForPusher(messageData.error, 2000)
        : messageData.error, // Truncate error object as well
    };

    const completeMessage = {
      id: actionMessage._id.toString(),
      role: 'system',
      content: [
        {
          type: 'text',
          text: {
            value: 'System: action_execution',
          },
        },
      ],
      created_at: Math.floor(Date.now() / 1000),
      assistant_id: session.assistantId?.toString(),
      thread_id: sessionId,
      message_type: 'action_execution',
      data: truncatedMessageData,
    };

    // Check final message size before sending to Pusher
    const messageSize = JSON.stringify(completeMessage).length;
    if (messageSize > 10240) {
      console.warn(
        `[Action Publisher] Message too large even after truncation (${messageSize} bytes). Further reducing content...`,
      );
      // Aggressively truncate for oversized messages
      truncatedMessageData.input = truncateForPusher(messageData.input, 500);
      truncatedMessageData.output = truncateForPusher(messageData.output, 1000);
      truncatedMessageData.error = truncateForPusher(messageData.error, 500);
    }

    // Publish to the correct channel and event according to the guide
    // Wrap in try-catch so Pusher errors don't affect the main flow
    try {
      console.log(
        `[Action Publisher] Publishing action message - sessionId: ${sessionId}, actionId: ${executionDetails.actionId}, status: ${status}, messageType: action_execution`,
      );
      await publishSessionMessage(sessionId, 'chat_message', completeMessage);
      // console.log(`[Action Publisher] Successfully published action message for ${executionDetails.actionId} with status ${status}`);
    } catch (pusherError: any) {
      console.error('Pusher publishing failed (non-critical):', pusherError);
      // Log more details about the error
      if (pusherError?.status === 413) {
        console.error(
          `Pusher payload too large. Message size: ${JSON.stringify(completeMessage).length} bytes`,
        );
      }
      // Don't rethrow - Pusher errors shouldn't affect tool execution
    }
  } catch (error) {
    console.error('Error in publishActionMessage:', error);
    // Don't rethrow - publishing errors shouldn't affect tool execution
  }
};
