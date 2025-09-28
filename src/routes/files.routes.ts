import express from 'express';
import multer from 'multer';
import {
  AuthenticatedRequest,
  verifyAccess,
} from '../middleware/auth.middleware';
import {
  getWorkspaceService,
  FileScopeType,
} from '../services/unified-workspace.service';

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
      const workspace = getWorkspaceService();
      const { scope = 'temporary', purpose, tags } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileInfo = await workspace.uploadFile(
        req.file.originalname,
        req.file.buffer,
        {
          scope: scope as FileScopeType,
          metadata: {
            mimeType: req.file.mimetype,
            purpose,
            tags: tags ? tags.split(',') : [],
          },
          companyId: req.company._id.toString(),
          userId: req.user?.id,
        },
      );

      const downloadUrl = fileInfo.url;

      res.status(201).json({
        id: fileInfo.id,
        path: fileInfo.path,
        downloadUrl,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        scope,
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
      const workspace = getWorkspaceService();
      const { url, filename, scope = 'temporary', purpose, tags } = req.body;

      if (!url || !filename) {
        return res.status(400).json({
          error: 'URL and filename are required',
        });
      }

      // Fetch content from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from URL: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      const fileInfo = await workspace.uploadFile(filename, buffer, {
        scope: scope as FileScopeType,
        metadata: {
          sourceUrl: url,
          purpose,
          tags: tags ? tags.split(',') : [],
        },
        companyId: req.company._id.toString(),
        userId: req.user?.id,
      });

      res.status(201).json({
        id: fileInfo.id,
        path: fileInfo.path,
        downloadUrl: fileInfo.url,
        filename,
        scope,
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
    const workspace = getWorkspaceService();
    const { fileId } = req.params;

    const buffer = await workspace.downloadFile(fileId);

    if (!buffer) {
      return res.status(404).json({
        error: 'File not found or has expired',
        message: 'File not found or has expired',
      });
    }

    // Get file info for headers
    const fileInfo = await workspace.getFileInfo(fileId);
    const mimeType = fileInfo?.mimeType || 'application/octet-stream';
    const filename = fileInfo?.originalName || fileInfo?.filename || 'download';

    // Set appropriate headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (fileInfo?.expiresAt) {
      res.setHeader(
        'X-File-Expires',
        new Date(fileInfo.expiresAt).toISOString(),
      );
    }

    // Send the file
    res.send(buffer);
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
      const workspace = getWorkspaceService();
      const { fileId } = req.params;

      const fileInfo = await workspace.getFileInfo(fileId);

      if (!fileInfo) {
        return res.status(404).json({
          error: 'File not found or has expired',
        });
      }

      res.json({
        id: fileId,
        filename: fileInfo.originalName || fileInfo.filename,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        scope: fileInfo.scope,
        metadata: fileInfo,
        createdAt: fileInfo.createdAt,
        expiresAt: fileInfo.expiresAt,
        downloadUrl: `/files/${fileId}/download`,
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
    const workspace = getWorkspaceService();
    const { scope } = req.query;

    const files = await workspace.listFiles({
      scope: scope as FileScopeType,
    });

    const filesWithUrls = files.map((file) => ({
      ...file,
      downloadUrl: `/files/${file.id}/download`,
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
      const workspace = getWorkspaceService();
      const { agentId } = req.params;

      const files = await workspace.listFiles({
        prefix: `/files/agent/${agentId}`,
      });

      const filesWithUrls = files.map((file) => ({
        ...file,
        downloadUrl: `/files/${file.id}/download`,
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
      const workspace = getWorkspaceService();
      const { sessionId } = req.params;

      const files = await workspace.listFiles({
        prefix: `/files/session/${sessionId}`,
      });

      const filesWithUrls = files.map((file) => ({
        ...file,
        downloadUrl: `/files/${file.id}/download`,
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
      const workspace = getWorkspaceService();
      const { fileId } = req.params;

      const deleted = await workspace.deleteFile(fileId);

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
