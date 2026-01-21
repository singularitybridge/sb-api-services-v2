import express, { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  getCostRecords,
  getCostSummary,
  getDailyCosts,
} from '../services/cost-tracking.service';
import { resolveAssistantIdentifier } from '../services/assistant/assistant-resolver.service';

const costTrackingRouter = express.Router();

/**
 * GET /api/costs
 * Get cost records with optional filtering
 */
costTrackingRouter.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        assistantId,
        userId,
        provider,
        model,
        startDate,
        endDate,
        limit = '100',
        skip = '0',
      } = req.query;

      const companyId = req.company?._id?.toString();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const { records, totalCount } = await getCostRecords({
        companyId,
        assistantId: assistantId as string,
        userId: userId as string,
        provider: provider as string,
        model: model as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string, 10),
        skip: parseInt(skip as string, 10),
      });

      res.json({
        success: true,
        data: records,
        count: records.length,
        totalCount,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/costs/summary
 * Get cost summary for the company
 */
costTrackingRouter.get(
  '/summary',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, provider } = req.query;

      const companyId = req.company?._id?.toString();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const summary = await getCostSummary(
        companyId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        provider as string | undefined,
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/costs/daily
 * Get daily cost breakdown
 */
costTrackingRouter.get(
  '/daily',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { days = '30', startDate, endDate, provider } = req.query;

      const companyId = req.company?._id?.toString();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const dailyCosts = await getDailyCosts(
        companyId,
        parseInt(days as string, 10),
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        provider as string | undefined,
      );

      res.json({
        success: true,
        data: dailyCosts,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/costs/by-assistant/:assistantId
 * Get costs for a specific assistant (supports both ID and name)
 */
costTrackingRouter.get(
  '/by-assistant/:assistantId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { assistantId } = req.params;
      const { startDate, endDate, limit = '100' } = req.query;

      const companyId = req.company?._id?.toString();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      // Use resolver to handle both ID and name
      const assistant = await resolveAssistantIdentifier(
        assistantId,
        companyId,
      );

      if (!assistant) {
        return res.status(404).json({ error: 'Assistant not found' });
      }

      const result = await getCostRecords({
        companyId,
        assistantId: assistant._id.toString(),
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string, 10),
      });

      // Calculate total cost for this assistant
      const totalCost = result.records.reduce(
        (sum, record) => sum + record.totalCost,
        0,
      );
      const totalTokens = result.records.reduce(
        (sum, record) => sum + record.totalTokens,
        0,
      );

      res.json({
        success: true,
        data: {
          records: result.records,
          summary: {
            totalCost,
            totalTokens,
            totalRequests: result.records.length,
            averageCost:
              result.records.length > 0 ? totalCost / result.records.length : 0,
          },
        },
        assistantId: assistant._id.toString(),
        assistantName: assistant.name,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/costs/by-model/:model
 * Get costs for a specific model
 */
costTrackingRouter.get(
  '/by-model/:model',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { model } = req.params;
      const { startDate, endDate, limit = '100' } = req.query;

      const companyId = req.company?._id?.toString();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID is required' });
      }

      const result = await getCostRecords({
        companyId,
        model,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string, 10),
      });

      // Calculate total cost for this model
      const totalCost = result.records.reduce(
        (sum, record) => sum + record.totalCost,
        0,
      );
      const totalTokens = result.records.reduce(
        (sum, record) => sum + record.totalTokens,
        0,
      );

      res.json({
        success: true,
        data: {
          records: result.records,
          summary: {
            totalCost,
            totalTokens,
            totalRequests: result.records.length,
            averageCost:
              result.records.length > 0 ? totalCost / result.records.length : 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export { costTrackingRouter };
