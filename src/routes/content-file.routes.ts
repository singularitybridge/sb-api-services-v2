import express from 'express';
import multer from 'multer';
import { uploadContentFile, getContentFiles, deleteContentFile } from '../services/content-file.service';
import { AuthenticatedRequest, verifyAccess } from '../middleware/auth.middleware';
import { validateApiKeys } from '../services/api.key.service';

const contentFileRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

contentFileRouter.post(
  '/upload',
  verifyAccess(),
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { title, description, sessionId, fileId } = req.body;
      const companyId = req.company._id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const contentFile = await uploadContentFile(
        req.file,
        companyId.toString(),
        title,
        description,
        sessionId,
        fileId
      );
      res.status(201).json(contentFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
  }
);

contentFileRouter.get(
  '/list',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.company._id;
      const files = await getContentFiles(companyId.toString());
      res.json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'An error occurred while listing files' });
    }
  }
);

contentFileRouter.delete(
  '/:fileId',
  verifyAccess(),  
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.company._id;
      const { fileId } = req.params;
      const result = await deleteContentFile(fileId, companyId.toString());
      res.json(result);
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'An error occurred while deleting the file' });
    }
  }
);

export default contentFileRouter;
