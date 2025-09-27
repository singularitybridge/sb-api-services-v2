/// file_path: src/routes/inbox.routes.ts
import express from 'express';
import {
  addMessageToInbox,
  getInboxMessages,
  updateInboxMessageStatus,
} from '../services/inbox.service';
import { handleSessionMessage } from '../services/assistant.service';
import { Session } from '../models/Session';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getApiKey } from '../services/api.key.service';

const inboxRouter = express.Router();

// AI agent sends a message to the inbox
inboxRouter.post('/:sessionId', async (req: AuthenticatedRequest, res) => {
  const { message } = req.body;
  const { sessionId } = req.params;

  try {
    const response = await addMessageToInbox({
      message,
      sessionId,
      type: 'human_agent_request',
      companyId: req.company._id,
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error adding message to inbox', error });
  }
});

// Human operator replies to an inbox message
inboxRouter.post(
  '/reply/:sessionId',
  async (req: AuthenticatedRequest, res) => {
    const { message, inboxMessageId } = req.body;
    const { sessionId } = req.params;

    try {
      const apiKey = await getApiKey(req.company._id, 'openai_api_key');

      // Add human operator response to inbox
      await addMessageToInbox({
        message,
        sessionId,
        type: 'human_agent_response',
        companyId: req.company._id,
      });

      // Update the status of the original message
      await updateInboxMessageStatus(inboxMessageId, 'closed');

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const responseTemplate = `[human-agent-response]: ${message}. [system]: Incorporate this response into your conversation with the user, maintaining context and tone.`;
      const llmResponse = await handleSessionMessage(
        responseTemplate,
        session.id,
        {
          // This is the metadata argument
          message_type: 'human-agent-response',
        },
      );

      res.json({ message: 'Response sent successfully', llmResponse });
    } catch (error) {
      res.status(500).json({ message: 'Error processing reply', error });
    }
  },
);

// Get inbox messages for the company
inboxRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const messages = await getInboxMessages(req.company._id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving inbox messages', error });
  }
});

export { inboxRouter };
