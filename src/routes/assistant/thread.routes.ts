import express from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { validateApiKeys } from '../../services/api.key.service';
import { getApiKey } from '../../services/api.key.service';
import { createNewThread, deleteThread, getMessages } from '../../services/oai.thread.service';
import { Session } from '../../models/Session';
import { handleSessionMessage } from '../../services/assistant.service';
import { ChannelType } from '../../types/ChannelType';
import { getMessagesBySessionId, getMessageById } from '../../services/message.service'; // Add this import

const threadRouter = express.Router();

threadRouter.get(
  '/:id/messages',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string;
    const messages = await getMessages(apiKey, id);
    res.send(messages);
  }
);

// New route to fetch messages by session ID from MongoDB
threadRouter.get(
  '/session/:sessionId/messages',
  async (req: AuthenticatedRequest, res) => {
    const { sessionId } = req.params;
    try {
      const messages = await getMessagesBySessionId(sessionId);
      res.send(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).send('An error occurred while fetching messages.');
    }
  }
);

// New route to fetch a specific message by ID from MongoDB
threadRouter.get(
  '/message/:messageId',
  async (req: AuthenticatedRequest, res) => {
    const { messageId } = req.params;
    try {
      const message = await getMessageById(messageId);
      if (!message) {
        res.status(404).send('Message not found');
      } else {
        res.send(message);
      }
    } catch (error) {
      console.error('Error fetching message:', error);
      res.status(500).send('An error occurred while fetching the message.');
    }
  }
);

threadRouter.post(
  '/',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string;
    const newThread = await createNewThread(apiKey);
    res.send(newThread);
  }
);

threadRouter.delete(
  '/:id',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai_api_key')) as string;
    await deleteThread(apiKey, id);
    res.send({ message: 'Thread deleted successfully' });
  }
);

threadRouter.post(
  '/user-input',
  validateApiKeys(['openai_api_key']),
  async (req: AuthenticatedRequest, res) => {
    const { userInput, sessionId } = req.body;

    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      const wantsStream =
        req.accepts(['text/event-stream']) === 'text/event-stream' ||
        req.query.stream === 'true';

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders && res.flushHeaders();

        await handleSessionMessage(
          userInput,
          sessionId,
          ChannelType.WEB,
          undefined,
          (token) => {
            res.write(`data: ${token}\n\n`);
            if (typeof res.flush === 'function') {
              res.flush();
            }
          },
        );
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await handleSessionMessage(userInput, sessionId, ChannelType.WEB);
        res.send(response);
      }
    } catch (error) {
      console.error('Error handling session message:', error);
      res.status(500).send('An error occurred while processing your request.');
    }
  }
);

export { threadRouter };
