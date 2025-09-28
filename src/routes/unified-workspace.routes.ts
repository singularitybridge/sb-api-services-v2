import { Router, Request, Response } from 'express';
import { getWorkspaceService } from '../services/unified-workspace.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { singleUpload } from '../middleware/file-upload.middleware';
import { resolveAssistantIdentifier } from '../services/assistant/assistant-resolver.service';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Helper function to resolve agent ID from name or ID
async function resolveAgentId(
  identifier: string | undefined,
  companyId?: string,
): Promise<string | null> {
  if (!identifier) return null;

  // If it looks like a MongoDB ObjectId, return as-is
  if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
    return identifier;
  }

  // Otherwise, try to resolve it as a name
  try {
    const assistant = await resolveAssistantIdentifier(identifier, companyId);
    if (assistant) {
      logger.debug(`Resolved agent '${identifier}' to ID: ${assistant._id}`);
      return assistant._id.toString();
    } else {
      logger.debug(`Could not resolve agent '${identifier}', using as-is`);
      return identifier;
    }
  } catch (error) {
    logger.warn(`Failed to resolve agent identifier: ${identifier}`, error);
    return identifier; // Return original if resolution fails
  }
}

/**
 * Unified Workspace REST API
 * Provides a complete virtual filesystem for AI agents
 */

/**
 * @route POST /api/workspace/set
 * @desc Store content at a path
 */
router.post('/set', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path, content, metadata } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }

    const workspace = getWorkspaceService();

    // Determine scope and build scoped path
    const scope = metadata?.scope || 'company';
    let scopedPath = path;

    if (scope === 'company') {
      scopedPath = `/company/${req.company._id}/${path}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPath = `/session/${sessionId}/${path}`;
    } else if (scope === 'agent') {
      const agentIdentifier = metadata?.agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const agentId = await resolveAgentId(
        agentIdentifier as string,
        req.company?._id?.toString(),
      );
      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
      scopedPath = `/agent/${agentId}/${path}`;
    } else if (scope === 'team') {
      const teamId = metadata?.teamId || req.headers['x-team-id'];
      if (!teamId) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPath = `/team/${teamId}/${path}`;
    }

    // Enrich metadata with request context
    const enrichedMetadata = {
      ...metadata,
      scope,
      companyId: req.company?._id?.toString(),
      userId: req.user?._id?.toString(),
      createdAt: new Date(),
    };

    await workspace.set(scopedPath, content, enrichedMetadata);

    res.json({
      success: true,
      message: `Content stored at ${path}`,
      path,
    });
  } catch (error: any) {
    logger.error('Workspace set error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/upload
 * @desc Upload file with multipart/form-data
 */
router.post(
  '/upload',
  singleUpload,
  async (
    req: AuthenticatedRequest & { file?: Express.Multer.File },
    res: Response,
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const {
        path: filePath = req.file.originalname,
        scope = 'company',
        agentId,
        teamId,
      } = req.body;

      const workspace = getWorkspaceService();

      // Store file reference (not content) in workspace
      const fileInfo = {
        type: 'file-reference',
        id: req.file.filename.split('.')[0],
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        storagePath: req.file.path,
        uploadedAt: new Date(),
      };

      // Build scoped path
      let scopedPath = filePath;
      if (scope === 'company') {
        scopedPath = `/company/${req.company._id}/${filePath}`;
      } else if (scope === 'session') {
        const sessionId = req.headers['x-session-id'] || 'default';
        scopedPath = `/session/${sessionId}/${filePath}`;
      } else if (scope === 'agent') {
        const resolvedAgentId = agentId || req.headers['x-agent-id'];
        if (!resolvedAgentId) {
          return res.status(400).json({
            success: false,
            error: 'Agent ID is required for agent scope',
          });
        }
        scopedPath = `/agent/${resolvedAgentId}/${filePath}`;
      } else if (scope === 'team') {
        const resolvedTeamId = teamId || req.headers['x-team-id'];
        if (!resolvedTeamId) {
          return res.status(400).json({
            success: false,
            error: 'Team ID is required for team scope',
          });
        }
        scopedPath = `/team/${resolvedTeamId}/${filePath}`;
      }

      // Store the file reference
      await workspace.set(scopedPath, fileInfo, {
        scope,
        companyId: req.company?._id?.toString(),
        userId: req.user?._id?.toString(),
        createdAt: new Date(),
      });

      res.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
          id: fileInfo.id,
          path: filePath,
          downloadUrl: `/api/workspace/download/${fileInfo.id}`,
          rawUrl: `/api/workspace/raw?path=${encodeURIComponent(filePath)}&scope=${scope}${agentId ? `&agentId=${agentId}` : ''}${teamId ? `&teamId=${teamId}` : ''}`,
          metadata: fileInfo,
        },
      });
    } catch (error: any) {
      logger.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * @route GET /api/workspace/download/:fileId
 * @desc Direct file download by ID
 */
router.get(
  '/download/:fileId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileId } = req.params;

      const workspace = getWorkspaceService();

      // Search for file in all scopes
      const scopes = [
        `/company/${req.company._id}/`,
        `/session/${req.headers['x-session-id'] || 'default'}/`,
        `/agent/`,
        `/team/`,
      ];

      for (const scopePrefix of scopes) {
        const files = await workspace.list(scopePrefix);

        for (const filePath of files) {
          const fileInfo = await workspace.get(filePath);
          if (fileInfo?.type === 'file-reference' && fileInfo?.id === fileId) {
            // Check if file exists on disk
            try {
              await fs.access(fileInfo.storagePath);
              // Send file directly from disk
              return res.download(fileInfo.storagePath, fileInfo.filename);
            } catch {
              return res.status(404).json({
                success: false,
                error: 'File no longer exists on disk',
              });
            }
          }
        }
      }

      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    } catch (error: any) {
      logger.error('File download error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

/**
 * @route GET /api/workspace/raw
 * @desc Get raw file content by path
 */
router.get('/raw', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path: filePath, scope = 'company', agentId, teamId } = req.query;

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path is required as query parameter',
      });
    }

    // Build scoped path
    let scopedPath = filePath;
    if (scope === 'company') {
      scopedPath = `/company/${req.company._id}/${filePath}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPath = `/session/${sessionId}/${filePath}`;
    } else if (scope === 'agent') {
      const resolvedAgentId = agentId || req.headers['x-agent-id'];
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      scopedPath = `/agent/${resolvedAgentId}/${filePath}`;
    } else if (scope === 'team') {
      const resolvedTeamId = teamId || req.headers['x-team-id'];
      if (!resolvedTeamId) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPath = `/team/${resolvedTeamId}/${filePath}`;
    }

    const workspace = getWorkspaceService();
    const content = await workspace.get(scopedPath);

    if (content === undefined) {
      return res.status(404).json({
        success: false,
        error: `File not found: ${filePath}`,
      });
    }

    // Check if it's a file reference
    if (content?.type === 'file-reference') {
      try {
        await fs.access(content.storagePath);
        // Send file directly from disk with proper mimetype
        res.setHeader(
          'Content-Type',
          content.mimetype || 'application/octet-stream',
        );
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${content.filename}"`,
        );
        return res.sendFile(content.storagePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: 'File no longer exists on disk',
        });
      }
    } else {
      // For text/JSON content, return as-is
      if (typeof content === 'string') {
        res.setHeader('Content-Type', 'text/plain');
        return res.send(content);
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.json(content);
      }
    }
  } catch (error: any) {
    logger.error('Raw file get error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/workspace/get
 * @desc Retrieve content from a path
 */
router.get('/get', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path, scope = 'company', agentId, teamId } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path is required as query parameter',
      });
    }

    // Build scoped path based on scope
    let scopedPath = path;

    if (scope === 'company') {
      scopedPath = `/company/${req.company._id}/${path}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPath = `/session/${sessionId}/${path}`;
    } else if (scope === 'agent') {
      const agentIdentifier = agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const resolvedAgentId = await resolveAgentId(
        agentIdentifier as string,
        req.company?._id?.toString(),
      );
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
      scopedPath = `/agent/${resolvedAgentId}/${path}`;
    } else if (scope === 'team') {
      const resolvedTeamName = teamId || req.headers['x-team-id'];
      if (!resolvedTeamName) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPath = `/team/${resolvedTeamName}/${path}`;
    }

    const workspace = getWorkspaceService();
    const content = await workspace.get(scopedPath);

    if (content === undefined) {
      return res.status(404).json({
        success: false,
        error: `Path not found: ${path}`,
      });
    }

    // Check if it's a file reference and add download URLs
    const responseData: any = {
      success: true,
      path,
      found: true,
    };

    if (content?.type === 'file-reference') {
      // For file references, return metadata with download URLs
      responseData.file = {
        ...content,
        downloadUrl: `/api/workspace/download/${content.id}`,
        rawUrl: `/api/workspace/raw?path=${encodeURIComponent(path as string)}&scope=${scope}${agentId ? `&agentId=${agentId}` : ''}${teamId ? `&teamId=${teamId}` : ''}`,
      };
      responseData.isFile = true;
    } else {
      // For regular content, return as-is
      responseData.content = content;
      responseData.isFile = false;
    }

    res.json(responseData);
  } catch (error: any) {
    logger.error('Workspace get error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/workspace/list
 * @desc List all paths under a prefix
 */
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prefix, scope = 'company', agentId, teamId } = req.query;

    // Build scoped prefix based on scope
    let scopedPrefix = (prefix as string) || '';

    if (scope === 'company') {
      scopedPrefix = `/company/${req.company._id}/${prefix || ''}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPrefix = `/session/${sessionId}/${prefix || ''}`;
    } else if (scope === 'agent') {
      const agentIdentifier = agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const resolvedAgentId = await resolveAgentId(
        agentIdentifier as string,
        req.company?._id?.toString(),
      );
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
      scopedPrefix = `/agent/${resolvedAgentId}/${prefix || ''}`;
    } else if (scope === 'team') {
      const resolvedTeamName = teamId || req.headers['x-team-id'];
      if (!resolvedTeamName) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPrefix = `/team/${resolvedTeamName}/${prefix || ''}`;
    }

    const workspace = getWorkspaceService();
    const paths = await workspace.list(scopedPrefix);

    // Strip the scope prefix from returned paths for cleaner display
    const cleanPaths = paths.map((p) => {
      if (scope === 'company')
        return p.replace(`/company/${req.company._id}/`, '');
      if (scope === 'session')
        return p.replace(new RegExp(`^/session/[^/]+/`), '');
      if (scope === 'agent') return p.replace(new RegExp(`^/agent/[^/]+/`), '');
      if (scope === 'team') return p.replace(new RegExp(`^/team/[^/]+/`), '');
      return p;
    });

    res.json({
      success: true,
      scope: scope as string,
      prefix: prefix || '/',
      paths: cleanPaths,
      count: cleanPaths.length,
    });
  } catch (error: any) {
    logger.error('Workspace list error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/workspace/delete
 * @desc Delete content at a path
 */
router.delete('/delete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path, scope = 'company', agentId, teamId } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }

    // Build scoped path based on scope
    let scopedPath = path;

    if (scope === 'company') {
      scopedPath = `/company/${req.company._id}/${path}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPath = `/session/${sessionId}/${path}`;
    } else if (scope === 'agent') {
      const agentIdentifier = agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const resolvedAgentId = await resolveAgentId(
        agentIdentifier as string,
        req.company?._id?.toString(),
      );
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
      scopedPath = `/agent/${resolvedAgentId}/${path}`;
    } else if (scope === 'team') {
      const resolvedTeamName = teamId || req.headers['x-team-id'];
      if (!resolvedTeamName) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPath = `/team/${resolvedTeamName}/${path}`;
    }

    const workspace = getWorkspaceService();
    const deleted = await workspace.delete(scopedPath);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Path not found: ${path}`,
      });
    }

    res.json({
      success: true,
      message: `Deleted ${path}`,
      path,
    });
  } catch (error: any) {
    logger.error('Workspace delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/workspace/exists
 * @desc Check if a path exists
 */
router.get('/exists', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path, scope = 'company', agentId, teamId } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Path is required as query parameter',
      });
    }

    // Build scoped path based on scope
    let scopedPath = path;

    if (scope === 'company') {
      scopedPath = `/company/${req.company._id}/${path}`;
    } else if (scope === 'session') {
      const sessionId = req.headers['x-session-id'] || 'default';
      scopedPath = `/session/${sessionId}/${path}`;
    } else if (scope === 'agent') {
      const agentIdentifier = agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const resolvedAgentId = await resolveAgentId(
        agentIdentifier as string,
        req.company?._id?.toString(),
      );
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
      scopedPath = `/agent/${resolvedAgentId}/${path}`;
    } else if (scope === 'team') {
      const resolvedTeamName = teamId || req.headers['x-team-id'];
      if (!resolvedTeamName) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
      scopedPath = `/team/${resolvedTeamName}/${path}`;
    }

    const workspace = getWorkspaceService();
    const exists = await workspace.exists(scopedPath);

    res.json({
      success: true,
      path,
      exists,
    });
  } catch (error: any) {
    logger.error('Workspace exists error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/workspace/clear
 * @desc Clear all content under a prefix
 */
router.delete('/clear', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prefix, confirm } = req.body;

    // Require confirmation for safety
    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required (confirm: true)',
      });
    }

    const workspace = getWorkspaceService();
    await workspace.clear(prefix);

    res.json({
      success: true,
      message: prefix
        ? `Cleared all content under ${prefix}`
        : 'Cleared entire workspace',
      prefix: prefix || '/',
    });
  } catch (error: any) {
    logger.error('Workspace clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/export
 * @desc Export workspace content
 */
router.post('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prefix } = req.body;

    const workspace = getWorkspaceService();
    const data = await workspace.export(prefix);

    res.json({
      success: true,
      prefix: prefix || '/',
      data,
      count: Object.keys(data).length,
    });
  } catch (error: any) {
    logger.error('Workspace export error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/import
 * @desc Import workspace content
 */
router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Data object is required',
      });
    }

    const workspace = getWorkspaceService();
    await workspace.import(data);

    res.json({
      success: true,
      message: `Imported ${Object.keys(data).length} entries`,
      imported: Object.keys(data).length,
    });
  } catch (error: any) {
    logger.error('Workspace import error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/workspace/info
 * @desc Get workspace information
 */
router.get('/info', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspace = getWorkspaceService();
    const info = workspace.getInfo();

    res.json({
      success: true,
      ...info,
      companyId: req.company?._id?.toString(),
    });
  } catch (error: any) {
    logger.error('Workspace info error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/move
 * @desc Move/rename a path
 */
router.post('/move', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromPath, toPath } = req.body;

    if (!fromPath || !toPath) {
      return res.status(400).json({
        success: false,
        error: 'Both fromPath and toPath are required',
      });
    }

    const workspace = getWorkspaceService();

    // Get content from old path
    const content = await workspace.get(fromPath);
    if (content === undefined) {
      return res.status(404).json({
        success: false,
        error: `Source path not found: ${fromPath}`,
      });
    }

    // Set at new path
    await workspace.set(toPath, content);

    // Delete old path
    await workspace.delete(fromPath);

    res.json({
      success: true,
      message: `Moved ${fromPath} to ${toPath}`,
      fromPath,
      toPath,
    });
  } catch (error: any) {
    logger.error('Workspace move error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/copy
 * @desc Copy a path
 */
router.post('/copy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromPath, toPath } = req.body;

    if (!fromPath || !toPath) {
      return res.status(400).json({
        success: false,
        error: 'Both fromPath and toPath are required',
      });
    }

    const workspace = getWorkspaceService();

    // Get content from source path
    const content = await workspace.get(fromPath);
    if (content === undefined) {
      return res.status(404).json({
        success: false,
        error: `Source path not found: ${fromPath}`,
      });
    }

    // Set at new path
    await workspace.set(toPath, content);

    res.json({
      success: true,
      message: `Copied ${fromPath} to ${toPath}`,
      fromPath,
      toPath,
    });
  } catch (error: any) {
    logger.error('Workspace copy error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/workspace/clear-scope
 * @desc Clear all content for a specific scope
 */
router.delete(
  '/clear-scope',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { scope = 'company', confirm, agentId, teamId } = req.body;

      // Require confirmation for safety
      if (confirm !== true) {
        return res.status(400).json({
          success: false,
          error: 'Confirmation required (confirm: true)',
        });
      }

      // Build the prefix based on scope
      let prefix = '';

      if (scope === 'company') {
        prefix = `/company/${req.company._id}`;
      } else if (scope === 'session') {
        const sessionId = req.headers['x-session-id'] || 'default';
        prefix = `/session/${sessionId}`;
      } else if (scope === 'agent') {
        const agentIdentifier = agentId || req.headers['x-agent-id'];
        if (!agentIdentifier) {
          return res.status(400).json({
            success: false,
            error: 'Agent ID is required for agent scope',
          });
        }
        const resolvedAgentId = await resolveAgentId(
          agentIdentifier as string,
          req.company?._id?.toString(),
        );
        if (!resolvedAgentId) {
          return res.status(400).json({
            success: false,
            error: `Could not resolve agent: ${agentIdentifier}`,
          });
        }
        prefix = `/agent/${resolvedAgentId}`;
      } else if (scope === 'team') {
        const teamIdentifier = teamId || req.headers['x-team-id'];
        if (!teamIdentifier) {
          return res.status(400).json({
            success: false,
            error: 'Team ID is required for team scope',
          });
        }
        prefix = `/team/${teamIdentifier}`;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid scope. Must be: company, session, agent, or team',
        });
      }

      const workspace = getWorkspaceService();

      // Get list of files before clearing
      const filesBeforeClearing = await workspace.list(prefix);
      const fileCount = filesBeforeClearing.length;

      // Clear the scope
      await workspace.clear(prefix);

      logger.info(
        `Workspace: Cleared ${fileCount} files from scope ${scope} with prefix ${prefix}`,
      );

      res.json({
        success: true,
        scope,
        prefix,
        filesCleared: fileCount,
        message: `Cleared ${fileCount} files from ${scope} scope`,
      });
    } catch (error: any) {
      logger.error('Workspace clear scope error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

export default router;
