import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import mongoose from 'mongoose';
import { Storage } from '@google-cloud/storage';
import { logger } from '../utils/logger';

// File scope types
export type FileScopeType =
  | 'temporary'
  | 'session'
  | 'agent'
  | 'team'
  | 'company';

export interface FileScope {
  type: FileScopeType;
  ttl?: number; // TTL in minutes (null = permanent)
  ownerId?: string; // sessionId, agentId, teamId, or companyId
}

export interface ManagedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  scope: FileScope;
  storageType: 'memory' | 'disk' | 'gcp' | 's3';
  storageUrl?: string;
  localPath?: string;
  buffer?: Buffer;
  metadata: {
    createdBy?: string;
    purpose?: string;
    tags?: string[];
    [key: string]: any;
  };
  expiresAt?: Date;
  createdAt: Date;
  companyId?: string;
}

// MongoDB Schema for persistent files
const ManagedFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    scope: {
      type: {
        type: String,
        enum: ['temporary', 'session', 'agent', 'team', 'company'],
        required: true,
      },
      ttl: Number,
      ownerId: String,
    },
    storageType: {
      type: String,
      enum: ['memory', 'disk', 'gcp', 's3'],
      required: true,
    },
    storageUrl: String,
    localPath: String,
    metadata: mongoose.Schema.Types.Mixed,
    expiresAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  },
  { timestamps: true },
);

const ManagedFileModel = mongoose.model('ManagedFile', ManagedFileSchema);

class FileManagerService {
  private memoryStore: Map<string, ManagedFile> = new Map();
  private tempDir: string;
  private agentDir: string;
  private sessionDir: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private gcpStorage: Storage | null = null;
  private gcpBucket: string | null = null;

  // Default TTLs in minutes
  private readonly DEFAULT_TTLS = {
    temporary: 10,
    session: 24 * 60, // 24 hours
    agent: 7 * 24 * 60, // 7 days
    team: 30 * 24 * 60, // 30 days
    company: null, // permanent
  };

  constructor() {
    // Initialize directories
    this.tempDir = path.join(os.tmpdir(), 'sb-file-manager', 'temp');
    this.sessionDir = path.join(os.tmpdir(), 'sb-file-manager', 'sessions');
    this.agentDir = path.join(os.homedir(), '.sb-agents', 'files');

    this.initialize();
  }

  private async initialize() {
    // Create directories
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.mkdir(this.sessionDir, { recursive: true });
    await fs.mkdir(this.agentDir, { recursive: true });

    // Initialize GCP if configured
    if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.GCP_STORAGE_BUCKET
    ) {
      try {
        this.gcpStorage = new Storage();
        this.gcpBucket = process.env.GCP_STORAGE_BUCKET;
        logger.info(
          `FileManager: GCP Storage initialized with bucket: ${this.gcpBucket}`,
        );
      } catch (error) {
        logger.warn('FileManager: GCP Storage not available', error);
      }
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60000); // Run every minute
  }

  /**
   * Store a file with specified scope
   */
  async storeFile(
    content: Buffer | string | URL,
    filename: string,
    scope: FileScope,
    metadata: any = {},
    companyId?: string,
    userId?: string,
  ): Promise<ManagedFile> {
    // Generate unique file ID
    const fileId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const safeFilename = `${timestamp}_${fileId}_${path.basename(filename)}`;

    // Convert content to Buffer
    let buffer: Buffer;
    if (content instanceof URL) {
      // Download from URL
      const response = await fetch(content);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (typeof content === 'string') {
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = content;
    }

    // Determine storage strategy based on scope
    const storageType = this.getStorageType(scope);
    const ttl = scope.ttl || this.DEFAULT_TTLS[scope.type];
    const expiresAt = ttl ? new Date(Date.now() + ttl * 60 * 1000) : undefined;

    const managedFile: ManagedFile = {
      id: fileId,
      filename: safeFilename,
      originalName: filename,
      mimeType: metadata.mimeType || 'application/octet-stream',
      size: buffer.length,
      scope,
      storageType,
      metadata: {
        ...metadata,
        createdBy: userId,
      },
      expiresAt,
      createdAt: new Date(),
      companyId,
    };

    // Store based on type
    switch (storageType) {
      case 'memory':
        managedFile.buffer = buffer;
        this.memoryStore.set(fileId, managedFile);
        break;

      case 'disk':
        const diskPath = await this.storeToDisk(buffer, safeFilename, scope);
        managedFile.localPath = diskPath;
        break;

      case 'gcp':
        if (this.gcpStorage && this.gcpBucket) {
          const gcpUrl = await this.storeToGCP(buffer, safeFilename, scope);
          managedFile.storageUrl = gcpUrl;
        } else {
          // Fallback to disk if GCP not available
          const diskPath = await this.storeToDisk(buffer, safeFilename, scope);
          managedFile.localPath = diskPath;
          managedFile.storageType = 'disk';
        }
        break;
    }

    // Save to database if not temporary
    if (scope.type !== 'temporary') {
      try {
        const dbFile = new ManagedFileModel({
          ...managedFile,
          _id: fileId,
          companyId: companyId
            ? new mongoose.Types.ObjectId(companyId)
            : undefined,
          createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        });
        await dbFile.save();
      } catch (error) {
        logger.error('Failed to save file to database:', error);
      }
    }

    return managedFile;
  }

  /**
   * Get a file by ID
   */
  async getFile(fileId: string): Promise<ManagedFile | null> {
    // Check memory store first
    if (this.memoryStore.has(fileId)) {
      const file = this.memoryStore.get(fileId)!;
      if (file.expiresAt && file.expiresAt < new Date()) {
        this.memoryStore.delete(fileId);
        return null;
      }
      return file;
    }

    // Check database (validate ObjectId first)
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return null;
    }

    const dbFile = await ManagedFileModel.findById(fileId);
    if (!dbFile) {
      return null;
    }

    // Check if expired
    if (dbFile.expiresAt && dbFile.expiresAt < new Date()) {
      await ManagedFileModel.deleteOne({ _id: fileId });
      return null;
    }

    // Load file content based on storage type
    const managedFile: ManagedFile = {
      id: dbFile._id.toString(),
      filename: dbFile.filename,
      originalName: dbFile.originalName,
      mimeType: dbFile.mimeType,
      size: dbFile.size,
      scope: dbFile.scope as FileScope,
      storageType: dbFile.storageType as 'memory' | 'disk' | 'gcp' | 's3',
      storageUrl: dbFile.storageUrl || undefined,
      localPath: dbFile.localPath || undefined,
      metadata: dbFile.metadata,
      expiresAt: dbFile.expiresAt || undefined,
      createdAt: dbFile.createdAt,
      companyId: dbFile.companyId?.toString(),
    };

    // Load buffer if needed
    if (dbFile.localPath) {
      try {
        managedFile.buffer = await fs.readFile(dbFile.localPath);
      } catch (error) {
        logger.error(
          `Failed to read file from disk: ${dbFile.localPath}`,
          error,
        );
      }
    } else if (dbFile.storageUrl && this.gcpStorage) {
      // Download from GCP if needed
      try {
        const [buffer] = await this.downloadFromGCP(dbFile.storageUrl);
        managedFile.buffer = buffer;
      } catch (error) {
        logger.error(
          `Failed to download from GCP: ${dbFile.storageUrl}`,
          error,
        );
      }
    }

    return managedFile;
  }

  /**
   * List files by scope
   */
  async listFiles(
    scope: Partial<FileScope>,
    companyId?: string,
    limit: number = 100,
  ): Promise<ManagedFile[]> {
    const query: any = {};

    if (scope.type) query['scope.type'] = scope.type;
    if (scope.ownerId) query['scope.ownerId'] = scope.ownerId;
    if (companyId) query.companyId = new mongoose.Types.ObjectId(companyId);

    const dbFiles = await ManagedFileModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const files: ManagedFile[] = dbFiles.map((dbFile) => ({
      id: dbFile._id.toString(),
      filename: dbFile.filename,
      originalName: dbFile.originalName,
      mimeType: dbFile.mimeType,
      size: dbFile.size,
      scope: dbFile.scope as FileScope,
      storageType: dbFile.storageType as 'memory' | 'disk' | 'gcp' | 's3',
      storageUrl: dbFile.storageUrl || undefined,
      localPath: dbFile.localPath || undefined,
      metadata: dbFile.metadata,
      expiresAt: dbFile.expiresAt || undefined,
      createdAt: dbFile.createdAt,
      companyId: dbFile.companyId?.toString(),
    }));

    // Add temporary files from memory if requested
    if (scope.type === 'temporary' || !scope.type) {
      for (const [id, file] of this.memoryStore) {
        if (!file.expiresAt || file.expiresAt > new Date()) {
          if (!scope.ownerId || file.scope.ownerId === scope.ownerId) {
            files.push(file);
          }
        }
      }
    }

    return files;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    // Delete from memory
    if (this.memoryStore.has(fileId)) {
      this.memoryStore.delete(fileId);
      return true;
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return false;
    }

    // Delete from database
    const dbFile = await ManagedFileModel.findById(fileId);
    if (!dbFile) {
      return false;
    }

    // Delete physical file
    if (dbFile.localPath) {
      try {
        await fs.unlink(dbFile.localPath);
      } catch (error) {
        logger.error(
          `Failed to delete file from disk: ${dbFile.localPath}`,
          error,
        );
      }
    }

    if (dbFile.storageUrl && this.gcpStorage && this.gcpBucket) {
      try {
        await this.deleteFromGCP(dbFile.storageUrl);
      } catch (error) {
        logger.error(`Failed to delete from GCP: ${dbFile.storageUrl}`, error);
      }
    }

    await ManagedFileModel.deleteOne({ _id: fileId });
    return true;
  }

  /**
   * Clean up expired files
   */
  private async cleanupExpiredFiles() {
    const now = new Date();

    // Clean memory store
    for (const [id, file] of this.memoryStore) {
      if (file.expiresAt && file.expiresAt < now) {
        this.memoryStore.delete(id);
        if (file.localPath) {
          try {
            await fs.unlink(file.localPath);
          } catch (error) {
            // File might already be deleted
          }
        }
      }
    }

    // Clean database
    const expiredFiles = await ManagedFileModel.find({
      expiresAt: { $lt: now },
    });

    for (const file of expiredFiles) {
      if (file.localPath) {
        try {
          await fs.unlink(file.localPath);
        } catch (error) {
          // File might already be deleted
        }
      }
      if (file.storageUrl && this.gcpStorage) {
        try {
          await this.deleteFromGCP(file.storageUrl);
        } catch (error) {
          // Ignore
        }
      }
    }

    await ManagedFileModel.deleteMany({
      expiresAt: { $lt: now },
    });
  }

  /**
   * Determine storage type based on scope
   */
  private getStorageType(scope: FileScope): 'memory' | 'disk' | 'gcp' | 's3' {
    switch (scope.type) {
      case 'temporary':
        return 'memory';
      case 'session':
      case 'agent':
        return 'disk';
      case 'team':
      case 'company':
        return this.gcpStorage ? 'gcp' : 'disk';
      default:
        return 'disk';
    }
  }

  /**
   * Store file to disk
   */
  private async storeToDisk(
    buffer: Buffer,
    filename: string,
    scope: FileScope,
  ): Promise<string> {
    let directory: string;

    switch (scope.type) {
      case 'temporary':
        directory = this.tempDir;
        break;
      case 'session':
        directory = path.join(this.sessionDir, scope.ownerId || 'unknown');
        break;
      case 'agent':
        directory = path.join(this.agentDir, scope.ownerId || 'unknown');
        break;
      default:
        directory = this.tempDir;
    }

    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  /**
   * Store file to GCP
   */
  private async storeToGCP(
    buffer: Buffer,
    filename: string,
    scope: FileScope,
  ): Promise<string> {
    if (!this.gcpStorage || !this.gcpBucket) {
      throw new Error('GCP Storage not configured');
    }

    const bucket = this.gcpStorage.bucket(this.gcpBucket);
    const path = `${scope.type}/${scope.ownerId || 'global'}/${filename}`;
    const file = bucket.file(path);

    await file.save(buffer);
    return `gs://${this.gcpBucket}/${path}`;
  }

  /**
   * Download file from GCP
   */
  private async downloadFromGCP(storageUrl: string): Promise<[Buffer]> {
    if (!this.gcpStorage || !this.gcpBucket) {
      throw new Error('GCP Storage not configured');
    }

    const path = storageUrl.replace(`gs://${this.gcpBucket}/`, '');
    const bucket = this.gcpStorage.bucket(this.gcpBucket);
    const file = bucket.file(path);

    return file.download();
  }

  /**
   * Delete file from GCP
   */
  private async deleteFromGCP(storageUrl: string): Promise<void> {
    if (!this.gcpStorage || !this.gcpBucket) {
      throw new Error('GCP Storage not configured');
    }

    const path = storageUrl.replace(`gs://${this.gcpBucket}/`, '');
    const bucket = this.gcpStorage.bucket(this.gcpBucket);
    const file = bucket.file(path);

    await file.delete();
  }

  /**
   * Get download URL for a file
   */
  getDownloadUrl(
    fileId: string,
    baseUrl: string = process.env.BASE_URL || 'http://localhost:3000',
  ): string {
    return `${baseUrl}/files/${fileId}/download`;
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Final cleanup
    await this.cleanupExpiredFiles();
  }
}

// Singleton instance
let fileManagerInstance: FileManagerService | null = null;

export function getFileManager(): FileManagerService {
  if (!fileManagerInstance) {
    fileManagerInstance = new FileManagerService();
  }
  return fileManagerInstance;
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  if (fileManagerInstance) {
    await fileManagerInstance.shutdown();
  }
});

export default FileManagerService;
