import { Storage } from '@google-cloud/storage';

let storage: Storage;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Local development: Use the specified credentials file
  storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
} else {
  // In GCP: Use default credentials
  storage = new Storage();
}

export const uploadFile = async (file: Express.Multer.File): Promise<string> => {
  const bucket = storage.bucket('sb-ai-experiments-files');
  const blob = bucket.file(file.originalname);
  
  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString();

  // Upload with cache control headers
  await blob.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
      cacheControl: 'no-cache, no-store, must-revalidate',
      lastModified: timestamp,
      metadata: {
        updateTimestamp: timestamp
      }
    },
  });

  // Generate signed URL with cache-busting parameter
  const [signedUrl] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return `${signedUrl.split('?')[0]}?t=${Date.now()}`;
};

export const uploadBuffer = async (companyId: string, filename: string, buffer: Buffer, contentType: string): Promise<string> => {
  const bucket = storage.bucket('sb-ai-experiments-files');
  const blob = bucket.file(`${companyId}/${filename}`);
  
  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString();

  // Upload with cache control headers
  await blob.save(buffer, {
    metadata: {
      contentType: contentType,
      cacheControl: 'no-cache, no-store, must-revalidate',
      lastModified: timestamp,
      metadata: {
        updateTimestamp: timestamp
      }
    },
  });

  // Generate signed URL with cache-busting parameter
  const [signedUrl] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return `${signedUrl.split('?')[0]}?t=${Date.now()}`;
};

export const googleStorageService = {
  uploadFile,
  uploadBuffer,
};
