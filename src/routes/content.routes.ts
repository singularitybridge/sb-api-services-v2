import express from 'express';
import { AuthenticatedRequest, verifyAccess } from '../middleware/auth.middleware';
import * as ContentService from '../services/content.service';

const contentRouter = express.Router();

// Get content items by content type ID
contentRouter.get('/type/:contentTypeId', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { contentTypeId } = req.params;
  const { orderBy, limit, skip } = req.query;

  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const contentItems = await ContentService.getContentItemsByType(
      req.company._id,
      contentTypeId,
      orderBy as string | undefined,
      limit ? parseInt(limit as string) : undefined,
      skip ? parseInt(skip as string) : undefined
    );
    res.status(200).json(contentItems);
  } catch (error) {
    console.error('Error getting content items by content type ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new content item
contentRouter.post('/', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { contentTypeId, data } = req.body;
  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }
  if (!contentTypeId) {
    return res.status(400).json({ error: 'Content Type ID is required' });
  }

  try {
    const contentItem = await ContentService.createContentItem(req.company._id, contentTypeId, data);
    res.status(201).json(contentItem);
  } catch (error) {
    console.error('Error creating content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all content items
contentRouter.get('/', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { contentTypeId, orderBy, limit, skip } = req.query;
  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const contentItems = await ContentService.getContentItems(
      req.company._id,
      contentTypeId as string | undefined,
      orderBy as string | undefined,
      limit ? parseInt(limit as string) : undefined,
      skip ? parseInt(skip as string) : undefined
    );
    res.status(200).json(contentItems);
  } catch (error) {
    console.error('Error getting content items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific content item
contentRouter.get('/:id', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const contentItem = await ContentService.getContentItem(id, req.company._id);
    if (!contentItem) {
      return res.status(404).json({ error: 'Content item not found' });
    }
    res.status(200).json(contentItem);
  } catch (error) {
    console.error('Error getting content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a content item
contentRouter.put('/:id', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const contentItem = await ContentService.updateContentItem(id, req.company._id, req.body);
    if (!contentItem) {
      return res.status(404).json({ error: 'Content item not found' });
    }
    res.status(200).json(contentItem);
  } catch (error) {
    console.error('Error updating content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a content item
contentRouter.delete('/:id', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!req.company?._id) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  try {
    const result = await ContentService.deleteContentItem(id, req.company._id);
    if (result) {
      res.status(200).json({ message: 'Content item deleted' });
    } else {
      res.status(404).json({ error: 'Content item not found' });
    }
  } catch (error) {
    console.error('Error deleting content item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { contentRouter };
