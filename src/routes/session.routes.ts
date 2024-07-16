// File: src/routes/session.routes.ts
import { Router, Response } from 'express';
import {
  endSession,
  endSessionByCompanyAndUserId,
  getSessionMessages,
  getSessionMessagesByCompanyAndUserId,
} from '../services/assistant.service';
import { Session } from '../models/Session';
import {
  getSessionOrCreate,
  sessionFriendlyAggreationQuery,
} from '../services/session.service';
import mongoose from 'mongoose';
import { verifyAccess, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getApiKey, validateApiKeys } from '../services/api.key.service';

const sessionRouter = Router();

// Update session
sessionRouter.put('/:id', verifyAccess(), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const sessionData = req.body;
  try {
    const session = await Session.findOne({ _id: id, companyId: req.user?.companyId });
    if (session) {
      session.assistantId = sessionData.assistantId;
      await session.save();
      res.status(200).send({ message: 'Session updated successfully' });
    } else {
      res.status(404).send({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Error updating session' });
  }
});

// Create session
sessionRouter.post('/', verifyAccess(), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assistantId } = req.body;
    const apiKey = await getApiKey(req.company._id, 'openai');
    const session = await getSessionOrCreate(apiKey ?? '', req.user?._id.toString() ?? '', req.user?.companyId.toString() ?? '', assistantId);
    res.status(200).json(session);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error handling session', error });
  }
});

// End session
sessionRouter.delete('/:id', verifyAccess(), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const apiKey = await getApiKey(req.company._id, 'openai');

  try {
    const session = await Session.findOne({ _id: id, companyId: req.user?.companyId });
    if (!session) {
      return res.status(404).send({ error: 'Session not found' });
    }
    await endSession(apiKey ?? '', id);
    res.status(200).send({ message: 'Session ended successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error ending session' });
  }
});

// End session by company and user ID
sessionRouter.delete('/end/:companyId/:userId', verifyAccess(true), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  const { companyId, userId } = req.params;
  const apiKey = await getApiKey(req.company._id, 'openai');

  try {
    await endSessionByCompanyAndUserId(apiKey ?? '', companyId, userId);
    res.status(200).send({ message: 'Session ended successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error ending session' });
  }
});

// Get all sessions (admin only)
sessionRouter.get('/', verifyAccess(true), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await Session.find();
    res.status(200).send(sessions);
  } catch (error) {
    res.status(500).send({ error: 'Error getting sessions' });
  }
});

// Get friendly sessions for a company
sessionRouter.get('/friendly/:companyId', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { companyId } = req.params;
    if (req.user?.role !== 'Admin' && req.user?.companyId.toString() !== companyId) {
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
});

// Get session by company and user ID
sessionRouter.get('/:companyId/:userId', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  const { companyId, userId } = req.params;
  try {
    if (req.user?.role !== 'Admin' && (req.user?.companyId.toString() !== companyId || req.user?._id.toString() !== userId)) {
      return res.status(403).send({ error: 'Access denied' });
    }

    const sessions = await Session.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          userId: new mongoose.Types.ObjectId(userId),
          active: true,
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

// Get session by ID
sessionRouter.get('/:id', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sessions = await Session.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          companyId: req.user?.role === 'Admin' ? { $exists: true } : new mongoose.Types.ObjectId(req.user?.companyId),
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
sessionRouter.get('/:id/messages', verifyAccess(), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const apiKey = await getApiKey(req.company._id, 'openai');

  try {
    const session = await Session.findOne({ _id: id, companyId: req.user?.companyId });
    if (!session) {
      return res.status(404).send({ error: 'Session not found' });
    }
    const messages = await getSessionMessages(apiKey ?? '', id);
    res.status(200).send({ messages });
  } catch (error) {
    res.status(500).send({ error: 'Error getting session messages' });
  }
});

// Get messages by company and user ID
sessionRouter.get('/messages/:companyId/:userId', verifyAccess(), validateApiKeys(['openai']), async (req: AuthenticatedRequest, res: Response) => {
  const { companyId, userId } = req.params;
  const apiKey = await getApiKey(req.company._id, 'openai');

  try {
    if (req.user?.role !== 'Admin' && (req.user?.companyId.toString() !== companyId || req.user?._id.toString() !== userId)) {
      return res.status(403).send({ error: 'Access denied' });
    }

    const messages = await getSessionMessagesByCompanyAndUserId(apiKey ?? '', companyId, userId);
    res.status(200).send(messages);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Error getting session/assistant messages' });
  }
});

export { sessionRouter };