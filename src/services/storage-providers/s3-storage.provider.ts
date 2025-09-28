import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';
import { StorageProvider } from './local-storage.provider';

class S3StorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'sb-workspace';

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  private sanitizeKey(key: string): string {
    // Ensure key doesn't start with /
    return key.replace(/^\//, '');
  }

  async upload(path: string, content: Buffer, options?: any): Promise<void> {
    const key = this.sanitizeKey(path);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: options?.contentType || 'application/octet-stream',
        Metadata: options?.metadata || {},
      });

      await this.s3Client.send(command);
      logger.debug(`S3Storage: Uploaded ${path} to bucket ${this.bucket}`);
    } catch (error) {
      logger.error(`S3Storage: Failed to upload ${path}`, error);
      throw error;
    }
  }

  async download(path: string): Promise<Buffer> {
    const key = this.sanitizeKey(path);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      logger.debug(`S3Storage: Downloaded ${path} from bucket ${this.bucket}`);
      return buffer;
    } catch (error) {
      logger.error(`S3Storage: Failed to download ${path}`, error);
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    const key = this.sanitizeKey(path);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      logger.debug(`S3Storage: Deleted ${path} from bucket ${this.bucket}`);
    } catch (error) {
      logger.error(`S3Storage: Failed to delete ${path}`, error);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const key = this.sanitizeKey(path);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (
        (error as any).name === 'NoSuchKey' ||
        (error as any).$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const sanitizedPrefix = this.sanitizeKey(prefix);

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: sanitizedPrefix,
      });

      const response = await this.s3Client.send(command);
      const files = response.Contents?.map((item) => item.Key || '') || [];

      logger.debug(
        `S3Storage: Listed ${files.length} files with prefix ${prefix}`,
      );
      return files;
    } catch (error) {
      logger.error(`S3Storage: Failed to list ${prefix}`, error);
      return [];
    }
  }
}

export function createS3Provider(): StorageProvider | null {
  try {
    // Only create S3 provider if credentials are available
    if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_REGION) {
      logger.info('S3 storage not configured, falling back to local storage');
      return null;
    }

    return new S3StorageProvider();
  } catch (error) {
    logger.error('Failed to create S3 storage provider:', error);
    return null;
  }
}
