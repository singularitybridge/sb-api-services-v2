import { Router, Request, Response } from 'express';
import { endSession, getSessionMessages } from '../services/assistant.service';
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


sessionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const sessions = await Session.find();
    res.status(200).send({ sessions });
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

export { sessionRouter };
