// File: src/routes/session.routes.ts
import { Router, Response, NextFunction } from 'express';
import { getSessionMessages } from '../services/assistant.service';
import { Session } from '../models/Session';
import {
  endSession,
  getSessionOrCreate,
  sessionFriendlyAggreationQuery,
} from '../services/session.service';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { BadRequestError } from '../utils/errors';

const sessionRouter = Router();

// Update session
sessionRouter.put(
  '/:id/assistant',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { assistantId } = req.body;
    try {
      const session = await Session.findOneAndUpdate(
        { _id: id, companyId: req.user?.companyId },
        { assistantId },
        { new: true },
      );
      if (session) {
        res.status(200).send(session);
      } else {
        res.status(404).send({ error: 'Session not found' });
      }
    } catch (error) {
      res.status(500).send({ error: 'Error updating assistant' });
    }
  },
);

// Create session
sessionRouter.post(
  '/',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const apiKey = await getApiKey(req.company._id, 'openai');
      
      if (!apiKey) {
        return res.status(200).json({
          message: 'OpenAI API key is not set. Please configure the API key to use this feature.',
          keyMissing: true
        });
      }

      const session = await getSessionOrCreate(
        apiKey,
        req.user?._id.toString() ?? '',
        req.user?.companyId.toString() ?? '',
      );
      res.status(200).json(session);
    } catch (error: unknown) {
      console.error('Error handling session:', error);

      if (error instanceof Error) {
        res
          .status(500)
          .json({ message: 'Error handling session', error: error.message });
      } else {
        res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  },
);

// End session
sessionRouter.delete(
  '/:id',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      const apiKey = await getApiKey(req.company._id, 'openai');

      if (!apiKey) {
        throw new BadRequestError('OpenAI API key not found');
      }

      await endSession(apiKey, id);
      res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// Get all sessions (admin only)
sessionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await Session.find();
    res.status(200).send(sessions);
  } catch (error) {
    res.status(500).send({ error: 'Error getting sessions' });
  }
});

// Get friendly sessions for a company
sessionRouter.get(
  '/friendly/:companyId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      if (
        req.user?.role !== 'Admin' &&
        req.user?.companyId.toString() !== companyId
      ) {
        return res.status(403).send({ error: 'Access denied' });
      }

      const sessions = await Session.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
            active: true,
          },
        },
        ...sessionFriendlyAggreationQuery,
      ]);

      res.status(200).send(sessions);
    } catch (error) {
      res.status(500).send({ error: 'Error getting sessions' });
    }
  },
);

// Get session by ID
sessionRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sessions = await Session.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          companyId:
            req.user?.role === 'Admin'
              ? { $exists: true }
              : new mongoose.Types.ObjectId(req.user?.companyId),
        },
      },
      ...sessionFriendlyAggreationQuery,
    ]);

    if (sessions.length === 0) {
      return res.status(404).send({ error: 'Session not found' });
    }

    const session = sessions[0];
    res.status(200).send(session);
  } catch (error) {
    res.status(500).send({ error: 'Error getting session' });
  }
});

// Get session messages
sessionRouter.get(
  '/:id/messages',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const apiKey = await getApiKey(req.company._id, 'openai');

    try {
      const session = await Session.findOne({
        _id: id,
        companyId: req.user?.companyId,
      });
      if (!session) {
        return res.status(404).send({ error: 'Session not found' });
      }
      const messages = await getSessionMessages(apiKey ?? '', id);
      res.status(200).send(messages);
    } catch (error) {
      res.status(500).send({ error: 'Error getting session messages' });
    }
  },
);

export { sessionRouter };
