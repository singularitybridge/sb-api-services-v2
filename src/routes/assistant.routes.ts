import express from 'express';
import { getJob, getJobs, rerunJob } from '../services/agenda/agenda.service';
import { handleUserInput } from '../services/assistant.service';

const assistantRouter = express.Router();

assistantRouter.post('/user-input', async (req, res) => {
  const { userInput, assistantId, threadId } = req.body;
  const response = await handleUserInput(userInput, assistantId, threadId);
  res.send(response);
});

export { assistantRouter };
