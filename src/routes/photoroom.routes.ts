import express from 'express';
import { validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { photoRoomService } from '../services/photoroom.service';

const photoRoomRouter = express.Router();

photoRoomRouter.post('/remove-background', validateApiKeys(['photoroom']), express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const processedImage = await photoRoomService.removeBackground(req.company._id, imageUrl);
    res.set('Content-Type', 'image/png');
    res.send(processedImage);
  } catch (error) {
    console.error('Error removing background:', error);
    res.status(500).json({ error: 'Failed to remove background' });
  }
});

export { photoRoomRouter };