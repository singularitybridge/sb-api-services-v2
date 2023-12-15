import express from 'express';
import { getJob, getJobs, rerunJob, agendaClient } from '../services/agenda/agenda.service';

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



export { agendaRouter };
