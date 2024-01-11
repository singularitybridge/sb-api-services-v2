import { Router, Request, Response } from 'express';
import {
  endSession,
  endSessionByAssistantAndUserId,
  getSessionMessages,
  getSessionMessagesByAssistantAndUserId,
} from '../services/assistant.service';
import { Session } from '../models/Session';

const sessionRouter = Router();

sessionRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await endSession(id);
    res.status(200).send({ message: 'Session ended successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error ending session' });
  }
});

sessionRouter.delete(
  '/end/:assistantId/:userId',
  async (req: Request, res: Response) => {
    const { assistantId, userId } = req.params;
    try {
      await endSessionByAssistantAndUserId(assistantId, userId);
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

sessionRouter.get('/friendly', async (req, res) => {
  try {
    const sessions = await Session.aggregate([
      {
        $lookup: {
          from: 'users', // Join with the users collection
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $lookup: {
          from: 'assistants', // Join with the assistants collection
          localField: 'assistantId',
          foreignField: 'assistantId',
          as: 'assistantDetails'
        }
      },
      {
        $unwind: '$assistantDetails'
      },
      {
        $project: {
          assistantId: 1,
          userId: 1,
          assistantName: '$userDetails.name', // Include the user's name
          userName: '$assistantDetails.name', // Include the assistant's name
          threadId: 1,
          active: 1,
          // __v: 1
        }
      }
    ]);

    res.status(200).send(sessions);
  } catch (error) {    
    res.status(500).send({ error: 'Error getting sessions' });
  }
});




sessionRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const session = await Session.findById(id);
    res.status(200).send({ session });
  } catch (error) {
    res.status(500).send({ error: 'Error getting session' });
  }
});

sessionRouter.get('/:id/messages', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const messages = await getSessionMessages(id);
    res.status(200).send({ messages });
  } catch (error) {
    res.status(500).send({ error: 'Error getting session messages' });
  }
});

sessionRouter.get(
  '/messages/:assistantId/:userId',
  async (req: Request, res: Response) => {
    const { assistantId, userId } = req.params;
    try {
      const messages = await getSessionMessagesByAssistantAndUserId(
        assistantId,
        userId,
      );
      res.status(200).send(messages);
    } catch (error) {
      res.status(500).send({ error: 'Error getting session messages' });
    }
  },
);

export { sessionRouter };
