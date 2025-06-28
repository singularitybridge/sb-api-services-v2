import express from 'express';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import * as ContentService from '../services/content.service';

const contentRouter = express.Router();

// Get content items by content type ID
contentRouter.get(
  '/type/:contentTypeId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { contentTypeId } = req.params;
    const { orderBy, limit, skip, artifactKey } = req.query;

    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentItems = await ContentService.getContentItems(
        req.company._id,
        contentTypeId,
        artifactKey as string | undefined,
        orderBy as string | undefined,
        limit ? parseInt(limit as string) : undefined,
        skip ? parseInt(skip as string) : undefined,
      );
      res.status(200).json(contentItems);
    } catch (error) {
      console.error('Error getting content items by content type ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get content items by artifact key
contentRouter.get(
  '/artifact/:artifactKey',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { artifactKey } = req.params;
    const { contentTypeId, orderBy, limit, skip } = req.query;

    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentItems = await ContentService.getContentItemsByArtifactKey(
        req.company._id,
        artifactKey,
        contentTypeId as string | undefined,
        orderBy as string | undefined,
        limit ? parseInt(limit as string) : undefined,
        skip ? parseInt(skip as string) : undefined,
      );
      res.status(200).json(contentItems);
    } catch (error) {
      console.error('Error getting content items by artifact key:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Create a new content item
contentRouter.post(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { contentTypeId, data, artifactKey } = req.body;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!contentTypeId) {
      return res.status(400).json({ error: 'Content Type ID is required' });
    }
    if (!artifactKey) {
      return res.status(400).json({ error: 'Artifact Key is required' });
    }

    try {
      const contentItem = await ContentService.createContentItem(
        req.company._id,
        contentTypeId,
        data,
        artifactKey,
      );
      res.status(201).json(contentItem);
    } catch (error) {
      console.error('Error creating content item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get all content items
contentRouter.get(
  '/',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { contentTypeId, artifactKey, orderBy, limit, skip } = req.query;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentItems = await ContentService.getContentItems(
        req.company._id,
        contentTypeId as string | undefined,
        artifactKey as string | undefined,
        orderBy as string | undefined,
        limit ? parseInt(limit as string) : undefined,
        skip ? parseInt(skip as string) : undefined,
      );
      res.status(200).json(contentItems);
    } catch (error) {
      console.error('Error getting content items:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Vector search
contentRouter.get(
  '/search',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { query, contentTypeId, limit } = req.query;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    try {
      const searchResults = await ContentService.searchContentItems(
        req.company._id,
        query as string,
        contentTypeId as string | undefined,
        limit ? parseInt(limit as string) : undefined,
      );
      res.status(200).json(searchResults);
    } catch (error) {
      console.error('Error performing vector search:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Get a specific content item
contentRouter.get(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentItem = await ContentService.getContentItem(
        id,
        req.company._id,
      );
      if (!contentItem) {
        return res.status(404).json({ error: 'Content item not found' });
      }
      res.status(200).json(contentItem);
    } catch (error) {
      console.error('Error getting content item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Update a content item
contentRouter.put(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { data, artifactKey } = req.body;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const contentItem = await ContentService.updateContentItem(
        id,
        req.company._id,
        data,
        artifactKey,
      );
      if ('error' in contentItem) {
        return res.status(400).json(contentItem);
      }
      res.status(200).json(contentItem);
    } catch (error) {
      console.error('Error updating content item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// Delete a content item
contentRouter.delete(
  '/:id',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    if (!req.company?._id) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
      const result = await ContentService.deleteContentItem(
        id,
        req.company._id,
      );
      if (result) {
        res.status(200).json({ message: 'Content item deleted' });
      } else {
        res.status(404).json({ error: 'Content item not found' });
      }
    } catch (error) {
      console.error('Error deleting content item:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export { contentRouter };
