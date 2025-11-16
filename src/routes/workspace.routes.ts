import express from 'express';
import { getWorkspaceService } from '../services/unified-workspace.service';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/workspace/get
 * Retrieve a file from workspace storage (public access for display purposes)
 * Query params: path (workspace path)
 */
router.get('/get', async (req, res) => {
  try {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).send({
        message: 'Path query parameter is required',
      });
    }

    logger.info(`Retrieving workspace file: ${path}`);

    const workspace = getWorkspaceService();
    const data = await workspace.get(path);

    if (!data) {
      return res.status(404).send({
        message: 'File not found in workspace',
      });
    }

    // Get file info for content type
    const files = await workspace.listWithMetadata(path);
    const fileInfo = files.find((f) => f.path === path);

    const contentType = fileInfo?.metadata?.contentType || 'image/png';

    // Set content type header
    res.setHeader('Content-Type', contentType);

    // Send the buffer
    res.send(data);
  } catch (error: any) {
    logger.error('Error retrieving workspace file:', error);
    res.status(500).send({
      message: 'Error retrieving file from workspace',
      error: error.message,
    });
  }
});

export { router as workspaceRouter };
