import express from 'express';
import { addMessageToInbox, getInboxMessages } from '../services/inbox.service';
import { handleSessionMessage } from '../services/assistant.service';
import { Session } from '../models/Session';

const inboxRouter = express.Router();

inboxRouter.post('/:sessionId', async (req, res) => {
  const { message } = req.body;
  const { sessionId } = req.params;

  const response = await addMessageToInbox({
    message,
    sessionId,
    type: 'human_agent_request',
  });
  res.json(response);
});

// lets make a reply url for a session

inboxRouter.post('/reply/:sessionId', async (req, res) => {

  const { message } = req.body;
  const { sessionId } = req.params;
  const apiKey = req.headers['openai-api-key'] as string;


  // step 1 - add a message (human response ) to the inbox

  await addMessageToInbox({
    message,
    sessionId,
    type: 'human_agent_response',
  });


  // step 2 - send a response to oai chat thread

  const session = await Session.findById(sessionId);

  if (!session) {
    return res.status(404).json({ message: 'session not found' });
  }

  const responseTemplate = `[human-agent-response]: ${message}. [system]: rephrase/format this resposne to match the conversation context and send it to the user.`;
  const llmResponse = await handleSessionMessage(
    apiKey,
    responseTemplate,
    session.companyId,
    session.userId,
    {
      'message_type': 'human-agent-response',
    }
  );


  res.json({ message: 'success' });
});

inboxRouter.get('/:sessionId', async (req, res) => {
  const messages = await getInboxMessages(req.params.sessionId);
  res.json(messages);
});

export { inboxRouter };
