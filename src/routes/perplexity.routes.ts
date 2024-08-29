import express from 'express';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { performPerplexitySearch } from '../services/perplexity.service';

const perplexityRouter = express.Router();

perplexityRouter.post('/search', validateApiKeys(['perplexity']), async (req: AuthenticatedRequest, res) => {
  try {
    const { model, query } = req.body;
    const content = await performPerplexitySearch(req.company._id, model, query);
    res.json({ content });
  } catch (error) {
    console.error('Error in Perplexity search:', error);
    res.status(500).json({ error: 'An error occurred during the Perplexity search' });
  }
});

export { perplexityRouter };