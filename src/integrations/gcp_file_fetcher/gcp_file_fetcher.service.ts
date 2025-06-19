import { ContentFile, IContentFile } from '../../models/ContentFile';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import mongoose from 'mongoose';
import pdf from 'pdf-parse';
import { logger } from '../../utils/logger'; // Ensure logger is correctly imported

let storage: Storage | undefined;
let effectiveBucketName: string | undefined;
let isGcpStorageConfigured = false;

const placeholderBucketName = 'sb-ai-experiments-files'; // Define placeholder based on original log

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const envBucketName = process.env.GCP_STORAGE_BUCKET;
  if (envBucketName && envBucketName.trim() !== '' && envBucketName !== placeholderBucketName) {
    try {
      storage = new Storage(); // Initialize storage client
      effectiveBucketName = envBucketName;
      isGcpStorageConfigured = true;
      logger.info(`GcpFileFetcherService: GCP Storage configured with bucket: ${effectiveBucketName}`);
    } catch (error) {
      logger.error(`GcpFileFetcherService: Failed to initialize GCP Storage client for bucket ${envBucketName}. GCP Storage will be disabled. Error: ${(error as Error).message}`);
      storage = undefined;
      effectiveBucketName = undefined;
      isGcpStorageConfigured = false;
    }
  } else {
    if (!envBucketName || envBucketName.trim() === '') {
      logger.warn(`GcpFileFetcherService: GCP_STORAGE_BUCKET environment variable not set or empty. GCP Storage functionality will be disabled.`);
    } else if (envBucketName === placeholderBucketName) {
      // This case means the .env has the placeholder, which is fine if it's intentional for a default bucket
      // However, we still treat it as "configured" if it's explicitly set, even to the placeholder.
      // The original logic used this placeholder as a default if env var was missing.
      // For robust optionality, we might want to reconsider if placeholder means "not truly configured for unique use".
      // For now, aligning with previous change: if it's the placeholder, treat as not configured for specific operations.
      logger.warn(`GcpFileFetcherService: GCP_STORAGE_BUCKET is set to placeholder '${placeholderBucketName}'. Assuming not specifically configured; functionality may be limited or use a shared default.`);
      // To strictly disable if it's the placeholder:
      // isGcpStorageConfigured = false;
      // However, the original code *would* use this placeholder if GCP_STORAGE_BUCKET was missing.
      // Let's assume if it's explicitly set to the placeholder, it's intended (though odd).
      // For safety, let's be stricter: if it's the placeholder, it's not "user-configured".
      // This makes it consistent with content-file.service.ts
       isGcpStorageConfigured = false; // Treat placeholder as not configured for unique operations
       logger.warn(`GcpFileFetcherService: GCP_STORAGE_BUCKET is set to placeholder '${placeholderBucketName}'. GCP Storage functionality requiring a specific bucket will be disabled.`);
    }
     // isGcpStorageConfigured remains false unless explicitly set to a non-placeholder
  }
} else {
  logger.warn("GcpFileFetcherService: GOOGLE_APPLICATION_CREDENTIALS not found. GCP file fetcher service will not be available.");
  // isGcpStorageConfigured remains false
}

interface FetchFileParams {
  fileId: string;
  returnAs?: 'string' | 'buffer'; // Added option to return buffer
}

export const fetchGcpFileContent = async (
  sessionId: string, // Included for consistency with ActionContext, though not directly used here
  companyId: string,
  params: FetchFileParams
): Promise<{ success: boolean; data?: string | Buffer; error?: string }> => { // Updated return type
  if (!isGcpStorageConfigured || !storage || !effectiveBucketName) {
    const errorMsg = "Google Cloud Storage not configured or not properly initialized. Cannot fetch file.";
    logger.error(`fetchGcpFileContent: ${errorMsg}`);
    return { success: false, error: errorMsg }; 
  }
  if (!params.fileId) {
    throw new Error('The fileId parameter is missing.');
  }
  if (!mongoose.Types.ObjectId.isValid(params.fileId)) {
    throw new Error('Invalid fileId format.');
  }
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    // This should ideally be caught earlier or ensured by ActionContext
    throw new Error('Invalid companyId format.');
  }

  try {
    const fileObjectId = new mongoose.Types.ObjectId(params.fileId);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const fileDocument = await ContentFile.findOne({
      _id: fileObjectId,
      companyId: companyObjectId,
    });

    if (!fileDocument) {
      // Check if the file exists at all to give a more specific error
      const exists = await ContentFile.findById(fileObjectId);
      if (exists) {
        throw new Error(`File with ID ${params.fileId} found but does not belong to company ID ${companyId}.`);
      }
      throw new Error(`ContentFile not found with ID ${params.fileId} for company ID ${companyId}.`);
    }

    if (!fileDocument.gcpStorageUrl) {
      throw new Error(`GCP storage URL not found for file ID ${params.fileId}.`);
    }

    // Extract blob name from GCP storage URL
    // Example URL: https://storage.googleapis.com/bucket-name/blob-name.txt?t=timestamp
    const urlWithoutParams = fileDocument.gcpStorageUrl.split('?')[0];
    const blobName = path.basename(urlWithoutParams);

    if (!blobName) {
      throw new Error(`Could not extract blob name from URL: ${fileDocument.gcpStorageUrl}`);
    }

    const bucket = storage.bucket(effectiveBucketName); // Changed bucketName to effectiveBucketName
    const blob = bucket.file(blobName);

    const [exists] = await blob.exists();
    if (!exists) {
      throw new Error(`File not found in GCP bucket. Bucket: ${effectiveBucketName}, Blob: ${blobName}`); // Changed bucketName to effectiveBucketName
    }

    const [contents] = await blob.download(); // contents is a Buffer

    if (params.returnAs === 'buffer') {
      return { success: true, data: contents };
    }
    
    // Handle PDF files with proper text extraction
    if (fileDocument.mimeType === 'application/pdf') {
      try {
        const pdfData = await pdf(contents);
        return { success: true, data: pdfData.text };
      } catch (pdfError: any) {
        console.error('Error parsing PDF:', pdfError);
        return { success: false, error: `Failed to parse PDF: ${pdfError.message}` };
      }
    }
    
    // Default to string for other text-based files
    const fileContentString = contents.toString('utf8');
    return { success: true, data: fileContentString };

  } catch (error: any) {
    console.error('Error in fetchGcpFileContent:', error);
    // Rethrow the error to be handled by the action layer
    throw new Error(error.message || 'Failed to fetch GCP file content due to an unknown error.');
  }
};
