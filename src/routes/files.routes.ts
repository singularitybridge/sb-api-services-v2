import express from 'express';
import multer from 'multer';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import { getFileManager, FileScope } from '../services/file-manager.service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Upload a file with specified scope
 */
router.post(
  '/upload',
  verifyAccess(),
  upload.single('file'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const { scope = 'temporary', ttl, ownerId, purpose, tags } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileScope: FileScope = {
        type: scope,
        ttl: ttl ? parseInt(ttl) : undefined,
        ownerId,
      };

      const managedFile = await fileManager.storeFile(
        req.file.buffer,
        req.file.originalname,
        fileScope,
        {
          mimeType: req.file.mimetype,
          purpose,
          tags: tags ? tags.split(',') : [],
        },
        req.company._id.toString(),
        req.user?.id,
      );

      const downloadUrl = fileManager.getDownloadUrl(
        managedFile.id,
        `${req.protocol}://${req.get('host')}`,
      );

      res.status(201).json({
        ...managedFile,
        downloadUrl,
        buffer: undefined, // Don't send buffer in response
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({
        error: 'Failed to upload file',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * Store file from URL
 */
router.post(
  '/store-from-url',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const {
        url,
        filename,
        scope = 'temporary',
        ttl,
        ownerId,
        purpose,
        tags,
      } = req.body;

      if (!url || !filename) {
        return res.status(400).json({
          error: 'URL and filename are required',
        });
      }

      const fileScope: FileScope = {
        type: scope,
        ttl: ttl ? parseInt(ttl) : undefined,
        ownerId,
      };

      const managedFile = await fileManager.storeFile(
        new URL(url),
        filename,
        fileScope,
        {
          purpose,
          tags: tags ? tags.split(',') : [],
        },
        req.company._id.toString(),
        req.user?.id,
      );

      const downloadUrl = fileManager.getDownloadUrl(
        managedFile.id,
        `${req.protocol}://${req.get('host')}`,
      );

      res.status(201).json({
        ...managedFile,
        downloadUrl,
        buffer: undefined,
      });
    } catch (error) {
      console.error('Error storing file from URL:', error);
      res.status(500).json({
        error: 'Failed to store file from URL',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * Download a file (no auth required for download links)
 */
router.get('/:fileId/download', async (req, res) => {
  try {
    const fileManager = getFileManager();
    const { fileId } = req.params;

    const file = await fileManager.getFile(fileId);

    if (!file) {
      return res.status(404).json({
        error: 'File not found or has expired',
        message: 'File not found or has expired',
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName}"`,
    );
    res.setHeader('Content-Length', file.size.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (file.expiresAt) {
      res.setHeader('X-File-Expires', file.expiresAt.toISOString());
    }

    // Send the file
    if (file.buffer) {
      res.send(file.buffer);
    } else {
      res.status(500).json({
        error: 'File content not available',
      });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      error: 'Failed to download file',
      message: (error as Error).message,
    });
  }
});

/**
 * Get file info
 */
router.get(
  '/:fileId/info',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const { fileId } = req.params;

      const file = await fileManager.getFile(fileId);

      if (!file) {
        return res.status(404).json({
          error: 'File not found or has expired',
        });
      }

      res.json({
        id: file.id,
        filename: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        scope: file.scope,
        metadata: file.metadata,
        createdAt: file.createdAt,
        expiresAt: file.expiresAt,
        downloadUrl: fileManager.getDownloadUrl(
          file.id,
          `${req.protocol}://${req.get('host')}`,
        ),
      });
    } catch (error) {
      console.error('Error getting file info:', error);
      res.status(500).json({
        error: 'Failed to get file info',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * List files by scope
 */
router.get('/list', verifyAccess(), async (req: AuthenticatedRequest, res) => {
  try {
    const fileManager = getFileManager();
    const { scope, ownerId, limit = 100 } = req.query;

    const fileScope: Partial<FileScope> = {};
    if (scope) fileScope.type = scope as any;
    if (ownerId) fileScope.ownerId = ownerId as string;

    const files = await fileManager.listFiles(
      fileScope,
      req.company._id.toString(),
      parseInt(limit as string),
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const filesWithUrls = files.map((file) => ({
      ...file,
      downloadUrl: fileManager.getDownloadUrl(file.id, baseUrl),
      buffer: undefined,
    }));

    res.json(filesWithUrls);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: (error as Error).message,
    });
  }
});

/**
 * List agent files
 */
router.get(
  '/agent/:agentId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const { agentId } = req.params;

      const files = await fileManager.listFiles(
        { type: 'agent', ownerId: agentId },
        req.company._id.toString(),
      );

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const filesWithUrls = files.map((file) => ({
        ...file,
        downloadUrl: fileManager.getDownloadUrl(file.id, baseUrl),
        buffer: undefined,
      }));

      res.json(filesWithUrls);
    } catch (error) {
      console.error('Error listing agent files:', error);
      res.status(500).json({
        error: 'Failed to list agent files',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * List session files
 */
router.get(
  '/session/:sessionId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const { sessionId } = req.params;

      const files = await fileManager.listFiles(
        { type: 'session', ownerId: sessionId },
        req.company._id.toString(),
      );

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const filesWithUrls = files.map((file) => ({
        ...file,
        downloadUrl: fileManager.getDownloadUrl(file.id, baseUrl),
        buffer: undefined,
      }));

      res.json(filesWithUrls);
    } catch (error) {
      console.error('Error listing session files:', error);
      res.status(500).json({
        error: 'Failed to list session files',
        message: (error as Error).message,
      });
    }
  },
);

/**
 * Delete a file
 */
router.delete(
  '/:fileId',
  verifyAccess(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fileManager = getFileManager();
      const { fileId } = req.params;

      const deleted = await fileManager.deleteFile(fileId);

      if (!deleted) {
        return res.status(404).json({
          error: 'File not found',
        });
      }

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({
        error: 'Failed to delete file',
        message: (error as Error).message,
      });
    }
  },
);

export default router;
