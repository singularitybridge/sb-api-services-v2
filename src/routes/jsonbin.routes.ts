import express from 'express';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { readFile, updateFile } from '../services/jsonbin.service';

const jsonbinRouter = express.Router();

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