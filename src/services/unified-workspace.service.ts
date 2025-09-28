import Keyv from 'keyv';
import KeyvMongo from '@keyv/mongo';
import KeyvFile from 'keyv-file';
import { logger } from '../utils/logger';
import {
  localStorageProvider,
  StorageProvider,
} from './storage-providers/local-storage.provider';
import { createS3Provider } from './storage-providers/s3-storage.provider';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import mongoose from 'mongoose';

/**
 * Unified Workspace Service - Complete Storage Solution
 * Combines workspace operations, file management, and intelligent storage routing
 * Replaces: workspace.service, agent-workspace.service, file-manager.service,
 * content-file.service, content-type.service, and content.service
 */

// File scope types for file management
export type FileScopeType = 'session' | 'agent' | 'team' | 'company';

export interface FileScope {
  type: FileScopeType;
  ttl?: number; // TTL in seconds (optional, default is permanent)
  ownerId?: string; // sessionId, agentId, teamId, or companyId
}

export interface WorkspaceOptions {
  mongoUrl?: string;
  namespace?: string;
  ttl?: number; // Default TTL in seconds (optional)
  cacheSize?: number;
  storageProvider?: StorageProvider;
  enableS3?: boolean;
}

export interface WorkspaceEntry {
  path: string;
  content: any;
  metadata?: {
    contentType?: string;
    size?: number;
    createdAt?: Date;
    updatedAt?: Date;
    ttl?: number;
    [key: string]: any;
  };
}

export interface WorkspaceService {
  // Core workspace operations
  set: (path: string, content: any, metadata?: any) => Promise<void>;
  get: (path: string) => Promise<any>;
  exists: (path: string) => Promise<boolean>;
  delete: (path: string) => Promise<boolean>;
  list: (prefix?: string) => Promise<string[]>;
  clear: (prefix?: string) => Promise<void>;
  export: (prefix?: string) => Promise<Record<string, any>>;
  import: (data: Record<string, any>) => Promise<void>;
  getInfo: () => { entries: number; cacheSize: number; provider: string };

  // File management operations (merged from file-manager.service)
  uploadFile: (
    filename: string,
    buffer: Buffer,
    options?: {
      scope?: FileScopeType;
      metadata?: any;
      companyId?: string;
      userId?: string;
    },
  ) => Promise<{ id: string; path: string; url?: string }>;
  downloadFile: (fileId: string) => Promise<Buffer | null>;
  getFileInfo: (fileId: string) => Promise<any>;
  listFiles: (options?: {
    scope?: FileScopeType;
    prefix?: string;
  }) => Promise<any[]>;
  deleteFile: (fileId: string) => Promise<boolean>;
}

/**
 * Create a unified workspace service with functional composition
 */
export const createWorkspaceService = (
  options: WorkspaceOptions = {},
): WorkspaceService => {
  // Initialize storage backends
  let store;
  let keyv: Keyv;

  // Try to connect to MongoDB if available
  if (options.mongoUrl) {
    try {
      store = new KeyvMongo(options.mongoUrl);
      keyv = new Keyv({
        store,
        namespace: options.namespace || 'workspace',
        ttl: options.ttl,
      });
    } catch (error) {
      logger.warn(
        'Workspace: MongoDB connection failed, using disk storage',
        error,
      );
      // Fall back to disk storage
      const diskStorePath = path.join(process.cwd(), '.workspace-data');
      if (!fs.existsSync(diskStorePath)) {
        fs.mkdirSync(diskStorePath, { recursive: true });
      }

      const store = new KeyvFile({
        filename: path.join(
          diskStorePath,
          `${options.namespace || 'workspace'}.json`,
        ),
      });

      keyv = new Keyv({
        store,
        namespace: options.namespace || 'workspace',
        ttl: options.ttl,
      });
    }
  } else {
    // Use simple file-based JSON storage (persistent across restarts)
    const diskStorePath = path.join(process.cwd(), '.workspace-data');

    // Ensure directory exists
    if (!fs.existsSync(diskStorePath)) {
      fs.mkdirSync(diskStorePath, { recursive: true });
    }

    // Use keyv-file for simple JSON file storage
    const store = new KeyvFile({
      filename: path.join(
        diskStorePath,
        `${options.namespace || 'workspace'}.json`,
      ),
    });

    keyv = new Keyv({
      store,
      namespace: options.namespace || 'workspace',
      ttl: options.ttl,
    });

    logger.info(`Workspace: Using JSON file storage at ${diskStorePath}`);
  }

  // Memory cache for hot data
  const cache = new Map<string, { value: any; expiry?: number }>();
  const maxCacheSize = options.cacheSize || 1000;

  // File storage provider
  let fileStorage: StorageProvider;
  if (options.storageProvider) {
    fileStorage = options.storageProvider;
  } else if (options.enableS3 || process.env.USE_S3_STORAGE === 'true') {
    const s3Provider = createS3Provider();
    fileStorage = s3Provider || localStorageProvider;
  } else {
    fileStorage = localStorageProvider;
  }

  // Helper functions

  const sanitizePath = (path: string): string => {
    // Ensure path starts with /
    if (!path.startsWith('/')) path = '/' + path;
    // Remove double slashes
    return path.replace(/\/+/g, '/');
  };

  const getCacheKey = (path: string): string => {
    // Keyv already adds the namespace, so we just return the sanitized path
    return sanitizePath(path);
  };

  const pruneCache = (): void => {
    if (cache.size > maxCacheSize) {
      // Remove expired entries first
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (entry.expiry && entry.expiry < now) {
          cache.delete(key);
        }
      }

      // If still over limit, remove oldest entries
      if (cache.size > maxCacheSize) {
        const toRemove = cache.size - Math.floor(maxCacheSize * 0.8);
        const keys = Array.from(cache.keys()).slice(0, toRemove);
        keys.forEach((key) => cache.delete(key));
      }
    }
  };

  // Main functions
  const set = async (
    path: string,
    content: any,
    metadata: any = {},
  ): Promise<void> => {
    const sanitized = sanitizePath(path);
    const key = getCacheKey(sanitized);

    try {
      // MongoDB document size limit is 16MB
      const MAX_MONGODB_SIZE = 16 * 1024 * 1024; // 16MB

      // Convert content to Buffer for size check
      const contentBuffer = Buffer.isBuffer(content)
        ? content
        : typeof content === 'string'
          ? Buffer.from(content)
          : Buffer.from(JSON.stringify(content));

      // Check size limit
      if (contentBuffer.length > MAX_MONGODB_SIZE) {
        throw new Error(
          `Content size (${contentBuffer.length} bytes) exceeds MongoDB 16MB limit`,
        );
      }

      // Check if file exists to determine if this is update or create
      const existingRef = await keyv.get(key);
      const isUpdate = !!existingRef;

      // Store content directly in MongoDB
      // For binary data, convert to base64 for storage
      const storageContent = Buffer.isBuffer(content)
        ? {
            type: 'buffer',
            data: content.toString('base64'),
            encoding: 'base64',
          }
        : content;

      // Create document with content embedded
      const document = {
        type: 'embedded',
        content: storageContent,
        metadata: {
          ...metadata,
          size: contentBuffer.length,
          contentType:
            metadata.contentType || detectContentType(sanitized, content),
          createdAt: isUpdate ? existingRef?.metadata?.createdAt : new Date(),
          updatedAt: new Date(),
          version: isUpdate ? (existingRef?.metadata?.version || 0) + 1 : 1,
          isBuffer: Buffer.isBuffer(content),
        },
      };

      // Store directly in MongoDB with timeout
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database timeout')), 5000);
        });

        await Promise.race([
          keyv.set(
            key,
            document,
            metadata.ttl ? metadata.ttl * 1000 : undefined,
          ), // TTL in ms
          timeoutPromise,
        ]);
      } catch (timeoutError: any) {
        logger.warn(`Workspace: Database timeout while storing ${sanitized}`);
        throw timeoutError;
      }

      // Cache the document for fast lookups
      cache.set(key, {
        value: document,
        expiry: metadata.ttl ? Date.now() + metadata.ttl * 1000 : undefined,
      });
      pruneCache();

      logger.debug(
        `Workspace: ${isUpdate ? 'Updated' : 'Created'} ${sanitized} (${contentBuffer.length} bytes in MongoDB)`,
      );
    } catch (error) {
      logger.error(`Workspace: Failed to set ${sanitized}`, error);
      throw error;
    }
  };

  const get = async (path: string): Promise<any> => {
    const sanitized = sanitizePath(path);
    const key = getCacheKey(sanitized);

    try {
      // Check cache first
      const cached = cache.get(key);
      let document = cached?.value;

      if (!document || (cached?.expiry && cached.expiry < Date.now())) {
        // Get from MongoDB with timeout
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database timeout')), 5000);
          });

          document = await Promise.race([keyv.get(key), timeoutPromise]);
        } catch (timeoutError: any) {
          logger.warn(`Workspace: Database timeout for ${sanitized}`);
          return undefined;
        }
      }

      if (!document) {
        return undefined;
      }

      // Content is embedded directly in the document
      if (document.type === 'embedded' && document.content) {
        // Handle base64 encoded buffers
        if (
          document.content.type === 'buffer' &&
          document.content.encoding === 'base64'
        ) {
          const buffer = Buffer.from(document.content.data, 'base64');
          // Parse based on content type
          return parseContent(
            buffer,
            sanitized,
            document.metadata?.contentType,
          );
        }
        // Return JSON/text content directly
        return document.content;
      }

      // Fallback for old format (shouldn't happen with new storage)
      if (document.type === 'file' && document.path) {
        logger.warn(
          `Legacy file reference found for ${sanitized}, attempting disk read`,
        );
        const buffer = await fileStorage.download(document.path);
        return parseContent(buffer, sanitized, document.metadata?.contentType);
      }

      return undefined;
    } catch (error) {
      logger.error(`Workspace: Failed to get ${sanitized}`, error);
      throw error;
    }
  };

  // Helper to detect content type from path and content
  const detectContentType = (filePath: string, content?: any): string => {
    const ext = path.extname(filePath).toLowerCase();

    // Check by file extension
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    if (mimeTypes[ext]) {
      return mimeTypes[ext];
    }

    // Check by content type
    if (Buffer.isBuffer(content)) {
      return 'application/octet-stream';
    } else if (typeof content === 'object') {
      return 'application/json';
    } else {
      return 'text/plain';
    }
  };

  // Helper to parse buffer content
  const parseContent = (
    buffer: Buffer,
    filePath: string,
    contentType?: string,
  ): any => {
    // Use provided content type or detect from path
    const type = contentType || detectContentType(filePath);

    // If it's explicitly marked as binary, return buffer
    if (
      type.startsWith('image/') ||
      type.startsWith('video/') ||
      type.startsWith('audio/') ||
      type === 'application/octet-stream' ||
      type === 'application/pdf'
    ) {
      return buffer;
    }

    // Try to parse as JSON
    const str = buffer.toString();
    if (type === 'application/json' || filePath.endsWith('.json')) {
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }

    // Return as string for text types
    return str;
  };

  const exists = async (path: string): Promise<boolean> => {
    const sanitized = sanitizePath(path);
    const key = getCacheKey(sanitized);

    // Check cache first
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (!cached?.expiry || cached.expiry > Date.now()) {
        return true;
      }
    }

    // Check database
    const entry = await keyv.get(key);
    return entry !== undefined;
  };

  const deleteItem = async (path: string): Promise<boolean> => {
    const sanitized = sanitizePath(path);
    const key = getCacheKey(sanitized);

    try {
      // Get entry to check if it's a file
      const entry = await keyv.get(key);

      if (entry?.type === 'file') {
        // Delete from file storage
        await fileStorage.delete(entry.path);
      }

      // Delete from database
      await keyv.delete(key);

      // Delete from cache
      cache.delete(key);

      logger.debug(`Workspace: Deleted ${sanitized}`);
      return true;
    } catch (error) {
      logger.error(`Workspace: Failed to delete ${sanitized}`, error);
      return false;
    }
  };

  const list = async (prefix?: string): Promise<string[]> => {
    try {
      const namespace = options.namespace || 'workspace';

      // If using MongoDB, query the database directly
      if (store && store instanceof KeyvMongo && mongoose.connection.db) {
        try {
          // Use mongoose connection to access the MongoDB collection
          const db = mongoose.connection.db;
          const collection = db.collection('keyv');

          // Build query for keys starting with namespace
          // Keyv stores keys as "namespace:path"
          const namespacePrefix = `${namespace}:`;
          let query: any = {};

          if (prefix) {
            const sanitizedPrefix = sanitizePath(prefix);
            const fullPrefix = `${namespacePrefix}${sanitizedPrefix}`;
            // Use a regex that matches the exact prefix
            query = {
              key: {
                $regex: `^${fullPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
              },
            };
          } else {
            // Match all keys with this namespace
            query = {
              key: {
                $regex: `^${namespacePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
              },
            };
          }

          // Fetch matching documents
          const docs = await collection.find(query).toArray();

          // Extract and clean keys
          const keys = docs.map((doc: any) => {
            // Remove namespace prefix
            let key = doc.key;
            if (key.startsWith(namespacePrefix)) {
              key = key.substring(namespacePrefix.length);
            }
            return key;
          });

          logger.debug(
            `Workspace: Listed ${keys.length} keys from MongoDB with prefix: ${prefix || '/'}`,
          );
          return keys;
        } catch (mongoError) {
          logger.warn(
            'Failed to query MongoDB directly, falling back to cache',
            mongoError,
          );
          // Fall back to cache if MongoDB query fails
        }
      }

      // Fallback: use cache keys (for non-MongoDB stores or if MongoDB query fails)
      // Cache keys are already without namespace prefix now
      const cachedKeys = Array.from(cache.keys());

      if (prefix) {
        const sanitizedPrefix = sanitizePath(prefix);
        return cachedKeys.filter((key) => key.startsWith(sanitizedPrefix));
      }

      return cachedKeys;
    } catch (error) {
      logger.error('Workspace: Failed to list keys', error);
      return [];
    }
  };

  const clear = async (prefix?: string): Promise<void> => {
    try {
      if (prefix) {
        // Clear specific prefix
        const keys = await list(prefix);
        await Promise.all(keys.map((key) => deleteItem(key)));
      } else {
        // Clear everything
        await keyv.clear();
        cache.clear();
      }

      logger.info(`Workspace: Cleared ${prefix || 'all'}`);
    } catch (error) {
      logger.error('Workspace: Failed to clear', error);
      throw error;
    }
  };

  const exportData = async (prefix?: string): Promise<Record<string, any>> => {
    try {
      const keys = await list(prefix);
      const data: Record<string, any> = {};

      for (const key of keys) {
        data[key] = await get(key);
      }

      return data;
    } catch (error) {
      logger.error('Workspace: Failed to export', error);
      throw error;
    }
  };

  const importData = async (data: Record<string, any>): Promise<void> => {
    try {
      for (const [key, value] of Object.entries(data)) {
        await set(key, value);
      }

      logger.info(`Workspace: Imported ${Object.keys(data).length} entries`);
    } catch (error) {
      logger.error('Workspace: Failed to import', error);
      throw error;
    }
  };

  const getInfo = (): {
    entries: number;
    cacheSize: number;
    provider: string;
  } => {
    return {
      entries: cache.size,
      cacheSize: cache.size,
      provider: options.mongoUrl ? 'MongoDB' : 'JSON File',
    };
  };

  // File management functions (merged from file-manager.service)
  const uploadFile = async (
    filename: string,
    buffer: Buffer,
    options: {
      scope?: FileScopeType;
      metadata?: any;
      companyId?: string;
      userId?: string;
      ttl?: number; // TTL in seconds
    } = {},
  ): Promise<{ id: string; path: string; url?: string }> => {
    const scope = options.scope || 'company'; // Default to company scope
    const fileId = crypto.randomBytes(16).toString('hex');
    const safeFilename = filename.replace(/[^a-z0-9.-]/gi, '_');
    const filePath = `/files/${scope}/${fileId}/${safeFilename}`;

    // Store file with metadata (TTL is optional, default is permanent)
    await set(filePath, buffer, {
      ...options.metadata,
      fileId,
      filename,
      originalName: filename,
      mimeType: getMimeType(filename),
      size: buffer.length,
      scope,
      companyId: options.companyId,
      userId: options.userId,
      ttl: options.ttl, // Pass TTL if provided
      createdAt: new Date(),
    });

    logger.info(`File uploaded: ${fileId} at ${filePath} (${scope})`);

    return {
      id: fileId,
      path: filePath,
      url: `/files/${fileId}/download`,
    };
  };

  const downloadFile = async (fileId: string): Promise<Buffer | null> => {
    try {
      // Search for file by ID in all scopes
      const scopes: FileScopeType[] = ['session', 'agent', 'team', 'company'];

      for (const scope of scopes) {
        const files = await list(`/files/${scope}/${fileId}`);
        if (files.length > 0) {
          const content = await get(files[0]);
          if (Buffer.isBuffer(content)) {
            return content;
          }
          // Convert to buffer if needed
          return Buffer.from(content);
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to download file ${fileId}:`, error);
      return null;
    }
  };

  const getFileInfo = async (fileId: string): Promise<any> => {
    try {
      const scopes: FileScopeType[] = ['session', 'agent', 'team', 'company'];

      for (const scope of scopes) {
        const files = await list(`/files/${scope}/${fileId}`);
        if (files.length > 0) {
          // Get metadata stored with the file
          const entry = cache.get(getCacheKey(files[0]));
          if (entry) {
            return entry.value.metadata || {};
          }
          // Try to get from database
          const data = await keyv.get(getCacheKey(files[0]));
          if (data && data.metadata) {
            return data.metadata;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get file info ${fileId}:`, error);
      return null;
    }
  };

  const listFiles = async (
    options: { scope?: FileScopeType; prefix?: string } = {},
  ): Promise<any[]> => {
    const prefix = options.scope
      ? `/files/${options.scope}`
      : options.prefix || '/files';
    const paths = await list(prefix);

    // Extract file info from paths
    const files = [];
    for (const path of paths) {
      const parts = path.split('/');
      if (parts.length >= 4 && parts[1] === 'files') {
        const scope = parts[2];
        const fileId = parts[3];
        files.push({
          id: fileId,
          path,
          scope,
          filename: parts[4] || 'unknown',
        });
      }
    }

    return files;
  };

  const deleteFile = async (fileId: string): Promise<boolean> => {
    try {
      const scopes: FileScopeType[] = ['session', 'agent', 'team', 'company'];
      let deleted = false;

      for (const scope of scopes) {
        const files = await list(`/files/${scope}/${fileId}`);
        for (const file of files) {
          if (await deleteItem(file)) {
            deleted = true;
          }
        }
      }

      return deleted;
    } catch (error) {
      logger.error(`Failed to delete file ${fileId}:`, error);
      return false;
    }
  };

  // Helper function for MIME type
  const getMimeType = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.csv': 'text/csv',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  // Handle errors from Keyv
  keyv.on('error', (err: Error) => {
    logger.error('Workspace: Database error', err);
  });

  return {
    // Core workspace operations
    set,
    get,
    exists,
    delete: deleteItem,
    list,
    clear,
    export: exportData,
    import: importData,
    getInfo,

    // File management operations
    uploadFile,
    downloadFile,
    getFileInfo,
    listFiles,
    deleteFile,
  };
};

// Create default instance
let defaultInstance: WorkspaceService | null = null;

export const getWorkspaceService = (
  options?: WorkspaceOptions,
): WorkspaceService => {
  if (!defaultInstance) {
    // Check if MongoDB is available
    const mongoUrl = process.env.MONGODB_URI;

    defaultInstance = createWorkspaceService(
      options || {
        mongoUrl: mongoUrl, // Use MongoDB if available
        namespace: 'unified-workspace',
        cacheSize: 1000,
        // Storage provider only needed for file uploads
        storageProvider: localStorageProvider,
      },
    );

    if (mongoUrl) {
      logger.info('Workspace: Using MongoDB as primary persistent storage');
    } else {
      logger.info('Workspace: Using JSON file storage (fallback)');
    }
  }
  return defaultInstance;
};

/**
 * UnifiedWorkspaceService class wrapper for integration actions
 * Provides high-level methods for content storage and retrieval
 */
export class UnifiedWorkspaceService {
  private workspace: WorkspaceService;

  constructor() {
    this.workspace = getWorkspaceService();
  }

  /**
   * Store content at a specific path with scope
   */
  async storeContent(
    sessionId: string,
    path: string,
    content: any,
    options: { scope: string; agentId?: string } = { scope: 'session' }
  ): Promise<{ version: number }> {
    const scopePath = this.buildScopePath(options.scope, sessionId, options.agentId, path);

    // Get existing metadata to track version
    let version = 1;
    try {
      const existing = await this.workspace.get(scopePath);
      if (existing && existing.metadata?.version) {
        version = existing.metadata.version + 1;
      }
    } catch (error) {
      // Doesn't exist yet, version stays at 1
    }

    await this.workspace.set(scopePath, content, {
      version,
      updatedAt: new Date(),
      scope: options.scope,
      sessionId,
      agentId: options.agentId
    });

    return { version };
  }

  /**
   * Retrieve content from a specific path
   */
  async retrieveContent(
    sessionId: string,
    path: string,
    agentId?: string
  ): Promise<{ found: boolean; content?: any; metadata?: any }> {
    // Try agent scope first if agentId provided
    if (agentId) {
      const agentPath = this.buildScopePath('agent', sessionId, agentId, path);
      try {
        const result = await this.workspace.get(agentPath);
        if (result !== undefined && result !== null) {
          return {
            found: true,
            content: result,
            metadata: { scope: 'agent', agentId }
          };
        }
      } catch (error) {
        // Not found in agent scope, try session
      }
    }

    // Try session scope
    const sessionPath = this.buildScopePath('session', sessionId, undefined, path);
    try {
      const result = await this.workspace.get(sessionPath);
      if (result !== undefined && result !== null) {
        return {
          found: true,
          content: result,
          metadata: { scope: 'session' }
        };
      }
    } catch (error) {
      // Not found
    }

    return { found: false };
  }

  /**
   * List all content paths
   */
  async listContent(
    sessionId: string,
    prefix?: string,
    agentId?: string
  ): Promise<{ paths: string[]; count: number }> {
    const scope = agentId ? 'agent' : 'session';
    const basePath = this.buildScopePath(scope, sessionId, agentId, '');
    const fullPrefix = prefix ? `${basePath}${prefix}` : basePath;

    const paths = await this.workspace.list(fullPrefix);

    // Strip the base path from results for cleaner output
    const cleanPaths = paths.map(p => p.replace(basePath, ''));

    return { paths: cleanPaths, count: cleanPaths.length };
  }

  /**
   * Delete content at a specific path
   */
  async deleteContent(
    sessionId: string,
    path: string,
    agentId?: string
  ): Promise<{ deleted: boolean }> {
    const scope = agentId ? 'agent' : 'session';
    const fullPath = this.buildScopePath(scope, sessionId, agentId, path);

    const deleted = await this.workspace.delete(fullPath);
    return { deleted };
  }

  /**
   * Build a scoped path
   */
  private buildScopePath(
    scope: string,
    sessionId: string,
    agentId?: string,
    path: string
  ): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    switch (scope) {
      case 'agent':
        return `agent/${agentId}/${cleanPath}`;
      case 'session':
        return `session/${sessionId}/${cleanPath}`;
      default:
        return `session/${sessionId}/${cleanPath}`;
    }
  }
}

// Export types and functions
export default { createWorkspaceService, getWorkspaceService };
