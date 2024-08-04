// file path: src/routes/file.routes.ts
import express from 'express';
import multer from 'multer';
import {
  uploadFile,
  listFiles,
  deleteFile,
  listAllOpenAIFiles,
} from '../services/file.service';
import { getApiKey, validateApiKeys } from '../services/api.key.service';
import { AuthenticatedRequest, verifyAccess } from '../middleware/auth.middleware';

const fileRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

fileRouter.post(  '/:assistantId/files',  verifyAccess(),  validateApiKeys(['openai']),  upload.single('file'),  async (req: AuthenticatedRequest, res) => {
    const { assistantId } = req.params;
    const { name, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

    try {
      const result = await uploadFile(file, assistantId, apiKey, name, description);
      res.status(201).json(result);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

fileRouter.get( '/',  verifyAccess(),  validateApiKeys(['openai']),  async (req: AuthenticatedRequest, res) => {
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;

    try {
      const files = await listAllOpenAIFiles(apiKey);
      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

fileRouter.get(  '/:assistantId/files',  verifyAccess(),  validateApiKeys(['openai']),  async (req: AuthenticatedRequest, res) => {
    const { assistantId } = req.params;
    const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
    try {
      const files = await listFiles(assistantId, apiKey);
      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

fileRouter.delete( '/:assistantId/files/:fileId',  verifyAccess(),  validateApiKeys(['openai']),  async (req: AuthenticatedRequest, res) => {
    const { assistantId, fileId } = req.params;

    try {
      const apiKey = (await getApiKey(req.company._id, 'openai')) as string;
      const result = await deleteFile(assistantId, fileId, apiKey);
      res.json(result);
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export { fileRouter };
