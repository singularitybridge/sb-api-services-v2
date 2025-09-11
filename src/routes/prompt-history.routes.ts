import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateObjectId } from '../utils/validation';
import { promptHistoryService } from '../services/prompt-history.service';
import { Assistant } from '../models/Assistant';
import { logger } from '../utils/logger';
import { resolveAssistantIdentifier } from '../services/assistant/assistant-resolver.service';

const router = Router();

// Get prompt history for an assistant
router.get(
  '/assistants/:id/prompt-history',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { limit = 20, offset = 0, startDate, endDate } = req.query;

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const history = await promptHistoryService.getPromptHistory({
        assistantId: assistant._id.toString(),
        companyId: req.company._id.toString(),
        limit: Number(limit),
        offset: Number(offset),
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        ...history,
        assistant: {
          id: assistant._id,
          name: assistant.name,
        },
      });
    } catch (error) {
      logger.error('Error fetching prompt history:', error);
      res.status(500).json({
        message: 'Error fetching prompt history',
        error: (error as Error).message,
      });
    }
  },
);

// Get specific version of a prompt
router.get(
  '/assistants/:id/prompt-history/:version',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, version } = req.params;

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const promptVersion = await promptHistoryService.getPromptByVersion(
        assistant._id.toString(),
        Number(version),
      );

      if (!promptVersion) {
        return res.status(404).json({
          message: `Version ${version} not found for assistant ${assistant.name}`,
        });
      }

      res.json(promptVersion);
    } catch (error) {
      logger.error('Error fetching prompt version:', error);
      res.status(500).json({
        message: 'Error fetching prompt version',
        error: (error as Error).message,
      });
    }
  },
);

// Compare two versions
router.get(
  '/assistants/:id/prompt-history/compare',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { v1, v2 } = req.query;

      if (!v1 || !v2) {
        return res.status(400).json({
          message: 'Both v1 and v2 query parameters are required',
        });
      }

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const comparison = await promptHistoryService.compareVersions(
        assistant._id.toString(),
        Number(v1),
        Number(v2),
      );

      res.json({
        ...comparison,
        assistant: {
          id: assistant._id,
          name: assistant.name,
        },
      });
    } catch (error) {
      logger.error('Error comparing versions:', error);
      res.status(500).json({
        message: 'Error comparing versions',
        error: (error as Error).message,
      });
    }
  },
);

// Rollback to a specific version
router.post(
  '/assistants/:id/prompt-history/:version/rollback',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, version } = req.params;

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const result = await promptHistoryService.rollbackToVersion(
        assistant._id.toString(),
        Number(version),
        req.company._id.toString(),
        req.user?._id?.toString(),
      );

      if (!result.success) {
        return res.status(400).json({
          message: 'Rollback failed',
        });
      }

      res.json({
        message: `Successfully rolled back to version ${version}`,
        ...result,
      });
    } catch (error) {
      logger.error('Error rolling back version:', error);
      res.status(500).json({
        message: 'Error rolling back version',
        error: (error as Error).message,
      });
    }
  },
);

// Get version statistics
router.get(
  '/assistants/:id/prompt-history/statistics',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const statistics = await promptHistoryService.getVersionStatistics(
        assistant._id.toString(),
      );

      res.json({
        ...statistics,
        assistant: {
          id: assistant._id,
          name: assistant.name,
        },
      });
    } catch (error) {
      logger.error('Error fetching version statistics:', error);
      res.status(500).json({
        message: 'Error fetching version statistics',
        error: (error as Error).message,
      });
    }
  },
);

// Delete old versions (admin only)
router.delete(
  '/assistants/:id/prompt-history/cleanup',
  // Remove validateObjectId since we now accept names too
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { keepVersions = 10 } = req.query;

      // Only admins can cleanup versions
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({
          message: 'Only administrators can cleanup prompt history',
        });
      }

      // Resolve assistant by ID or name
      const assistant = await resolveAssistantIdentifier(
        id,
        req.user?.companyId.toString() || '',
      );

      if (!assistant) {
        return res.status(404).json({
          message: 'Assistant not found or access denied',
        });
      }

      const deletedCount = await promptHistoryService.deleteOldVersions(
        assistant._id.toString(),
        Number(keepVersions),
      );

      res.json({
        message: `Deleted ${deletedCount} old versions`,
        deletedCount,
        keptVersions: Number(keepVersions),
      });
    } catch (error) {
      logger.error('Error cleaning up versions:', error);
      res.status(500).json({
        message: 'Error cleaning up versions',
        error: (error as Error).message,
      });
    }
  },
);

export default router;
