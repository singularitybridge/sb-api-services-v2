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

export const uploadFile = async (
  file: Express.Multer.File,
): Promise<string> => {
  const bucket = storage.bucket('sb-ai-experiments-files');
  const blob = bucket.file(file.originalname);

  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString();

  // Upload with cache control headers
  const metadata: any = {
    contentType: file.mimetype,
    cacheControl: 'no-cache, no-store, must-revalidate',
    lastModified: timestamp,
    metadata: {
      updateTimestamp: timestamp,
    },
  };

  // Set Content-Disposition to inline for common viewable image types
  if (
    file.mimetype &&
    (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')
  ) {
    metadata.contentDisposition = 'inline';
  } else {
    // For other types, or if unsure, let it default or explicitly set to attachment
    // metadata.contentDisposition = 'attachment'; // Optional: explicit attachment
  }

  await blob.save(file.buffer, {
    metadata: metadata,
  });

  // Generate signed URL with cache-busting parameter
  const [signedUrl] = await blob.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return `${signedUrl.split('?')[0]}?t=${Date.now()}`;
};

export const uploadBuffer = async (
  companyId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> => {
  const bucket = storage.bucket('sb-ai-experiments-files');
  const blob = bucket.file(`${companyId}/${filename}`);

  // Add timestamp to ensure uniqueness
  const timestamp = new Date().toISOString();

  // Upload with cache control headers
  const metadataBuffer: any = {
    contentType: contentType,
    cacheControl: 'no-cache, no-store, must-revalidate',
    lastModified: timestamp,
    metadata: {
      updateTimestamp: timestamp,
    },
  };

  if (
    contentType &&
    (contentType.startsWith('image/') || contentType === 'application/pdf')
  ) {
    metadataBuffer.contentDisposition = 'inline';
  }

  await blob.save(buffer, {
    metadata: metadataBuffer,
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
