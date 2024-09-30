import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys } from '../../services/api.key.service';
import { getApiKey } from '../../services/api.key.service';
import { createNewThread, deleteThread, getMessages } from '../../services/oai.thread.service';
import { Session } from '../../models/Session';
import { handleSessionMessage } from '../../services/assistant.service';
import { ChannelType } from '../../types/ChannelType';

const threadRouter = express.Router();

threadRouter.get(
  '/:id/messages',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    const messages = await getMessages(apiKey, id);
    res.send(messages);
  }
);

threadRouter.post(
  '/',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    const newThread = await createNewThread(apiKey);
    res.send(newThread);
  }
);

threadRouter.delete(
  '/:id',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    await deleteThread(apiKey, id);
    res.send({ message: 'Thread deleted successfully' });
  }
);

threadRouter.post(
  '/user-input',
  validateApiKeys(['openai']),
  async (req: AuthenticatedRequest, res) => {
    const { userInput, sessionId } = req.body;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      const response = await handleSessionMessage(apiKey, userInput, sessionId, ChannelType.WEB);
      res.send(response);
    } catch (error) {
      console.error('Error handling session message:', error);
      res.status(500).send('An error occurred while processing your request.');
    }
  }
);

export { threadRouter };