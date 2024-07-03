import { Router, Request, Response } from 'express';
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

const sessionRouter = Router();

sessionRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const sessionData = req.body;
  try {
    const session = await Session.findById(id);
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

sessionRouter.post('/', async (req, res) => {
  try {
    const { userId, companyId, assistantId } = req.body;
    const apiKey = process.env.OPENAI_API_KEY as string;
    const session = await getSessionOrCreate(apiKey, userId, companyId, assistantId);
    res.status(200).json(session);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error handling session', error });
  }
});

sessionRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;

  try {
    await endSession(apiKey, id);
    res.status(200).send({ message: 'Session ended successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error ending session' });
  }
});

sessionRouter.delete(
  '/end/:companyId/:userId',
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const apiKey = req.headers['openai-api-key'] as string;

    try {
      await endSessionByCompanyAndUserId(apiKey, companyId, userId);
      res.status(200).send({ message: 'Session ended successfully' });
    } catch (error) {
      res.status(500).send({ error: 'Error ending session' });
    }
  },
);

sessionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const sessions = await Session.find();
    res.status(200).send(sessions);
  } catch (error) {
    res.status(500).send({ error: 'Error getting sessions' });
  }
});

sessionRouter.get('/friendly/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

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

// get session by company and user id
sessionRouter.get('/:companyId/:userId', async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    try {
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

      // Check if a session was found
      if (sessions.length === 0) {
        return res.status(404).send({ error: 'Session not found' });
      }

      // Return the first session object instead of an array
      const session = sessions[0];
      res.status(200).send(session);
    } catch (error) {
      res.status(500).send({ error: 'Error getting session' });
    }
    
  },
);

sessionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sessions = await Session.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      ...sessionFriendlyAggreationQuery,
    ]);

    // Check if a session was found
    if (sessions.length === 0) {
      return res.status(404).send({ error: 'Session not found' });
    }

    // Return the first session object instead of an array
    const session = sessions[0];
    res.status(200).send(session);
  } catch (error) {
    res.status(500).send({ error: 'Error getting session' });
  }
});

sessionRouter.get('/:id/messages', async (req: Request, res: Response) => {
  const { id } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;

  try {
    const messages = await getSessionMessages(apiKey, id);
    res.status(200).send({ messages });
  } catch (error) {
    res.status(500).send({ error: 'Error getting session messages' });
  }
});

sessionRouter.get(
  '/messages/:companyId/:userId',
  async (req: Request, res: Response) => {
    const { companyId, userId } = req.params;
    const apiKey = req.headers['openai-api-key'] as string;

    try {
      const messages = await getSessionMessagesByCompanyAndUserId(
        apiKey,
        companyId,
        userId,
      );
      res.status(200).send(messages);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .send({ error: 'Error getting session/assistant messages' });
    }
  },
);

export { sessionRouter };