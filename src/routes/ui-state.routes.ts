import express from 'express';
import { uiSessionStateService } from '../services/ui-session-state.service';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/ui-state/update
 * Update UI state for the current user/session
 *
 * Body:
 * {
 *   currentRoute: string,
 *   sessionId?: string,
 *   assistantId?: string,
 *   openWorkspaceDocument?: { path, lastModified, metadata },
 *   uiContext?: { breadcrumbs, selectedTeam, filters, activeTab, modalState }
 * }
 */
router.post('/update', async (req, res) => {
  try {
    const userId = (req as any).userId; // Set by verifyTokenMiddleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const {
      currentRoute,
      sessionId,
      assistantId,
      openWorkspaceDocument,
      uiContext,
    } = req.body;

    if (!currentRoute) {
      return res.status(400).json({
        success: false,
        error: 'currentRoute is required',
      });
    }

    // Build the UI state update
    const stateUpdate: any = {
      currentRoute,
      uiContext: uiContext || {},
    };

    // Include sessionId if provided
    if (sessionId) {
      stateUpdate.sessionId = sessionId;
    }

    // Include assistantId if provided
    if (assistantId) {
      stateUpdate.assistantId = assistantId;
    }

    // Include workspace document if provided
    if (openWorkspaceDocument) {
      stateUpdate.openWorkspaceDocument = {
        path: openWorkspaceDocument.path,
        lastModified: new Date(
          openWorkspaceDocument.lastModified || Date.now(),
        ),
        metadata: openWorkspaceDocument.metadata || {},
      };
    }

    // Update UI state in service
    uiSessionStateService.updateUIState(userId, stateUpdate);

    logger.debug('UI state updated', {
      userId,
      route: currentRoute,
      sessionId,
      hasDocument: !!openWorkspaceDocument,
    });

    res.json({
      success: true,
      message: 'UI state updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating UI state', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update UI state',
      message: error.message,
    });
  }
});

/**
 * GET /api/ui-state
 * Get current UI state for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const uiState = uiSessionStateService.getUIState(userId);

    if (!uiState) {
      return res.status(404).json({
        success: false,
        error: 'No UI state found for user',
      });
    }

    res.json({
      success: true,
      data: uiState,
    });
  } catch (error: any) {
    logger.error('Error getting UI state', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get UI state',
      message: error.message,
    });
  }
});

export default router;
