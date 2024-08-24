import express from 'express';
import { generateFluxImage } from '../services/flux.image.service';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const fluxImageRouter = express.Router();

fluxImageRouter.post('/generate', validateApiKeys(['getimg']), async (req: AuthenticatedRequest, res) => {
  try {
    const { prompt, width, height } = req.body;
    const imageUrl = await generateFluxImage(req.company._id, { prompt, width, height });
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating Flux image:', error);
    res.status(500).json({ error: 'Failed to generate Flux image' });
  }
});

export { fluxImageRouter };