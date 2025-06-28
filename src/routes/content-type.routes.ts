import express from 'express';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import { ContentTypeService } from '../services/content-type.service';

const contentTypeRouter = express.Router();

// Get all content types
contentTypeRouter.get(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const contentTypes = await ContentTypeService.getAllContentTypes();
      res.status(200).json(contentTypes);
    } catch (error) {
      console.error('Error getting all content types:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get a specific content type
contentTypeRouter.get(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const contentType = await ContentTypeService.getContentTypeById(id);
      if (!contentType) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      res.status(200).json(contentType);
    } catch (error) {
      console.error('Error getting content type:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Create a new content type
contentTypeRouter.post(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentTypeData = { ...req.body, companyId: req.company._id };
      const contentType =
        await ContentTypeService.createContentType(contentTypeData);
      res.status(201).json(contentType);
    } catch (error) {
      console.error('Error creating content type:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Update a content type
contentTypeRouter.put(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const contentType = await ContentTypeService.updateContentType(
        id,
        req.body,
      );
      if (!contentType) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      res.status(200).json(contentType);
    } catch (error) {
      console.error('Error updating content type:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Delete a content type
contentTypeRouter.delete(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
      const contentType = await ContentTypeService.deleteContentType(id);
      if (!contentType) {
        return res.status(404).json({ error: 'Content type not found' });
      }
      res.status(200).json({ message: 'Content type deleted' });
    } catch (error) {
      console.error('Error deleting content type:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export { contentTypeRouter };
