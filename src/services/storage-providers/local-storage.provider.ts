import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';

export interface StorageProvider {
  upload(path: string, content: Buffer, options?: any): Promise<void>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists?(path: string): Promise<boolean>;
  list?(prefix: string): Promise<string[]>;
}

class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir || process.env.LOCAL_STORAGE_PATH || '/tmp/workspace';
    this.ensureBaseDir();
  }

  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create base directory:', error);
    }
  }

  private getFullPath(filePath: string): string {
    // Sanitize the path to prevent directory traversal
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\//, '');
    return path.join(this.baseDir, sanitized);
  }

  async upload(
    filePath: string,
    content: Buffer,
    options?: any,
  ): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    const dir = path.dirname(fullPath);

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content);

      logger.debug(`LocalStorage: Uploaded ${filePath}`);
    } catch (error) {
      logger.error(`LocalStorage: Failed to upload ${filePath}`, error);
      throw error;
    }
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);

    try {
      const content = await fs.readFile(fullPath);
      logger.debug(`LocalStorage: Downloaded ${filePath}`);
      return content;
    } catch (error) {
      logger.error(`LocalStorage: Failed to download ${filePath}`, error);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);

    try {
      await fs.unlink(fullPath);
      logger.debug(`LocalStorage: Deleted ${filePath}`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`LocalStorage: Failed to delete ${filePath}`, error);
        throw error;
      }
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const fullPath = this.getFullPath(prefix);

    try {
      const files: string[] = [];

      async function walkDir(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walkDir(entryPath);
          } else {
            files.push(entryPath);
          }
        }
      }

      await walkDir(fullPath);

      // Return paths relative to base directory
      return files.map((file) => path.relative(this.baseDir, file));
    } catch (error) {
      logger.error(`LocalStorage: Failed to list ${prefix}`, error);
      return [];
    }
  }
}

// Export singleton instance
export const localStorageProvider = new LocalStorageProvider();
