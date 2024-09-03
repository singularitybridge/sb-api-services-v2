import express from 'express';
import { getJob, getJobs, rerunJob, agendaClient, scheduleMessage } from '../services/agenda/agenda.service';
import { validateApiKeys, getApiKey } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Session } from '../models/Session';

const agendaRouter = express.Router();

agendaRouter.post('/jobs/rerun/:id', async (req, res) => {
  const { id } = req.params;
  await rerunJob(id);
  res.send('OK');
});

agendaRouter.get('/jobs', async (req, res) => {
  const jobs = await getJobs();
  res.send(jobs);
});

agendaRouter.get('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const job = await getJob(id);
  res.send(job);
});

agendaRouter.post('/jobs/run/:name', async (req, res) => {
  const { name } = req.params;
  console.log('run job', name, req.body);
  const job = await agendaClient.now(name, req.body);
  res.send(job);
});

agendaRouter.post('/schedule', validateApiKeys(['openai']), async (req: AuthenticatedRequest, res) => {
  try {
    const { message, scheduledTime, sessionId } = req.body;

    if (!message || !scheduledTime || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (typeof scheduledTime !== 'string') {
      return res.status(400).json({ error: 'scheduledTime must be a string' });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    await scheduleMessage(sessionId, message, scheduledTime);
    
    res.status(200).json({ message: 'Message scheduled successfully' });
  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { agendaRouter };
