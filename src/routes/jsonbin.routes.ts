import express from 'express';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { readFile, updateFile, createFile } from '../services/jsonbin.service';

const jsonbinRouter = express.Router();

jsonbinRouter.post('/', validateApiKeys(['jsonbin']), express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const { data, name } = req.body;
    const result = await createFile(req.company._id, data, name);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error creating file in JSONBin' });
  }
});

jsonbinRouter.get('/:binId', validateApiKeys(['jsonbin']), async (req: AuthenticatedRequest, res) => {
  try {
    const { binId } = req.params;
    const data = await readFile(req.company._id, binId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error reading file from JSONBin' });
  }
});

jsonbinRouter.put('/:binId', validateApiKeys(['jsonbin']), express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const { binId } = req.params;
    const data = req.body;
    const result = await updateFile(req.company._id, binId, data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error updating file in JSONBin' });
  }
});

export { jsonbinRouter };