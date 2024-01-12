import express from 'express';
import { addMessageToInbox, getInboxMessages } from '../services/inbox.service';

const inboxRouter = express.Router();

inboxRouter.post('/:sessionId', async (req, res) => {

    console.log('got', req.body);


  const { message } = req.body;
  const { sessionId } = req.params;
  const inboxMessage = { message, sessionId };
  console.log('inboxMessage', inboxMessage);
  const response = await addMessageToInbox(inboxMessage);
  res.json(response);
});

inboxRouter.get('/:sessionId', async (req, res) => {
  const messages = await getInboxMessages(req.params.sessionId);
  res.json(messages);
});

export { inboxRouter };
