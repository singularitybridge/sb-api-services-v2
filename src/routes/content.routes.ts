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
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentItem = await ContentService.createContentItem(companyId, req.body);
    res.status(201).json(contentItem);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Get all content items
router.get('/', verifyAccess(), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentItems = await ContentService.getContentItems(companyId);
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
    const contentItem = await ContentService.getContentItem(companyId, req.params.id);
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
    const contentItem = await ContentService.updateContentItem(companyId, req.params.id, req.body);
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
    await ContentService.deleteContentItem(companyId, req.params.id);
    res.status(200).json({ message: 'Content item deleted' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

export default router;