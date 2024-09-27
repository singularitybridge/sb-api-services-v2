import express from 'express';
import { triggerAction } from '../services/integration-action.service';

const router = express.Router();

router.post('/trigger', async (req, res) => {
  try {
    const { integrationName, service, data } = req.body;
    
    if (!integrationName || !service) {
      return res.status(400).json({ error: 'integrationName and service are required' });
    }

    const result = await triggerAction(integrationName, service, data);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
});

export default router;