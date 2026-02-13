/**
 * Session Query Actions
 *
 * Enables Claude Code and external tools to query session messages,
 * state, and context programmatically for testing, debugging, and
 * automation purposes.
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { logger } from '../../utils/logger';
import { Message } from '../../models/Message';
import { Session } from '../../models/Session';
import { User } from '../../models/User';
import { Company } from '../../models/Company';
import mongoose from 'mongoose';

export const createSessionQueryActions = (
  context: ActionContext,
): FunctionFactory => ({
  /**
   * Get messages from a session with filtering and pagination
   */
  getSessionMessages: {
    description:
      'Get messages from a session with optional filtering and pagination',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 50)',
        },
        offset: {
          type: 'number',
          description: 'Number of messages to skip for pagination (default: 0)',
        },
        sender: {
          type: 'string',
          enum: ['user', 'assistant', 'system', 'agent'],
          description: 'Filter by message sender',
        },
        messageType: {
          type: 'string',
          description: 'Filter by message type (e.g., "text", "tool_calls")',
        },
        includeToolCalls: {
          type: 'boolean',
          description:
            'Include tool call details in message data (default: true)',
        },
      },
      required: [],
    },
    function: async ({
      sessionId,
      limit = 50,
      offset = 0,
      sender,
      messageType,
      includeToolCalls = true,
    }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(targetSessionId)) {
          throw new Error(`Invalid session ID: ${targetSessionId}`);
        }

        // Build query
        const query: any = {
          sessionId: new mongoose.Types.ObjectId(targetSessionId),
        };

        if (sender) {
          query.sender = sender;
        }

        if (messageType) {
          query.messageType = messageType;
        }

        // Get messages
        const messages = await Message.find(query)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(Math.min(limit, 100)) // Cap at 100
          .lean();

        // Get total count
        const totalCount = await Message.countDocuments(query);

        // Format messages
        const formattedMessages = messages.reverse().map((msg: any) => ({
          id: msg._id.toString(),
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp,
          messageType: msg.messageType,
          data: includeToolCalls
            ? msg.data
            : msg.data
              ? { ...msg.data, tool_calls: undefined }
              : undefined,
        }));

        logger.info(
          `Retrieved ${formattedMessages.length} messages for session ${targetSessionId}`,
          {
            sessionId: targetSessionId,
            limit,
            offset,
            sender,
            messageType,
            totalCount,
          },
        );

        return {
          success: true,
          message: `Retrieved ${formattedMessages.length} messages`,
          data: {
            sessionId: targetSessionId,
            messages: formattedMessages,
            totalCount,
            hasMore: offset + messages.length < totalCount,
            pagination: {
              limit,
              offset,
              returned: formattedMessages.length,
            },
          },
        };
      } catch (error: any) {
        logger.error('Failed to get session messages', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get session state and metadata
   */
  getSessionState: {
    description: 'Get session state, metadata, and configuration',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
      },
      required: [],
    },
    function: async ({ sessionId }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(targetSessionId)) {
          throw new Error(`Invalid session ID: ${targetSessionId}`);
        }

        // Get session
        const session = await Session.findById(targetSessionId).lean();

        if (!session) {
          throw new Error(`Session not found: ${targetSessionId}`);
        }

        // Get message count
        const messageCount = await Message.countDocuments({
          sessionId: new mongoose.Types.ObjectId(targetSessionId),
        });

        // Get last message timestamp
        const lastMessage = await Message.findOne({
          sessionId: new mongoose.Types.ObjectId(targetSessionId),
        })
          .sort({ timestamp: -1 })
          .limit(1)
          .select('timestamp')
          .lean();

        logger.info(`Retrieved session state for ${targetSessionId}`, {
          assistantId: session.assistantId,
          messageCount,
        });

        return {
          success: true,
          message: 'Session state retrieved',
          data: {
            id: session._id.toString(),
            assistantId: session.assistantId.toString(),
            userId: session.userId.toString(),
            companyId: session.companyId.toString(),
            createdAt: session.createdAt,
            lastMessageAt: lastMessage?.timestamp,
            messageCount,
            metadata: {}, // Session model does not have metadata field
          },
        };
      } catch (error: any) {
        logger.error('Failed to get session state', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get session context including assistant details
   */
  getSessionContext: {
    description:
      'Get full session context including assistant details, user info, and workspace state',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
      },
      required: [],
    },
    function: async ({ sessionId }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(targetSessionId)) {
          throw new Error(`Invalid session ID: ${targetSessionId}`);
        }

        // Get session with populated assistant
        const session = await Session.findById(targetSessionId)
          .populate('assistantId')
          .lean();

        if (!session) {
          throw new Error(`Session not found: ${targetSessionId}`);
        }

        const assistant = session.assistantId as any;

        logger.info(`Retrieved session context for ${targetSessionId}`, {
          assistantId: assistant?._id,
          assistantName: assistant?.name,
        });

        return {
          success: true,
          message: 'Session context retrieved',
          data: {
            session: {
              id: session._id.toString(),
              createdAt: session.createdAt,
              metadata: {}, // Session model does not have metadata field
            },
            assistant: assistant
              ? {
                  id: assistant._id.toString(),
                  name: assistant.name,
                  description: assistant.description,
                  llmProvider: assistant.llmProvider,
                  llmModel: assistant.llmModel,
                  integrations: assistant.integrations || [],
                }
              : null,
            user: {
              id: session.userId.toString(),
            },
            company: {
              id: session.companyId.toString(),
            },
            currentDate: new Date().toISOString().split('T')[0],
            currentTime: new Date().toISOString().split('T')[1].substring(0, 5),
            currentDateTime: new Date().toISOString(),
          },
        };
      } catch (error: any) {
        logger.error('Failed to get session context', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get last N messages with action execution details
   */
  getLastMessagesWithActions: {
    description:
      'Get the last N messages with detailed action execution information',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
        count: {
          type: 'number',
          description: 'Number of recent messages to return (default: 10)',
        },
      },
      required: [],
    },
    function: async ({
      sessionId,
      count = 10,
    }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(targetSessionId)) {
          throw new Error(`Invalid session ID: ${targetSessionId}`);
        }

        // Get last N messages
        const messages = await Message.find({
          sessionId: new mongoose.Types.ObjectId(targetSessionId),
        })
          .sort({ timestamp: -1 })
          .limit(Math.min(count, 50))
          .lean();

        // Format with action details
        const formattedMessages = messages.reverse().map((msg: any) => {
          const toolCalls = msg.data?.tool_calls || [];
          const actions = toolCalls.map((tc: any) => ({
            id: tc.id,
            name: tc.function?.name,
            arguments: tc.function?.arguments,
          }));

          return {
            id: msg._id.toString(),
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp,
            messageType: msg.messageType,
            actions: actions.length > 0 ? actions : undefined,
          };
        });

        logger.info(
          `Retrieved last ${formattedMessages.length} messages with actions for session ${targetSessionId}`,
        );

        return {
          success: true,
          message: `Retrieved ${formattedMessages.length} messages with action details`,
          data: {
            sessionId: targetSessionId,
            messages: formattedMessages,
            count: formattedMessages.length,
          },
        };
      } catch (error: any) {
        logger.error('Failed to get last messages with actions', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get current logged-in user information
   */
  getCurrentUser: {
    description:
      'Get information about the current logged-in user including name, email, role, and organization',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult> => {
      try {
        const userId = context?.userId;

        if (!userId) {
          throw new Error('User ID not found in context');
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error(`Invalid user ID: ${userId}`);
        }

        // Get user
        const user = await User.findById(userId).lean();

        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        // Get company
        const company = await Company.findById(user.companyId).lean();

        logger.info(`Retrieved current user info for ${userId}`, {
          userName: user.name,
          companyName: company?.name,
        });

        return {
          success: true,
          message: 'Current user information retrieved',
          data: {
            user: {
              id: user._id.toString(),
              name: user.name,
              email: user.email,
              role: user.role,
            },
            organization: company
              ? {
                  id: company._id.toString(),
                  name: company.name,
                  description: company.description || '',
                }
              : null,
            session: {
              language: context.language || 'en',
            },
          },
        };
      } catch (error: any) {
        logger.error('Failed to get current user', {
          error: error.message,
          userId: context?.userId,
        });
        throw error;
      }
    },
  },

  /**
   * Get current date and time with optional timezone conversion
   */
  getDateTime: {
    description:
      'Get current date and time. Optionally specify a timezone (IANA format like "Asia/Jerusalem", "America/New_York") to get time in that timezone. Defaults to UTC if no timezone specified.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description:
            'Optional IANA timezone string (e.g., "Asia/Jerusalem", "America/New_York", "Europe/London"). If omitted, returns UTC time.',
        },
      },
      required: [],
    },
    function: async ({ timezone }: any): Promise<StandardActionResult> => {
      try {
        const now = new Date();
        const targetTimezone = timezone || 'UTC';

        // Validate timezone
        let isValidTimezone = true;
        let localTimeFormatted = '';
        let localDate = '';
        let localTime = '';

        try {
          localTimeFormatted = now.toLocaleString('en-US', {
            timeZone: targetTimezone,
            dateStyle: 'full',
            timeStyle: 'long',
          });

          localDate = now.toLocaleDateString('en-US', {
            timeZone: targetTimezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          });

          localTime = now.toLocaleTimeString('en-US', {
            timeZone: targetTimezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
        } catch (error) {
          isValidTimezone = false;
        }

        if (!isValidTimezone) {
          throw new Error(
            `Invalid timezone: ${targetTimezone}. Please use IANA timezone format (e.g., "Asia/Jerusalem", "America/New_York")`,
          );
        }

        // Get timezone offset
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: targetTimezone,
          timeZoneName: 'short',
        });
        const parts = formatter.formatToParts(now);
        const timezoneName =
          parts.find((p) => p.type === 'timeZoneName')?.value || targetTimezone;

        logger.info(`Retrieved date/time for timezone ${targetTimezone}`);

        return {
          success: true,
          message: `Current date/time retrieved for timezone ${targetTimezone}`,
          data: {
            timezone: targetTimezone,
            timezoneName: timezoneName,
            timestamp: now.getTime(),
            utc: {
              iso: now.toISOString(),
              formatted: now.toUTCString(),
            },
            local: {
              formatted: localTimeFormatted,
              date: localDate,
              time: localTime,
            },
          },
        };
      } catch (error: any) {
        logger.error('Failed to get date/time', {
          error: error.message,
          timezone,
        });
        throw error;
      }
    },
  },
});
