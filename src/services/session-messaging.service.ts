/**
 * Session Messaging Service
 *
 * Provides session-scoped real-time messaging via Socket.IO.
 * Replaces Pusher for all session-based messaging (chat messages, assistant events).
 */

import { emitToSession } from './websocket';
import { logger } from '../utils/logger';

const MAX_MESSAGE_SIZE = 10 * 1024; // 10KB to match Pusher behavior

/**
 * Truncate large data for real-time messaging
 * Matches the truncation logic from the original Pusher implementation
 */
const truncateForMessaging = (data: any, maxSize: number = 4000): any => {
  // Handle arrays
  if (Array.isArray(data)) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length <= maxSize) {
      return data;
    }
    return {
      summary: `Large dataset with ${data.length} items (truncated for display)`,
      sample: data.slice(0, 2),
      totalCount: data.length,
      _isTruncatedList: true,
    };
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const originalJsonString = JSON.stringify(data);
    if (originalJsonString.length <= maxSize) {
      return data;
    }

    // Check for nested data arrays
    if (data.hasOwnProperty('data') && Array.isArray(data.data)) {
      const tempData = { ...data };
      delete tempData.data;
      const shellSize = JSON.stringify(tempData).length;
      const remainingSizeForArrayRepresentation = maxSize - shellSize - 150;

      if (remainingSizeForArrayRepresentation > 0) {
        const truncatedInnerArraySummary = truncateForMessaging(
          data.data,
          remainingSizeForArrayRepresentation,
        );

        const reconstructedData = {
          ...data,
          data: truncatedInnerArraySummary,
          _isTruncatedOutput: true,
        };

        if (JSON.stringify(reconstructedData).length <= maxSize) {
          return reconstructedData;
        }
      }
    }

    // Generic object truncation
    return {
      summary: 'Large data response (object truncated for display)',
      preview:
        originalJsonString.substring(0, maxSize - 200) + '... [truncated]',
      _isTruncatedObject: true,
    };
  }

  // Primitive types
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= maxSize) {
    return data;
  }
  return jsonString.substring(0, maxSize - 50) + '...[truncated]';
};

/**
 * Publish a message to a session channel via Socket.IO
 * Direct replacement for publishSessionMessage from pusher.service.ts
 */
export const publishSessionMessage = async (
  sessionId: string,
  eventName: string,
  message: Record<string, unknown>,
): Promise<void> => {
  try {
    const messageStr = JSON.stringify(message);

    if (messageStr.length > MAX_MESSAGE_SIZE) {
      logger.warn(
        `[SessionMessaging] Message size (${messageStr.length} bytes) exceeds ${MAX_MESSAGE_SIZE} bytes, truncating`,
      );
      // Truncate the message to fit within limits
      const truncatedMessage = truncateForMessaging(
        message,
        MAX_MESSAGE_SIZE - 1024,
      );
      emitToSession(sessionId, eventName, truncatedMessage);
    } else {
      emitToSession(sessionId, eventName, message);
    }
  } catch (error: any) {
    logger.error('[SessionMessaging] Error publishing message:', {
      error: error?.message || error,
      sessionId,
      eventName,
      messageSize: JSON.stringify(message).length,
    });
    // Don't throw - messaging errors shouldn't affect main flow
  }
};

/**
 * Publish a message to a specific channel (for non-session channels)
 * Direct replacement for publishMessage from pusher.service.ts
 */
export const publishMessage = async (
  channel: string,
  eventName: string,
  message: Record<string, unknown>,
): Promise<void> => {
  // Extract sessionId from channel (format: sb-{sessionId})
  if (channel.startsWith('sb-')) {
    const sessionId = channel.substring(3);
    return publishSessionMessage(sessionId, eventName, message);
  }

  // For non-session channels, log a warning as this shouldn't happen
  logger.warn(
    `[SessionMessaging] Non-session channel used: ${channel}. This may need special handling.`,
  );
};
