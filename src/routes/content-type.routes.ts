import express, { Request, Response } from 'express';
import { verifyAccess } from '../middleware/auth.middleware';
import { ContentTypeService } from '../services/content-type.service';

const router = express.Router();

// Get all content types
router.get('/', verifyAccess(), async (req: Request, res: Response) => {
  try {
    const contentTypes = await ContentTypeService.getAllContentTypes();
    res.status(200).json(contentTypes);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Get a specific content type
router.get('/:id', verifyAccess(), async (req: Request, res: Response) => {
  try {
    const contentType = await ContentTypeService.getContentTypeById(req.params.id);
    if (!contentType) {
      return res.status(404).json({ error: 'Content type not found' });
    }
    res.status(200).json(contentType);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Create a new content type
router.post('/', verifyAccess(), async (req: Request & { user?: { companyId: string } }, res: Response) => {
  try {
    if (!req.user || !req.user.companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }
    const contentTypeData = { ...req.body, companyId: req.user.companyId };
    const contentType = await ContentTypeService.createContentType(contentTypeData);
    res.status(201).json(contentType);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Update a content type
router.put('/:id', verifyAccess(), async (req: Request, res: Response) => {
  try {
    const contentType = await ContentTypeService.updateContentType(req.params.id, req.body);
    if (!contentType) {
      return res.status(404).json({ error: 'Content type not found' });
    }
    res.status(200).json(contentType);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

// Delete a content type
router.delete('/:id', verifyAccess(), async (req: Request, res: Response) => {
  try {
    const contentType = await ContentTypeService.deleteContentType(req.params.id);
    if (!contentType) {
      return res.status(404).json({ error: 'Content type not found' });
    }
    res.status(200).json({ message: 'Content type deleted' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'An unknown error occurred' });
  }
});

export default router;