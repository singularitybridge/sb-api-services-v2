import express from 'express';
import { actionDiscoveryService } from '../integrations/action-discovery.service';

const router = express.Router();

router.get('/discover', async (req, res) => {
  try {
    const language = (req.query.language as string || 'en').toLowerCase();
    
    if (language !== 'en' && language !== 'he') {
      return res.status(400).json({ error: 'Unsupported language. Use "en" or "he".' });
    }

    const actions = await actionDiscoveryService.discoverActions(language as 'en' | 'he');
    res.json(actions);
  } catch (error) {
    console.error('Error discovering actions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;