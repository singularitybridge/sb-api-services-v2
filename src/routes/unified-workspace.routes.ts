import { Router, Response } from 'express';
import { getWorkspaceService } from '../services/unified-workspace.service';
import { getVectorSearchService } from '../services/vector-search.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { singleUpload } from '../middleware/file-upload.middleware';
import { resolveAssistantIdentifier } from '../services/assistant/assistant-resolver.service';
import { validateSessionOwnership } from '../services/session/session-resolver.service';
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
 * Helper function to build scope prefix
 * Returns the base path for a given scope (e.g., "/company/123/", "/agent/456/")
 */
function buildScopePrefix(
  scope: string,
  params: {
    companyId?: string;
    sessionId?: string;
    agentId?: string;
    teamId?: string;
  },
): string {
  switch (scope) {
    case 'company':
      return `/company/${params.companyId}/`;
    case 'session':
      return `/session/${params.sessionId}/`;
    case 'agent':
      return `/agent/${params.agentId}/`;
    case 'team':
      return `/team/${params.teamId}/`;
    default:
      return '';
  }
}

/**
 * Helper function to strip scope prefix from path
 * Uses simple string slicing instead of regex for better performance and clarity
 */
function stripScopePrefix(path: string, scopePrefix: string): string {
  if (path.startsWith(scopePrefix)) {
    return path.slice(scopePrefix.length);
  }
  return path;
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
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
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
        const sessionId = req.headers['x-session-id'] as string;
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Session ID is required for session scope',
          });
        }
        await validateSessionOwnership(sessionId, req.company._id.toString());
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

      // Use pattern search to find the file efficiently (no N+1 queries)
      // Search for keys that contain the fileId
      const pattern = new RegExp(`/${fileId}/`);
      const matchingPaths = await workspace.findByPattern(pattern);

      if (matchingPaths.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Get the first matching file
      const fileInfo = await workspace.get(matchingPaths[0]);

      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Check if it's a file-reference (old format)
      if (fileInfo?.type === 'file-reference') {
        try {
          await fs.access(fileInfo.storagePath);
          return res.download(fileInfo.storagePath, fileInfo.filename);
        } catch {
          return res.status(404).json({
            success: false,
            error: 'File no longer exists on disk',
          });
        }
      }

      // New format: content embedded directly
      if (fileInfo?.type === 'embedded' && fileInfo?.content) {
        // Get metadata for filename and mimetype
        const metadata = fileInfo.metadata || {};
        const filename = metadata.filename || 'download';
        const mimetype = metadata.contentType || 'application/octet-stream';

        // Convert content to buffer
        let buffer: Buffer;
        if (
          fileInfo.content.type === 'buffer' &&
          fileInfo.content.encoding === 'base64'
        ) {
          buffer = Buffer.from(fileInfo.content.data, 'base64');
        } else if (Buffer.isBuffer(fileInfo.content)) {
          buffer = fileInfo.content;
        } else if (typeof fileInfo.content === 'string') {
          buffer = Buffer.from(fileInfo.content);
        } else {
          buffer = Buffer.from(JSON.stringify(fileInfo.content));
        }

        res.setHeader('Content-Type', mimetype);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
        return res.send(buffer);
      }

      return res.status(404).json({
        success: false,
        error: 'File format not supported',
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
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
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

    // Set cache-control headers to prevent caching of workspace content
    // This ensures the browser always fetches the latest version
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
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
      // For regular content, handle binary data (images, etc.)
      if (Buffer.isBuffer(content)) {
        // Convert buffer to base64 for JSON transport
        responseData.content = content.toString('base64');
        responseData.isFile = false;
        responseData.isBinary = true;
      } else if (content?.type === 'file' && content?.content) {
        // File object with base64 content - extract the base64 data
        responseData.content = content.content;
        responseData.isFile = false;
        responseData.isBinary = true;
        responseData.fileMetadata = {
          filename: content.filename,
          mimeType: content.mimeType,
          size: content.size,
          uploadedAt: content.uploadedAt,
          sourceUrl: content.sourceUrl,
        };
      } else {
        // For text/JSON content, return as-is
        responseData.content = content;
        responseData.isFile = false;
        responseData.isBinary = false;
      }
    }

    // Set cache-control headers to prevent caching of workspace content
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
 * @query withMetadata - Optional boolean to include metadata (timestamps, size, etc.)
 */
router.get('/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startTime = Date.now();
    const {
      prefix,
      scope = 'company',
      agentId,
      teamId,
      withMetadata,
    } = req.query;
    const includeMetadata = withMetadata === 'true';

    // Determine scope IDs
    let sessionId: string | undefined;
    let resolvedAgentId: string | undefined;
    let resolvedTeamId: string | undefined;

    if (scope === 'session') {
      sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
    } else if (scope === 'agent') {
      const agentIdentifier = agentId || req.headers['x-agent-id'];
      if (!agentIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required for agent scope',
        });
      }
      const t1 = Date.now();
      resolvedAgentId =
        (await resolveAgentId(
          agentIdentifier as string,
          req.company?._id?.toString(),
        )) || undefined;
      logger.debug(`Resolve agent took ${Date.now() - t1}ms`);
      if (!resolvedAgentId) {
        return res.status(400).json({
          success: false,
          error: `Could not resolve agent: ${agentIdentifier}`,
        });
      }
    } else if (scope === 'team') {
      resolvedTeamId = (teamId || req.headers['x-team-id']) as string;
      if (!resolvedTeamId) {
        return res.status(400).json({
          success: false,
          error: 'Team ID is required for team scope',
        });
      }
    }

    // Build scope prefix using helper
    const scopePrefix = buildScopePrefix(scope as string, {
      companyId: req.company._id.toString(),
      sessionId,
      agentId: resolvedAgentId,
      teamId: resolvedTeamId,
    });

    // Build full scoped prefix with user's prefix
    const scopedPrefix = `${scopePrefix}${prefix || ''}`;

    const workspace = getWorkspaceService();
    const t2 = Date.now();

    if (includeMetadata) {
      // Use listWithMetadata to get timestamps
      const items = await workspace.listWithMetadata(scopedPrefix);
      logger.debug(`Workspace listWithMetadata took ${Date.now() - t2}ms`);

      // Strip the scope prefix from returned paths for cleaner display
      const cleanItems = items.map((item) => ({
        path: stripScopePrefix(item.path, scopePrefix),
        metadata: item.metadata || {},
        type: item.type,
        size: item.size,
      }));

      logger.debug(`Total list request took ${Date.now() - startTime}ms`);
      res.json({
        success: true,
        scope: scope as string,
        prefix: prefix || '/',
        items: cleanItems,
        count: cleanItems.length,
      });
    } else {
      // Original behavior: return only paths
      const paths = await workspace.list(scopedPrefix);
      logger.debug(`Workspace list took ${Date.now() - t2}ms`);

      // Strip the scope prefix from returned paths for cleaner display
      const cleanPaths = paths.map((p) => stripScopePrefix(p, scopePrefix));

      logger.debug(`Total list request took ${Date.now() - startTime}ms`);
      res.json({
        success: true,
        scope: scope as string,
        prefix: prefix || '/',
        paths: cleanPaths,
        count: cleanPaths.length,
      });
    }
  } catch (error: any) {
    logger.error('Workspace list error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/workspace/search
 * @desc Search workspace items across multiple scopes with metadata
 * Supports searching across multiple agents, teams, or other scopes
 * Returns items with metadata without loading full content (optimized for UI)
 */
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startTime = Date.now();
    const {
      prefix = '',
      scopes, // comma-separated: 'agent,team,company'
      agentIds, // comma-separated list of agent IDs/names
      teamIds, // comma-separated list of team IDs
      includeCompany = 'false',
      includeSession = 'false',
    } = req.query;

    const workspace = getWorkspaceService();
    const results: Array<{
      path: string;
      metadata: any;
      scope: string;
      scopeId?: string;
      scopeName?: string;
    }> = [];

    // Parse scope queries
    const requestedScopes = scopes ? (scopes as string).split(',') : ['agent'];
    const agentList = agentIds ? (agentIds as string).split(',') : [];
    const teamList = teamIds ? (teamIds as string).split(',') : [];

    // Search agent scopes
    if (requestedScopes.includes('agent') && agentList.length > 0) {
      const t1 = Date.now();
      await Promise.all(
        agentList.map(async (agentIdentifier) => {
          try {
            const resolvedAgentId = await resolveAgentId(
              agentIdentifier.trim(),
              req.company?._id?.toString(),
            );

            if (resolvedAgentId) {
              const scopePrefix = buildScopePrefix('agent', {
                agentId: resolvedAgentId,
              });
              const scopedPrefix = `${scopePrefix}${prefix}`;
              const items = await workspace.listWithMetadata(scopedPrefix);

              items.forEach((item) => {
                results.push({
                  path: stripScopePrefix(item.path, scopePrefix),
                  metadata: item.metadata || {},
                  scope: 'agent',
                  scopeId: resolvedAgentId,
                  scopeName: agentIdentifier.trim(),
                });
              });
            }
          } catch (error) {
            logger.warn(`Failed to search agent ${agentIdentifier}:`, error);
          }
        }),
      );
      logger.debug(`Agent search took ${Date.now() - t1}ms`);
    }

    // Search team scopes
    if (requestedScopes.includes('team') && teamList.length > 0) {
      const t2 = Date.now();

      // Validate that all requested teams belong to the user's company
      const companyTeamIds = new Set(
        req.company?.teams?.map(
          (t: any) => t._id?.toString() || t.toString(),
        ) || [],
      );

      await Promise.all(
        teamList.map(async (teamId) => {
          try {
            const trimmedTeamId = teamId.trim();

            // Security check: verify team belongs to user's company
            if (!companyTeamIds.has(trimmedTeamId)) {
              logger.warn(
                `User attempted to access team ${trimmedTeamId} outside their company`,
              );
              return;
            }

            const scopePrefix = buildScopePrefix('team', {
              teamId: trimmedTeamId,
            });
            const scopedPrefix = `${scopePrefix}${prefix}`;
            const items = await workspace.listWithMetadata(scopedPrefix);

            items.forEach((item) => {
              results.push({
                path: stripScopePrefix(item.path, scopePrefix),
                metadata: item.metadata || {},
                scope: 'team',
                scopeId: trimmedTeamId,
              });
            });
          } catch (error) {
            logger.warn(`Failed to search team ${teamId}:`, error);
          }
        }),
      );
      logger.debug(`Team search took ${Date.now() - t2}ms`);
    }

    // Search company scope
    if (
      (requestedScopes.includes('company') || includeCompany === 'true') &&
      req.company?._id
    ) {
      const t3 = Date.now();
      try {
        const scopePrefix = buildScopePrefix('company', {
          companyId: req.company._id.toString(),
        });
        const scopedPrefix = `${scopePrefix}${prefix}`;
        const items = await workspace.listWithMetadata(scopedPrefix);

        items.forEach((item) => {
          results.push({
            path: stripScopePrefix(item.path, scopePrefix),
            metadata: item.metadata || {},
            scope: 'company',
            scopeId: req.company._id.toString(),
          });
        });
      } catch (error) {
        logger.warn('Failed to search company scope:', error);
      }
      logger.debug(`Company search took ${Date.now() - t3}ms`);
    }

    // Search session scope
    if (requestedScopes.includes('session') || includeSession === 'true') {
      const t4 = Date.now();
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      try {
        await validateSessionOwnership(sessionId, req.company._id.toString());
        const scopePrefix = buildScopePrefix('session', {
          sessionId,
        });
        const scopedPrefix = `${scopePrefix}${prefix}`;
        const items = await workspace.listWithMetadata(scopedPrefix);

        items.forEach((item) => {
          results.push({
            path: stripScopePrefix(item.path, scopePrefix),
            metadata: item.metadata || {},
            scope: 'session',
            scopeId: sessionId,
          });
        });
      } catch (error) {
        logger.warn('Failed to search session scope:', error);
      }
      logger.debug(`Session search took ${Date.now() - t4}ms`);
    }

    const totalTime = Date.now() - startTime;
    logger.debug(
      `Total multi-scope search took ${totalTime}ms, found ${results.length} items`,
    );

    res.json({
      success: true,
      items: results,
      count: results.length,
      executionTimeMs: totalTime,
    });
  } catch (error: any) {
    logger.error('Workspace search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/workspace/vector-search
 * @desc Semantic search across workspace using vector embeddings
 * @body {
 *   query: string,                           // Required: search query
 *   scopes?: ['company', 'agent', 'team'],  // Optional: scopes to search (default: all)
 *   agentIds?: string[] | 'all',            // Optional: specific agents or 'all'
 *   teamIds?: string[] | 'all',             // Optional: specific teams or 'all'
 *   limit?: number,                          // Optional: max results (default: 20)
 *   minScore?: number                        // Optional: similarity threshold (default: 0.7)
 * }
 */
router.post(
  '/vector-search',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        query,
        scopes = ['company', 'agent', 'team'],
        agentIds = 'all',
        teamIds = 'all',
        limit = 20,
        minScore = 0.7,
      } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Query string is required',
        });
      }

      const vectorSearch = getVectorSearchService();
      const companyId = req.company._id.toString();
      const userId = req.user?._id?.toString();

      // Use new multi-scope search method (with parallel execution)
      const results = await vectorSearch.searchMultiScope(query, {
        scopes,
        agentIds,
        teamIds,
        limit,
        minScore,
        companyId,
        userId,
      });

      res.json({
        success: true,
        query,
        results,
        count: results.length,
        scopes: scopes.join(','),
      });
    } catch (error: any) {
      logger.error('Vector search failed', {
        error: error.message,
        stack: error.stack,
      });

      // Check for circuit breaker error
      if (error.message?.includes('Circuit breaker is open')) {
        return res.status(503).json({
          success: false,
          message:
            'Search service temporarily unavailable. Please try again in a moment.',
          error: 'CIRCUIT_BREAKER_OPEN',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Vector search failed',
        error: error.message,
      });
    }
  },
);

/**
 * @route POST /api/workspace/embed-documents
 * @desc Trigger embedding for existing documents
 */
router.post(
  '/embed-documents',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { scope, scopeId, limit = 100 } = req.body;

      if (!scope || !scopeId) {
        return res.status(400).json({
          success: false,
          message: 'Scope and scopeId are required',
        });
      }

      const vectorSearch = getVectorSearchService();
      const workspace = getWorkspaceService();
      const companyId = req.company._id.toString();

      // Get all documents for the scope
      const prefix = `/${scope}/${scopeId}/`;
      const paths = await workspace.list(prefix);

      logger.info(`Found ${paths.length} documents to embed in ${prefix}`);

      // Limit the number of documents to process
      const pathsToEmbed = paths.slice(0, limit);

      // Trigger embedding for each document (async, fire-and-forget)
      const results: any[] = [];
      for (const path of pathsToEmbed) {
        try {
          // Add unified-workspace namespace prefix
          const fullKey = `unified-workspace:${path}`;
          await vectorSearch.embedDocument(fullKey, companyId);
          results.push({ path, status: 'queued' });
        } catch (error: any) {
          logger.error(`Failed to queue embedding for ${path}`, error);
          results.push({ path, status: 'error', error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Queued ${results.length} documents for embedding`,
        scope,
        scopeId,
        totalDocuments: paths.length,
        queued: results.filter((r) => r.status === 'queued').length,
        errors: results.filter((r) => r.status === 'error').length,
        results,
      });
    } catch (error: any) {
      logger.error('Embed documents failed', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to embed documents',
        error: error.message,
      });
    }
  },
);

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
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
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
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required for session scope',
        });
      }
      await validateSessionOwnership(sessionId, req.company._id.toString());
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
        const sessionId = req.headers['x-session-id'] as string;
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Session ID is required for session scope',
          });
        }
        await validateSessionOwnership(sessionId, req.company._id.toString());
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
