// File: src/routes/session.routes.ts
import { Router, Response, NextFunction } from 'express';
import { getSessionMessages } from '../services/assistant.service';
import { Session } from '../models/Session';
import {
  endSession,
  getSessionOrCreate,
  sessionFriendlyAggreationQuery,
  updateSessionAssistant,
  activateSession,
} from '../services/session.service';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { BadRequestError } from '../utils/errors';
import { resolveAssistantIdentifier } from '../services/assistant/assistant-resolver.service';

const sessionRouter = Router();

// Create session
sessionRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channel, channelUserId, channelMetadata, assistantId } = req.body || {};

    // Resolve assistantId by name or ObjectId if provided (e.g., from Herald)
    let resolvedAssistantId: string | undefined;
    if (assistantId) {
      const companyId = req.user?.companyId.toString() ?? '';
      const assistant = await resolveAssistantIdentifier(assistantId, companyId);
      if (assistant) {
        resolvedAssistantId = assistant._id.toString();
      } else {
        // If caller explicitly requested an assistant that doesn't exist, fail
        // rather than silently falling back to a default assistant
        return res.status(400).json({
          message: `Assistant '${assistantId}' not found`,
        });
      }
    }

    const session = await getSessionOrCreate(
      req.user?._id.toString() ?? '',
      req.user?.companyId.toString() ?? '',
      resolvedAssistantId,
      channel || channelUserId ? { channel, channelUserId, channelMetadata } : undefined,
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
});

// Clear current session and start a new one
sessionRouter.post(
  '/clear',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.companyId?.toString();
      const userId = req.user?._id?.toString();

      if (!companyId || !userId) {
        throw new BadRequestError('User or Company ID not found in request.');
      }

      const { channel, channelUserId, channelMetadata, assistantId } = req.body || {};
      const channelInfo = channel || channelUserId ? { channel, channelUserId, channelMetadata } : undefined;

      // Resolve assistantId if provided (e.g., from Herald)
      let resolvedAssistantId: string | undefined;
      if (assistantId) {
        const assistant = await resolveAssistantIdentifier(assistantId, companyId);
        if (assistant) {
          resolvedAssistantId = assistant._id.toString();
        }
      }

      // Find current active session for this user/company/channel
      const query: Record<string, any> = {
        userId: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId),
        active: true,
        channel: channelInfo?.channel || 'web',
        channelUserId: channelInfo?.channelUserId || userId,
      };
      // If we know which assistant, scope the search to that assistant's session
      if (resolvedAssistantId) {
        query.assistantId = new mongoose.Types.ObjectId(resolvedAssistantId);
      }
      const currentActiveSession = await Session.findOne(query);

      let lastAssistantId: string | undefined = resolvedAssistantId;

      if (currentActiveSession) {
        console.log(
          `Clear Session: Ending existing active session ${currentActiveSession._id}`,
        );
        if (!lastAssistantId) {
          lastAssistantId = currentActiveSession.assistantId?.toString();
        }

        // Carry over channelMetadata from old session if caller didn't provide it
        if (channelInfo && !channelInfo.channelMetadata && (currentActiveSession as any).channelMetadata) {
          channelInfo.channelMetadata = (currentActiveSession as any).channelMetadata;
        }

        await endSession(currentActiveSession._id.toString());
      } else {
        console.log(
          `Clear Session: No existing active session found for user ${userId} in company ${companyId}.`,
        );
      }

      // Create a new session
      const newSession = await getSessionOrCreate(
        userId,
        companyId,
        lastAssistantId,
        channelInfo,
      );

      res.status(200).json(newSession);
    } catch (error) {
      next(error);
    }
  },
);

// Get active session messages
sessionRouter.get(
  '/messages',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const companyId = req.user?.companyId?.toString();
    const userId = req.user?._id?.toString();

    if (!companyId || !userId) {
      return next(
        new BadRequestError('User or Company ID not found in request.'),
      );
    }

    try {
      const { channel, channelUserId } = req.query as { channel?: string; channelUserId?: string };
      const activeSession = await Session.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        companyId: new mongoose.Types.ObjectId(companyId),
        active: true,
        channel: channel || 'web',
        channelUserId: channelUserId || userId,
      });

      if (!activeSession) {
        return res.status(404).json({ error: 'Active session not found.' });
      }

      const messages = await getSessionMessages(
        activeSession._id.toString(),
      );
      res.status(200).send(messages);
    } catch (error) {
      console.error('Specific error in GET /session/messages:', error); // Added for debugging
      next(error); // Centralized error handling
    }
  },
);

// Get recent sessions for the current company - Placed before parameterized routes like /:id
sessionRouter.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.companyId?.toString();
      if (!companyId) {
        return next(new BadRequestError('Company ID not found in request.'));
      }

      const { limit: limitParam, channel } = req.query as { limit?: string | string[]; channel?: string };
      let limit = 10;
      if (Array.isArray(limitParam)) {
        limit = parseInt(limitParam[0] ?? '', 10);
      } else if (typeof limitParam === 'string') {
        limit = parseInt(limitParam, 10);
      }
      if (!Number.isFinite(limit) || limit <= 0) {
        limit = 10;
      }

      const query: any = {
        companyId: new mongoose.Types.ObjectId(companyId),
      };
      if (channel) {
        query.channel = channel;
      }

      const sessions = await Session.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      res.status(200).send(sessions);
    } catch (error) {
      next(error);
    }
  },
);

// Update session assistant (still requires :id as assistant is a property of a specific session)
// Activate a previous session for the current user
sessionRouter.post(
  '/:id/activate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?._id?.toString();
      const companyId = req.user?.companyId?.toString();

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(new BadRequestError('Valid session ID is required.'));
      }
      if (!userId || !companyId) {
        return next(
          new BadRequestError('User or Company ID not found in request.'),
        );
      }

      const session = await activateSession(id, userId, companyId);

      res.status(200).send({
        message: 'Session activated successfully',
        session,
      });
    } catch (error) {
      next(error);
    }
  },
);

sessionRouter.put(
  '/:id/assistant',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { assistantId } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(400).send({ error: 'Company ID not found' });
    }

    try {
      const updatedSession = await updateSessionAssistant(
        id,
        assistantId,
        companyId.toString(),
      );
      if (updatedSession) {
        res.status(200).send(updatedSession);
      } else {
        res.status(404).send({ error: 'Session not found' });
      }
    } catch (error) {
      next(error);
    }
  },
);

// End session
sessionRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;

    try {
      await endSession(id);
      res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// Get friendly sessions for the requester
sessionRouter.get(
  '/friendly',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user?.companyId?.toString();
      if (!companyId) {
        return next(new BadRequestError('Company ID not found in request.'));
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
      next(error);
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

// Get session messages by specific ID (keeping this for direct access if needed, e.g. admin or specific use cases)
sessionRouter.get(
  '/:id/messages',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const companyId = req.user?.companyId?.toString(); // Get companyId from authenticated user

    if (!companyId) {
      return next(new BadRequestError('Company ID not found in request.'));
    }

    try {
      // Ensure the session belongs to the user's company if not an admin
      const query: any = { _id: new mongoose.Types.ObjectId(id) };
      if (req.user?.role !== 'Admin') {
        query.companyId = new mongoose.Types.ObjectId(companyId);
      }

      const session = await Session.findOne(query);
      if (!session) {
        return res
          .status(404)
          .send({ error: 'Session not found or access denied' });
      }
      const messages = await getSessionMessages(id);
      res.status(200).send(messages);
    } catch (error) {
      next(error);
    }
  },
);

export { sessionRouter };
