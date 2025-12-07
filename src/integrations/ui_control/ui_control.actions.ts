/**
 * UI Control Actions - Phase 2
 *
 * Enables Claude Code and external tools to control the Agent Hub UI
 * via WebSocket commands. Provides bidirectional communication for
 * navigation, file operations, and notifications.
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { logger } from '../../utils/logger';
import { emitToUser } from '../../services/websocket';
import { uiSessionStateService } from '../../services/ui-session-state.service';

export const createUIControlActions = (
  context: ActionContext,
): FunctionFactory => ({
  /**
   * Navigate to a specific page/route in the UI
   */
  navigateToPage: {
    description: 'Navigate the user to a specific page or route in the UI',
    parameters: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description:
            'Route to navigate to (e.g., "/admin/assistants", "/admin/costs", "/screenshare/workspace")',
        },
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
      },
      required: ['route'],
    },
    function: async ({
      route,
      sessionId,
    }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error(
            'Session ID is required (provide sessionId or execute within a session context)',
          );
        }

        // Get UI state to find the user
        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState) {
          throw new Error(
            `No active UI session found for session ${targetSessionId}. User may not be connected.`,
          );
        }

        // Send navigation command via WebSocket
        emitToUser(uiState.userId, 'ui-command:navigate', {
          route,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Sent navigation command to user ${uiState.userId} for session ${targetSessionId}`,
          {
            route,
          },
        );

        return {
          success: true,
          message: `Navigation command sent: ${route}`,
          data: {
            sessionId: targetSessionId,
            userId: uiState.userId,
            route,
            sent: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to send navigation command', {
          error: error.message,
          route,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Open a specific workspace file in the UI
   */
  openWorkspaceFile: {
    description: 'Open a specific file in the workspace view',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Workspace file path (e.g., "/docs/feature.mdx")',
        },
        assistantId: {
          type: 'string',
          description:
            'Assistant ID whose workspace to open (optional - uses current assistant if omitted)',
        },
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
      },
      required: ['path'],
    },
    function: async ({
      path,
      assistantId,
      sessionId,
    }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState) {
          throw new Error(
            `No active UI session found for session ${targetSessionId}. User may not be connected.`,
          );
        }

        // Use provided assistantId or current one from UI state
        const targetAssistantId = assistantId || uiState.assistantId;

        if (!targetAssistantId) {
          throw new Error(
            'Assistant ID is required (provide assistantId or execute within assistant context)',
          );
        }

        // Send open file command via WebSocket
        emitToUser(uiState.userId, 'ui-command:open-file', {
          path,
          assistantId: targetAssistantId,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Sent open file command to user ${uiState.userId} for session ${targetSessionId}`,
          {
            path,
            assistantId: targetAssistantId,
          },
        );

        return {
          success: true,
          message: `Open file command sent: ${path}`,
          data: {
            sessionId: targetSessionId,
            userId: uiState.userId,
            path,
            assistantId: targetAssistantId,
            sent: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to send open file command', {
          error: error.message,
          path,
          assistantId,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Show a notification to the user
   */
  showNotification: {
    description: 'Display a notification message to the user in the UI',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Notification message to display',
        },
        type: {
          type: 'string',
          enum: ['info', 'success', 'warning', 'error'],
          description: 'Notification type (default: info)',
        },
        duration: {
          type: 'number',
          description: 'Duration in milliseconds (default: 5000)',
        },
        sessionId: {
          type: 'string',
          description:
            'Session ID (optional - uses current session if omitted)',
        },
      },
      required: ['message'],
    },
    function: async ({
      message,
      type = 'info',
      duration = 5000,
      sessionId,
    }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error('Session ID is required');
        }

        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState) {
          throw new Error(
            `No active UI session found for session ${targetSessionId}. User may not be connected.`,
          );
        }

        // Send notification command via WebSocket
        emitToUser(uiState.userId, 'ui-command:notification', {
          message,
          type,
          duration,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Sent notification to user ${uiState.userId} for session ${targetSessionId}`,
          {
            message,
            type,
          },
        );

        return {
          success: true,
          message: `Notification sent: ${message}`,
          data: {
            sessionId: targetSessionId,
            userId: uiState.userId,
            message,
            type,
            duration,
            sent: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to send notification', {
          error: error.message,
          message,
          type,
          sessionId,
        });
        throw error;
      }
    },
  },
});
