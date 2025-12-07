/**
 * UI State Query Actions
 *
 * Enables Claude Code and external tools to query real-time UI state
 * from the Agent Hub web interface programmatically, replacing visual
 * inspection (screenshots) with direct data access.
 */

import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { logger } from '../../utils/logger';
import { uiSessionStateService } from '../../services/ui-session-state.service';

export const createUIStateActions = (
  context: ActionContext,
): FunctionFactory => ({
  /**
   * Get current UI state for a specific session
   */
  getUIState: {
    description:
      'Get current UI state including route, open documents, and context for a session',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description:
            'Session ID to get UI state for (optional - uses current session if omitted)',
        },
      },
      required: [],
    },
    function: async ({ sessionId }: any): Promise<StandardActionResult> => {
      try {
        const targetSessionId = sessionId || context?.sessionId;

        if (!targetSessionId) {
          throw new Error(
            'Session ID is required (provide sessionId or execute within a session context)',
          );
        }

        // Get UI state from service
        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState) {
          return {
            success: true,
            message: `No UI state found for session ${targetSessionId}`,
            data: {
              sessionId: targetSessionId,
              found: false,
            },
          };
        }

        logger.info(`Retrieved UI state for session ${targetSessionId}`, {
          route: uiState.currentRoute,
          hasDocument: !!uiState.openWorkspaceDocument,
          assistantId: uiState.assistantId,
        });

        return {
          success: true,
          message: `UI state retrieved for session ${targetSessionId}`,
          data: {
            sessionId: uiState.sessionId,
            currentRoute: uiState.currentRoute,
            assistantId: uiState.assistantId,
            openWorkspaceDocument: uiState.openWorkspaceDocument
              ? {
                  path: uiState.openWorkspaceDocument.path,
                  lastModified: uiState.openWorkspaceDocument.lastModified,
                }
              : null,
            uiContext: uiState.uiContext,
            lastUpdate: uiState.lastUpdate,
            found: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to get UI state', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get active workspace document content
   */
  getActiveWorkspaceDocument: {
    description: 'Get the content of the currently open workspace document',
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

        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState?.openWorkspaceDocument) {
          return {
            success: true,
            message: 'No workspace document is currently open',
            data: {
              sessionId: targetSessionId,
              document: null,
            },
          };
        }

        logger.info(
          `Retrieved active workspace document for session ${targetSessionId}`,
          {
            path: uiState.openWorkspaceDocument.path,
          },
        );

        return {
          success: true,
          message: `Active document: ${uiState.openWorkspaceDocument.path}`,
          data: {
            sessionId: targetSessionId,
            document: {
              path: uiState.openWorkspaceDocument.path,
              content: uiState.openWorkspaceDocument.content,
              lastModified: uiState.openWorkspaceDocument.lastModified,
              metadata: uiState.openWorkspaceDocument.metadata,
            },
          },
        };
      } catch (error: any) {
        logger.error('Failed to get active workspace document', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get current page context (route, title, breadcrumbs)
   */
  getCurrentPageContext: {
    description:
      'Get current page context including route, UI state, and available actions',
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

        const uiState =
          uiSessionStateService.getUIStateBySession(targetSessionId);

        if (!uiState) {
          return {
            success: true,
            message: 'No page context available',
            data: {
              sessionId: targetSessionId,
              found: false,
            },
          };
        }

        // Parse route to extract page information
        const routeParts = uiState.currentRoute.split('/').filter(Boolean);
        const pageTitle = routeParts[routeParts.length - 1] || 'home';

        logger.info(`Retrieved page context for session ${targetSessionId}`, {
          route: uiState.currentRoute,
          pageTitle,
        });

        return {
          success: true,
          message: `Current page: ${pageTitle}`,
          data: {
            sessionId: targetSessionId,
            route: uiState.currentRoute,
            pageTitle,
            breadcrumbs: uiState.uiContext.breadcrumbs || routeParts,
            activeTab: uiState.uiContext.activeTab,
            modalState: uiState.uiContext.modalState,
            found: true,
          },
        };
      } catch (error: any) {
        logger.error('Failed to get page context', {
          error: error.message,
          sessionId,
        });
        throw error;
      }
    },
  },

  /**
   * Get statistics about tracked UI sessions
   */
  getUIStateStats: {
    description:
      'Get statistics about tracked UI sessions (active users, sessions, etc.)',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async (): Promise<StandardActionResult> => {
      try {
        const stats = uiSessionStateService.getStats();

        logger.info('Retrieved UI state statistics', stats);

        return {
          success: true,
          message: 'UI state statistics retrieved',
          data: {
            activeUsers: stats.activeUsers,
            activeSessions: stats.activeSessions,
            listeners: stats.listeners,
            sessions: uiSessionStateService.getActiveSessions(),
          },
        };
      } catch (error: any) {
        logger.error('Failed to get UI state stats', {
          error: error.message,
        });
        throw error;
      }
    },
  },
});
