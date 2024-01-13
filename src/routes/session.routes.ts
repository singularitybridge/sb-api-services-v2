import { Router, Request, Response } from 'express';
import {
  endSession,
  endSessionByAssistantAndUserId,
  getSessionMessages,
  getSessionMessagesByAssistantAndUserId,
} from '../services/assistant.service';
import { Session } from '../models/Session';
import { getSessionOrCreate } from '../services/session.service';

const sessionRouter = Router();

sessionRouter.post('/', async (req, res) => {
  try {
      const { userId, companyId, assistantId } = req.body;
      const session = await getSessionOrCreate(userId, companyId, assistantId);
      res.status(200).json(session);
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error handling session", error });
  }
});



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
          from: 'users', 
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
          from: 'assistants',
          localField: 'assistantId',
          foreignField: '_id',
          as: 'assistantDetails'
        }
      },
      {
        $unwind: '$assistantDetails'
      },

      {
        $lookup: {
          from: 'companies', 
          localField: 'companyId',
          foreignField: '_id',
          as: 'companyDetails'
        }
      },
      {
        $unwind: '$companyDetails'
      },


      {
        $project: {
          assistantId: 1,
          userId: 1,
          companyId: 1,
          userName: '$userDetails.name',
          assistantName: '$assistantDetails.name',
          companyName: '$companyDetails.name',
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
      console.log(error);
      res.status(500).send({ error: 'Error getting session/assistant messages' });
    }
  },
);

export { sessionRouter };
