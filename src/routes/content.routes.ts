import express, { Request, Response } from 'express';
import { verifyAccess } from '../middleware/auth.middleware';
import * as ContentService from '../services/content.service';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  companyId?: string;
}

// Create a new content item
router.post('/', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    const { contentTypeId, data } = req.body;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    if (!contentTypeId) {
      return res.status(400).json({ error: 'Content Type ID is required' });
    }
    const contentItem = await ContentService.createContentItem(companyId, contentTypeId, data);
    res.status(201).json(contentItem);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Get all content items
router.get('/', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    const { contentTypeId, orderBy, limit, skip } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentItems = await ContentService.getContentItems(
      companyId,
      contentTypeId as string | undefined,
      orderBy as string | undefined,
      limit ? parseInt(limit as string) : undefined,
      skip ? parseInt(skip as string) : undefined
    );
    res.status(200).json(contentItems);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Get a specific content item
router.get('/:id', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentItem = await ContentService.getContentItem(req.params.id, companyId);
    if (!contentItem) {
      return res.status(404).json({ error: 'Content item not found' });
    }
    res.status(200).json(contentItem);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Update a content item
router.put('/:id', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentItem = await ContentService.updateContentItem(req.params.id, companyId, req.body);
    if (!contentItem) {
      return res.status(404).json({ error: 'Content item not found' });
    }
    res.status(200).json(contentItem);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Delete a content item
router.delete('/:id', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const result = await ContentService.deleteContentItem(req.params.id, companyId);
    if (result) {
      res.status(200).json({ message: 'Content item deleted' });
    } else {
      res.status(404).json({ error: 'Content item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

export default router;