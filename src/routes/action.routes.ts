import express from 'express';
import { createAction, deleteAction, getAction, getActions, updateAction } from '../services/action.service';


const actionRouter = express.Router();

actionRouter.post('/', async (req, res) => {
  try {
    const action = await createAction(req.body);
    res.json(action);
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

actionRouter.get('/', async (req, res) => {
  const actions = await getActions();
  res.json(actions);
});

actionRouter.get('/:id', async (req, res) => {
  const action = await getAction(req.params.id);
  if (!action) {
    return res.status(404).json({ message: 'Action not found' });
  }
  res.json(action);
});

actionRouter.put('/:id', async (req, res) => {
  try {
    const action = await updateAction(req.params.id, req.body);
    res.json(action);
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

actionRouter.delete('/:id', async (req, res) => {
  try {
    const action = await deleteAction(req.params.id);
    if (!action) {
      return res.status(404).json({ message: 'Action not found' });
    }
    res.json(action);
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

export { actionRouter };
